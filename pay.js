/* =========================================================
   USDT (BEP20, BNB Smart Chain) — to'g'ridan-to'g'ri hamyonga to'lov
   (paymembers/chainpay.py naqshi: vositachisiz, server faqat OCHIQ manzilni biladi)
   - scan(): hamyonga kelgan USDT Transfer log'larini o'qiydi
   - lookupTx(): mijoz yuborgan TxID bo'yicha o'tkazmani tekshiradi
   Summalar sentlarda (butun son) — kasr xatolarisiz solishtirish uchun.
   ========================================================= */
const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955"; // BSC-USD, 18 xona
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const TX_RE = /^0x[0-9a-fA-F]{64}$/;
const CHUNK = 500;          // bitta eth_getLogs oralig'i (bloklar)
const MAX_SCAN = 6000;      // bitta scan() da ko'pi bilan
const FIRST_LOOKBACK = 1500; // birinchi ishga tushishda orqaga (~20 daqiqa)

const rpcUrl = () => process.env.BSC_RPC_URL || "https://bsc-rpc.publicnode.com";
const confirmations = () => Math.max(1, parseInt(process.env.BSC_CONFIRMATIONS, 10) || 15);
const normAddr = (v) => (ADDR_RE.test(String(v || "").trim()) ? String(v).trim().toLowerCase() : "");
const normTx = (v) => (TX_RE.test(String(v || "").trim()) ? String(v).trim().toLowerCase() : "");

async function rpc(method, params) {
  const r = await fetch(rpcUrl(), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`BSC RPC ${method}: HTTP ${r.status}`);
  const body = await r.json();
  if (body.error) throw new Error(`BSC RPC ${method}: ${body.error.message || JSON.stringify(body.error)}`);
  return body.result;
}

/* 18 xonali raw qiymat -> sent (pastga yaxlitlanadi) */
const rawToCents = (hex) => Number(BigInt(hex || "0x0") / 10n ** 16n);

function parseLog(item) {
  const t = item.topics || [];
  if (t.length !== 3 || String(t[0]).toLowerCase() !== TRANSFER_TOPIC || item.removed) return null;
  if (String(item.address || "").toLowerCase() !== USDT_CONTRACT) return null;
  return {
    ref: `${item.transactionHash.toLowerCase()}:${parseInt(item.logIndex, 16)}`,
    tx: item.transactionHash.toLowerCase(),
    from: "0x" + t[1].slice(-40).toLowerCase(),
    to: "0x" + t[2].slice(-40).toLowerCase(),
    cents: rawToCents(item.data),
    block: parseInt(item.blockNumber, 16),
  };
}
const topicFor = (addr) => "0x" + "0".repeat(24) + addr.slice(2);

/* state: { wallet, lastBlock } — chaqiruvchi saqlaydi. onTransfer(t) har yangi o'tkazma uchun. */
async function scan(state, wallet, onTransfer) {
  const addr = normAddr(wallet);
  if (!addr) return 0;
  if (state.wallet !== addr) { state.wallet = addr; state.lastBlock = null; }
  const head = parseInt(await rpc("eth_blockNumber", []), 16) - confirmations();
  let start = state.lastBlock != null ? state.lastBlock + 1 : Math.max(0, head - FIRST_LOOKBACK);
  if (head - start > MAX_SCAN * 5) start = head - MAX_SCAN; // uzoq to'xtab qolgan bo'lsa — eskisini o'tkazib yuboramiz
  const end = Math.min(head, start + MAX_SCAN - 1);
  let n = 0;
  for (let lo = start; lo <= end; lo += CHUNK) {
    const hi = Math.min(end, lo + CHUNK - 1);
    const logs = await rpc("eth_getLogs", [{ fromBlock: "0x" + lo.toString(16), toBlock: "0x" + hi.toString(16), address: USDT_CONTRACT, topics: [TRANSFER_TOPIC, null, topicFor(addr)] }]);
    logs.sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16) || parseInt(a.logIndex, 16) - parseInt(b.logIndex, 16));
    for (const item of logs) { const t = parseLog(item); if (t && t.to === addr) { await onTransfer(t); n++; } }
    state.lastBlock = hi;
  }
  return n;
}

/* TxID bo'yicha: hamyonga tushgan USDT o'tkazmalari.
   Qaytadi: { status: "ok"|"pending"|"failed"|"none", transfers: [...], time } */
async function lookupTx(tx, wallet) {
  const addr = normAddr(wallet), hash = normTx(tx);
  if (!addr || !hash) return { status: "none", transfers: [] };
  const rc = await rpc("eth_getTransactionReceipt", [hash]);
  if (!rc) return { status: "pending", transfers: [] };
  if (rc.status !== "0x1") return { status: "failed", transfers: [] };
  const transfers = (rc.logs || []).map(parseLog).filter((t) => t && t.to === addr);
  if (!transfers.length) return { status: "none", transfers: [] };
  const block = parseInt(rc.blockNumber, 16);
  const head = parseInt(await rpc("eth_blockNumber", []), 16);
  if (head - block < confirmations()) return { status: "pending", transfers };
  const b = await rpc("eth_getBlockByNumber", ["0x" + block.toString(16), false]);
  return { status: "ok", transfers, time: b ? parseInt(b.timestamp, 16) * 1000 : 0 };
}

module.exports = { scan, lookupTx, normAddr, normTx, USDT_CONTRACT };
