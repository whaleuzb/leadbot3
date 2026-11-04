/* =========================================================
   Mamurjon | MT — server (Node >= 18, tashqi kutubxonasiz)
   - Statik fayllar (landing + admin)
   - Ochiq API: /api/config, /api/orders (buyurtma + to'lov), /api/promo, /api/leads, /api/track
   - Admin API: /api/admin/* (parol + imzolangan cookie)
   Muhit o'zgaruvchilari:
     PORT            (default 3000)
     ADMIN_PASSWORD  boshlang'ich parol (default: admin123 — DARHOL o'zgartiring!)
     DATA_DIR        ma'lumotlar papkasi (default ./data; Railway'da Volume ulang)
     USDT_WALLET     USDT (BEP20) qabul qilinadigan hamyonning OCHIQ manzili (bo'lmasa admin paneldagi)
     BSC_RPC_URL     BNB Smart Chain RPC (default https://bsc-rpc.publicnode.com)
   ========================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pay = require("./pay");

const PORT = process.env.PORT || 3000;
const STARTED = new Date().toISOString().slice(0, 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const IMG_RE = /^\/uploads\/[a-f0-9]{16}\.(jpg|png|webp|gif)$/;
const IMG_MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const RECEIPT_DIR = path.join(DATA_DIR, "receipts"); // karta to'lovi cheklari — faqat admin ko'radi
const RECEIPT_RE = /^[a-f0-9]{24}\.(jpg|png|webp)$/;
/* ---------- Telegram bot ---------- */
// Muhit o'zgaruvchilari: TELEGRAM_BOT_TOKEN (@BotFather), TELEGRAM_CHAT_ID (ariza yuboriladigan chat/guruh)
const tgToken = () => process.env.TELEGRAM_BOT_TOKEN || "";
const tgChat = () => process.env.TELEGRAM_CHAT_ID || db.settings.tgChatId || ""; // env ustun, bo'lmasa admin paneldan tanlangan
const tgConfigured = () => !!(tgToken() && tgChat());
const htmlEsc = (v) => String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
async function tgCall(method, body) {
  const base = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
  const r = await fetch(`${base}/bot${tgToken()}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(10000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(d.description || "Telegram xatosi (" + r.status + ")");
  return d.result;
}
const tashkent = (iso) => {
  const d = new Date(new Date(iso).getTime() + 5 * 36e5), p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};
const tashkentFull = (iso) => {
  const d = new Date(new Date(iso).getTime() + 5 * 36e5), p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};
const usd = (cents) => "$" + (cents / 100).toFixed(cents % 100 ? 2 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const usdt = (cents) => (cents / 100).toFixed(2) + " USDT";
const som = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so‘m";
const METHOD = { usdt: "USDT (BEP20)", card: "Bank kartasi", manager: "Menejer orqali" };
const PAY_STATUS = { pending: "⏳ To‘lov kutilmoqda", review: "🔎 Chek tekshirilmoqda", paid: "✅ To‘landi", expired: "⌛ Muddati o‘tdi", cancelled: "✖️ Bekor qilindi", none: "📝 Ariza (to‘lovsiz)" };
function leadText(l) {
  const line = "━━━━━━━━━━━━━━";
  const head = l.no ? `🆕 Yangi buyurtma #${l.no} — ${htmlEsc(db.settings.brand)}` : `🆕 Yangi lid — ${htmlEsc(db.settings.brand)} Community kurs`;
  const rows = [head, line, `👤 Ism: ${htmlEsc(l.name)}`, `📞 Tel: ${htmlEsc(l.phone)}`, `💬 Telegram: ${l.username ? "@" + htmlEsc(l.username) : "—"}`,
    `💰 Kapital: ${htmlEsc(l.capital || "—")}`, `🏙 Shahar: ${htmlEsc(l.city || "—")}`, `🎓 Format: ${htmlEsc(l.format || "—")}`];
  if (l.no) {
    rows.push(`📦 Tarif: <b>${htmlEsc(l.planName)}</b>`, `💵 Narx: ${usd(l.priceCents)}${l.promo ? ` − ${usd(l.discountCents)} (promo ${htmlEsc(l.promo)})` : ""} = <b>${usd(l.amountCents)}</b>`,
      `💳 To‘lov: ${METHOD[l.method] || "—"}${l.method === "usdt" ? ` · ${usdt(l.payCents)}` : l.method === "card" && l.paySom ? ` · ${som(l.paySom)}` : ""}`, `📍 Holat: ${PAY_STATUS[l.payStatus] || "—"}`);
  }
  rows.push(`🕐 Vaqt: ${tashkentFull(l.createdAt)}`, line);
  return rows.join("\n");
}
async function notifyLead(lead) {
  if (!tgConfigured()) { lead.tg = "off"; save(); return; }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await tgCall("sendMessage", { chat_id: tgChat(), text: leadText(lead), parse_mode: "HTML", disable_web_page_preview: true });
      lead.tg = "sent"; delete lead.tgError; save(); return;
    } catch (e) {
      lead.tg = "failed"; lead.tgError = String(e.message).slice(0, 200);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.warn("Telegramga yuborilmadi:", lead.tgError);
  save();
}
/* Qisqa xabar (to'lov tushdi, chek keldi va h.k.) — xato bo'lsa jim o'tadi */
async function tgNotify(text, photo) {
  if (!tgConfigured()) return;
  try {
    if (photo) {
      const fd = new FormData();
      fd.append("chat_id", tgChat()); fd.append("caption", text.slice(0, 1000)); fd.append("parse_mode", "HTML");
      fd.append("photo", new Blob([photo.buf], { type: photo.type }), "chek." + photo.ext);
      const base = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
      const r = await fetch(`${base}/bot${tgToken()}/sendPhoto`, { method: "POST", body: fd, signal: AbortSignal.timeout(20000) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.description || "sendPhoto " + r.status);
    } else await tgCall("sendMessage", { chat_id: tgChat(), text, parse_mode: "HTML", disable_web_page_preview: true });
  } catch (e) { console.warn("Telegram xabari yuborilmadi:", e.message); }
}
const orderLine = (o) => `#${o.no} · ${htmlEsc(o.name)} · ${htmlEsc(o.planName)} · <b>${usd(o.amountCents)}</b>`;
const cleanImg = (v) => (typeof v === "string" && (IMG_RE.test(v) || (/^\/seed\/[a-z0-9-]+\.svg$/.test(v) && fs.existsSync(path.join(__dirname, "assets", "seed", v.slice(6))))) ? v : "");
const STATIC = {
  "/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css", "/script.js": "script.js", "/fx.js": "fx.js",
  "/admin": "admin.html", "/admin.html": "admin.html", "/admin.css": "admin.css", "/admin.js": "admin.js",
  "/robots.txt": "robots.txt", "/sitemap.xml": "sitemap.xml",
};
const MIME = { ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

/* ---------- Boshlang'ich ma'lumotlar ---------- */
const WHALES_UNLIMITED = "Whales signal guruhidan cheksiz foydalanish";
const CORE = [
  "Treyding asoslari: bozor, aktivlar, birjalar, terminal",
  "Texnik tahlil: trend, daraja, sham formatsiyalari, hajm",
  "Risk-menejment: pozitsiya hajmi, stop-loss, risk/foyda",
  "Treyder psixologiyasi: qo‘rquv va ochko‘zlikni boshqarish",
  "Treyding jurnali shabloni va bitimlarni tahlil qilish",
];
function defaultPlans() {
  return [
    { id: "online-individual", format: "online", eyebrow: "ONLINE · 1 GA 1", badge: "SHAXSIY MENTOR", name: "Individual", description: "Mentor bilan 1 ga 1 online darslar: shaxsiy reja, bitimlaringiz tahlili va doimiy qo‘llab-quvvatlash.", duration: "2–3 oy", price: 899, oldPrice: 1200, available: true, featured: true, whales: "Cheksiz", image: "",
      features: ["Mentor bilan 1 ga 1 online darslar", ...CORE, "Shaxsiy treyding strategiyangizni birga quramiz", "Bitimlaringiz va jurnalingizni individual tahlil qilish", "Mentor bilan shaxsiy aloqa", WHALES_UNLIMITED], excluded: [] },
    { id: "online-lessons", format: "online", eyebrow: "ONLINE · MUSTAQIL", badge: "", name: "Darsliklar", description: "Video darsliklar orqali o‘z ritmingizda o‘rganing — telefondan yoki kompyuterdan.", duration: "3 oy", price: 399, oldPrice: 600, available: true, featured: false, whales: "3 oy", image: "",
      features: ["Video darsliklarga kirish — 3 oy", ...CORE, "Amaliy topshiriqlar", "Whales signal guruhi — 3 oy"], excluded: ["Mentor bilan shaxsiy darslar"] },
    { id: "offline-individual", format: "offline", eyebrow: "OFFLAYN · 1 GA 1", badge: "YUZMA-YUZ", name: "Individual", description: "Mentor bilan yuzma-yuz 1 ga 1 darslar: real grafikda birga ishlaymiz, xatolaringizni joyida tuzatamiz.", duration: "2–3 oy", price: 1699, oldPrice: 2200, available: true, featured: true, whales: "Cheksiz", image: "",
      features: ["Mentor bilan 1 ga 1 offlayn darslar", ...CORE, "Shaxsiy treyding strategiyangizni birga quramiz", "Bitimlaringiz va jurnalingizni individual tahlil qilish", "Mentor bilan shaxsiy aloqa", WHALES_UNLIMITED], excluded: [] },
    { id: "offline-group", format: "offline", eyebrow: "OFFLAYN · GURUH", badge: "", name: "Jamoaviy", description: "Kichik guruhda offlayn darslar: mentor bilan jonli mashg‘ulotlar va guruhdoshlar bilan tajriba almashish.", duration: "2–3 oy", price: 1299, oldPrice: 1500, available: false, featured: false, whales: "Cheksiz", image: "",
      features: ["Kichik guruhda offlayn darslar", ...CORE, "Guruhli amaliy mashg‘ulotlar", WHALES_UNLIMITED], excluded: [] },
  ];
}
/* Tarif bandlari shabloni: standart bandlar + admin qo'shganlari + tariflarda ishlatilganlari (takrorsiz, tartib saqlanadi) */
function featureLibrary() {
  const d = defaultPlans(), out = [], seen = new Set();
  const add = (t) => { const k = String(t || "").trim(); if (k && !seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); out.push(k); } };
  d.forEach((p) => p.features.forEach(add)); d.forEach((p) => p.excluded.forEach(add));
  (db.featureLib || []).forEach(add);
  db.plans.forEach((p) => { p.features.forEach(add); p.excluded.forEach(add); });
  return out.slice(0, 150);
}
function defaults() {
  return {
    settings: {
      brand: "Mamurjon | MT",
      authorName: "Mamurjon",
      telegram: "managermtuz",
      freeGuidesUrl: "https://t.me/mamurjon_mt",
      enrollStart: "2026-09-30T00:00:00+05:00",
      enrollEnd: "2026-10-10T23:59:00+05:00",
      enrollmentOpen: true,
      tgChatId: "",
      capitals: ["1.000$ gacha", "1.000$ - 5.000$", "5.000$ - 10.000$", "10.000$ dan yuqori"],
      stats: [
        { value: "3+ yil", label: "bozor tajribasi" },
        { value: "1:2", label: "minimal risk / foyda nisbati" },
        { value: "1–2%", label: "bitimga maksimal risk" },
        { value: "100%", label: "jurnal bilan nazorat" },
      ],
      hero: {
        eyebrow: "TREYDING BO‘YICHA COMMUNITY",
        title1: "TASODIF EMAS —",
        accent: "TIZIM",
        title3: "ISHLAYDI",
        intro: "Tasodifiy bitimlarsiz va “signal”larga ko‘r-ko‘rona ishonmasdan — o‘z strategiyang, aniq riskni boshqarish va sovuqqon qaror qabul qilish.",
        note: "Telefondan yoki kompyuterdan. O‘zingizga qulay ritmda.",
        captionLabel: "TREYDING TIZIMI",
        caption: "Ishonch tasodifdan emas,\ntizimdan boshlanadi",
      },
      payments: { usdtWallet: "", cardNumber: "", cardHolder: "", cardBank: "", usdRate: 0 },
      riskNote: "Treyding — yuqori xavfli faoliyat, kapitalingizning bir qismini yoki hammasini yo‘qotishingiz mumkin. Ushbu community ta’lim maqsadida va moliyaviy maslahat emas; o‘tgan natijalar kelajakdagi daromadni kafolatlamaydi. Faqat yo‘qotishga tayyor bo‘lgan mablag‘ bilan savdo qiling.",
    },
    plans: defaultPlans(),
    lessons: [
      { n: "01", t: "Bozor tuzilishi", d: "Trend, diapazon, likvidlik" },
      { n: "02", t: "Daraja va zonalar", d: "Support / resistance qanday chiziladi" },
      { n: "03", t: "Risk-menejment", d: "Pozitsiya hajmi va stop-loss" },
      { n: "04", t: "Treyding rejasi", d: "Kirish, chiqish, shartlar" },
      { n: "05", t: "Psixologiya", d: "Hissiyotlarni nazorat qilish" },
    ],
    audience: [
      "Treydingni noldan boshlamoqchisiz, lekin qayerdan boshlashni bilmayapsizmi?",
      "Depozitni bir necha marta yo‘qotgansiz va sababini tushunmayapsizmi?",
      "Boshqalarning signallariga tayanasiz, o‘z qarorlaringizga ishonchingiz yo‘qmi?",
      "Bitimga kirish va chiqishni qanday belgilashni bilmayapsizmi?",
      "Har bitimda qancha risk qilishni va stop-loss’ni qanday qo‘yishni bilmaysizmi?",
      "Hissiyotlarga berilib, rejadan chetga chiqib ketasizmi (qo‘rquv, ochko‘zlik)?",
      "Ko‘p narsani o‘rgandingiz, lekin bitta ishlaydigan tizim yig‘a olmadingizmi?",
      "“Tez boyish” emas, kapitalni himoya qiladigan va barqaror yondashuvni xohlaysizmi?",
    ],
    results: [], // shogirtlar natijalari: { image, caption }
    leads: [], // arizalar va buyurtmalar (buyurtmada: no, plan, amountCents, method, payStatus ...)
    promos: [], // { id, code, type: percent|fixed, value, plans: [], maxUses, used, expiresAt, active }
    orderSeq: 1000,
    chain: { wallet: "", lastBlock: null }, // USDT skaner holati
    transfers: [], // hamyonga kelgan USDT o'tkazmalari: { ref, tx, from, cents, block, at, orderId }
    stats: { views: {}, clicks: {} }, // views: {sana: n}, clicks: {sana: {tarif: n}}
    auth: { secret: crypto.randomBytes(32).toString("hex"), passwordHash: null },
  };
}

/* ---------- Saqlash ---------- */
let db;
function load() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { db = defaults(); save(); }
  const d = defaults();
  for (const k of Object.keys(d)) if (db[k] === undefined) db[k] = d[k];
  db.audience = (db.audience || []).map((x) => (typeof x === "string" ? { t: x, image: "" } : x));
  db.settings = { ...d.settings, ...db.settings }; // yangi sozlamalar eski bazada ham paydo bo'ladi
  db.settings.hero = { ...d.settings.hero, ...(db.settings.hero || {}) };
  db.settings.payments = { ...d.settings.payments, ...(db.settings.payments || {}) };
  // Bir martalik: yangi tariflar (Online / Offlayn, narx va to'lov bilan)
  if (!db.plansV2) { db.plans = d.plans; db.plansV2 = true; autoPlanImages(); save(); }
  db.auth.secret = db.auth.secret || d.auth.secret;
  seedImages();
  seedResults();
  // Bir martalik: "o'rtacha oylik daromad" statistikasi o'rniga o'quvchilar soni (daromad va'dasi bo'lmasin)
  if (!db.statsFix1) {
    const i = (db.settings.stats || []).findIndex((x) => /daromad/i.test(x.label || "") || /^65\s*%$/.test((x.value || "").trim()));
    if (i >= 0) db.settings.stats[i] = { value: "1000+", label: "o‘quvchilar" };
    db.statsFix1 = true; save();
  }
  // Bir martalik: eski hero sarlavhasi yangisiga (admin o'zgartirgan bo'lsa tegilmaydi)
  if (!db.heroFix1) {
    const h = db.settings.hero;
    if (h.title1 === "TREYDING —" && h.accent === "QUMORDAN" && h.title3 === "FARQI BOR") Object.assign(h, { title1: d.settings.hero.title1, accent: d.settings.hero.accent, title3: d.settings.hero.title3 });
    db.heroFix1 = true; save();
  }
  // Bir martalik: eski brend nomi yangisiga (admin o'zgartirgan bo'lsa tegilmaydi)
  if (!db.brandFix1) { if (/^trade ?move$/i.test(db.settings.brand || "")) db.settings.brand = d.settings.brand; db.brandFix1 = true; save(); }
  // Parolni tiklash: RESET_ADMIN_PASSWORD qiymati o'zgarganda saqlangan parol o'chadi va ADMIN_PASSWORD amal qiladi (bir martalik)
  const rt = process.env.RESET_ADMIN_PASSWORD;
  if (rt && db.auth.resetToken !== rt) {
    db.auth.passwordHash = null; db.auth.secret = crypto.randomBytes(32).toString("hex"); db.auth.resetToken = rt; save();
    console.warn("Admin paroli tiklandi: endi ADMIN_PASSWORD amal qiladi.");
  }
  // eski namunaviy username o'zgartirilmagan bo'lsa — yangisiga almashtiramiz
  if (db.settings.telegram === "trade" + "move_admin") { db.settings.telegram = d.settings.telegram; save(); }
}
/* Mavzuga mos animatsiyali rasmlar (assets/seed/*.svg) */
const SEED_DIR = path.join(__dirname, "assets", "seed");
const SEED_RE = /^\/seed\/[a-z0-9-]+\.svg$/;
const seedUrl = (name) => (fs.existsSync(path.join(SEED_DIR, name + ".svg")) ? `/seed/${name}.svg` : "");
// Avvalgi versiyada avtomatik qo'yilgan JPG'lar (ularni qayta tanlash mumkin, foydalanuvchi yuklaganlariga tegilmaydi)
const LEGACY = new Set((() => {
  const dir = path.join(SEED_DIR, "legacy");
  try { return fs.readdirSync(dir).map((f) => "/uploads/" + crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex").slice(0, 16) + ".jpg"); }
  catch { return []; }
})());
// Kesh: fayl o'zgarsa yangi versiya darhol yetib borsin
const etags = new Map(); // jarayon davomida fayllar o'zgarmaydi; deploy = yangi jarayon
const etagOf = (fp) => { if (!etags.has(fp)) etags.set(fp, `"${crypto.createHash("sha1").update(fs.readFileSync(fp)).digest("hex").slice(0, 16)}"`); return etags.get(fp); };
const seedVer = new Map();
const versioned = (u) => {
  if (typeof u !== "string" || !SEED_RE.test(u)) return u;
  if (!seedVer.has(u)) { try { seedVer.set(u, crypto.createHash("sha1").update(fs.readFileSync(path.join(SEED_DIR, u.slice(6)))).digest("hex").slice(0, 10)); } catch { seedVer.set(u, "0"); } }
  return `${u}?v=${seedVer.get(u)}`;
};
const isAutoImage = (u) => !u || LEGACY.has(u) || SEED_RE.test(u);
// [fayl, kalit so'zlar] — faqat spot: aksiyalar va kripto
const LESSON_POOL = [
  ["trend", ["bozor tuzil", "tuzilish", "trend", "struktura", "structure", "yo'nalish"]],
  ["levels", ["daraja", "zona", "support", "resistance", "tayanch", "qarshilik", "level"]],
  ["risk", ["risk", "stop-loss", "stop loss", "take profit", "foyda nisbat", "pozitsiya hajmi", "menejment"]],
  ["plan", ["reja", "plan", "strategiya", "strategy", "checklist", "savdo rejasi", "shartlar"]],
  ["psychology", ["psixolog", "emotsi", "hissiyot", "qo'rquv", "intizom", "mindset", "motivats", "ochko'z"]],
  ["candles", ["sham", "candle", "pattern", "formatsiya", "pin bar", "doji", "engulf", "yutish", "price action"]],
  ["indicators", ["indikator", "indicator", "rsi", "macd", "ema", "sma", "osillyator", "bollinger", "fibo", "o'rtacha"]],
  ["volume", ["hajm", "volume", "vsa", "profil"]],
  ["journal", ["jurnal", "journal", "statistika", "natija", "backtest", "xatolar"]],
  ["fundamental", ["fundamental", "yangilik", "news", "kalendar", "makro", "iqtisod", "inflyats", "hisobot", "earnings"]],
  ["timeframes", ["timeframe", "taymfreym", "vaqt oraliq", "multi", "tf"]],
  ["capital", ["kapital", "depozit", "money", "mablag'", "equity", "pul boshqar", "moliya", "portfel", "portfolio"]],
  ["orderflow", ["order flow", "orderflow", "oqim", "footprint", "stakan", "dom", "tape", "lenta", "delta"]],
  ["insiders", ["insayder", "insider", "katta o'yinchi", "yirik o'yinchi", "kit", "whale", "market maker", "manipulyats", "smart money", "smc"]],
  ["liquidity", ["likvid", "liquidity", "tugatil", "sweep", "stop-hunt", "orderblok", "order block"]],
  ["sessions", ["sessiya", "session", "london", "nyu-york", "new york", "osiyo", "asia", "qaysi vaqt", "savdo vaqt", "soat"]],
  ["tools", ["instrument", "asbob", "tool", "avtomat", "bot", "kalkulyator", "skaner", "dastur", "signal"]],
];
const norm = (t) => String(t || "").toLowerCase().replace(/[‘’ʻʼ`´]/g, "'");
const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hit = (text, k) => (k.length <= 3 ? new RegExp(`(^|[^a-z0-9'])${esc(k)}([^a-z0-9']|$)`).test(text) : text.includes(k));
const scoreOf = (l, kws) => { const t = norm(l.t), d = norm(l.d); return kws.reduce((s, k) => s + (hit(t, k) ? 2 : hit(d, k) ? 1 : 0) * k.length, 0); };
// "Kimga mos" kartalari uchun: [fayl, kalit so'zlar]
const AUD_POOL = [
  ["aud-start", ["noldan", "boshla", "qayerdan", "yangi boshlov", "birinchi qadam"]],
  ["aud-loss", ["yo'qot", "depozit", "zarar", "kuydir", "sababini"]],
  ["aud-signals", ["signal", "boshqalar", "ko'r-ko'rona", "ishonch", "kanal"]],
  ["aud-entry", ["kirish", "chiqish", "bitimga", "belgila"]],
  ["aud-risk", ["risk", "stop", "qancha"]],
  ["aud-emotions", ["hissiyot", "qo'rquv", "ochko'z", "emotsi", "rejadan chetga", "asab"]],
  ["aud-system", ["tizim", "o'rgandingiz", "yig'a", "ishlaydigan", "strategiya"]],
  ["aud-growth", ["barqaror", "kapital", "himoya", "tez boyish", "uzoq muddat", "o'sish"]],
];
// Avtomatik rasmli (yoki rasmsiz) kartalarga matniga eng mos rasmni tanlaydi; takrorlanmaslikka harakat qiladi
function autoImages(list, POOL) {
  const pool = POOL.map(([n, kw]) => ({ url: seedUrl(n), kw })).filter((x) => x.url);
  if (!pool.length) return 0;
  const targets = list.filter((l) => isAutoImage(l.image));
  const used = new Set(list.filter((l) => !isAutoImage(l.image)).map((l) => l.image));
  const pairs = [];
  targets.forEach((l) => pool.forEach((p, i) => { const sc = scoreOf(l, p.kw); if (sc > 0) pairs.push({ l, i, sc }); }));
  pairs.sort((a, b) => b.sc - a.sc);
  const done = new Map();
  for (const { l, i } of pairs) if (!done.has(l) && !used.has(pool[i].url)) { done.set(l, pool[i].url); used.add(pool[i].url); }
  let count = 0;
  targets.forEach((l, k) => {
    let url = done.get(l);
    if (!url) {
      const best = pairs.find((p) => p.l === l);
      url = best ? pool[best.i].url : (pool.find((p) => !used.has(p.url)) || pool[k % pool.length]).url;
      used.add(url);
    }
    if (l.image !== url) { l.image = url; count++; }
  });
  if (count) save();
  return count;
}
const autoLessonImages = () => autoImages(db.lessons, LESSON_POOL);
const autoAudienceImages = () => autoImages(db.audience, AUD_POOL);
function autoPlanImages() {
  const byId = { mini: "plan-mini", pro: "plan-pro", individual: "plan-individual", "online-individual": "plan-individual", "online-lessons": "plan-mini", "offline-individual": "plan-pro", "offline-group": "plan-group" }, order = ["plan-mini", "plan-pro", "plan-individual"];
  db.plans.forEach((p, i) => { if (!isAutoImage(p.image)) return; const n = byId[p.id] || order[i]; if (n) p.image = seedUrl(n); });
}
function seedImages() {
  if (!db.seededImages3) { autoLessonImages(); autoPlanImages(); db.seededImages3 = true; save(); }
  if (!db.seededAudience1) { autoAudienceImages(); db.seededAudience1 = true; save(); }
}
/* Shogirtlar natijalari: assets/results/*.jpg uploads'ga ko'chiriladi (admin paneldan tahrirlanadi).
   Har bir fayl bir marta qo'shiladi — admin o'chirgan natija qaytib kelmaydi, yangi fayllar oxiriga qo'shiladi. */
const RESULT_CAPTIONS = {
  "r01-mina": "MINA/USDT · +17.02%", "r02-dot": "DOT/USDT · +13.39%", "r03-o": "O/USDT · +11.08%",
  "r04-pnl": "Spot PnL · 7 kun: +11 698 USDT", "r16-mexc": "MEXC · spot bitim", "r17-binance": "Binance · spot bitim",
  "r18-acu": "ACU/USDT · +31.97%", "r20-binance": "Binance · spot bitim", "r23-bitget": "Bitget · spot bitim", "r24-bitget": "Bitget · spot bitim",
  "r27-gtc": "GTC/USDT · +30%", "r28-gtc": "Shogird fikri · TP 0.16", "r29-gtc": "GTC/USDT · +14.33%", "r30-gtc": "GTC/USDT · +52.96%", "r31-gtc": "GTC/USDT · +28.53%",
};
function seedResults() {
  const dir = path.join(__dirname, "assets", "results");
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /^r\d+-[a-z0-9-]+\.jpg$/.test(f)).sort(); } catch {}
  // eski bazada birinchi to'plam (r01–r17) allaqachon qo'shilgan
  if (!Array.isArray(db.seededResultFiles)) db.seededResultFiles = db.seededResults1 ? files.filter((f) => parseInt(f.slice(1), 10) <= 17) : [];
  const done = new Set(db.seededResultFiles);
  let added = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const buf = fs.readFileSync(path.join(dir, f));
    const name = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16) + ".jpg";
    const dest = path.join(UPLOAD_DIR, name);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, buf);
    const key = f.slice(0, -4), pair = (key.split("-")[1] || "").toUpperCase();
    if (!db.results.some((r) => r.image === "/uploads/" + name)) db.results.push({ image: "/uploads/" + name, caption: RESULT_CAPTIONS[key] || `${pair}/USDT · spot bitim` });
    db.seededResultFiles.push(f); added++;
  }
  if (added || !db.seededResults1) { db.seededResults1 = true; save(); }
}
let saving = false, dirty = false;
function save() {
  if (saving) { dirty = true; return; }
  saving = true;
  const tmp = DB_FILE + ".tmp";
  fs.writeFile(tmp, JSON.stringify(db, null, 2), (err) => {
    if (!err) fs.renameSync(tmp, DB_FILE);
    else console.error("Saqlashda xato:", err.message);
    saving = false;
    if (dirty) { dirty = false; save(); }
  });
}

/* ---------- Yordamchilar ---------- */
const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const today = () => new Date(Date.now() + 5 * 36e5).toISOString().slice(0, 10); // Toshkent sanasi
const uid = () => crypto.randomBytes(6).toString("hex");
const isDate = (s) => typeof s === "string" && !Number.isNaN(Date.parse(s));

function send(res, code, body, headers = {}) {
  const isObj = body !== null && typeof body === "object";
  res.writeHead(code, {
    "Content-Type": isObj ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body ?? "");
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!/application\/json/.test(req.headers["content-type"] || "")) return reject(Object.assign(new Error("JSON kerak"), { code: 415 }));
    let size = 0, chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 200_000) { reject(Object.assign(new Error("Juda katta"), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { reject(Object.assign(new Error("Noto‘g‘ri JSON"), { code: 400 })); } });
  });
}
function readRaw(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > max) { reject(Object.assign(new Error(`Rasm juda katta (${Math.round(max / 1048576)} MB dan oshmasin)`), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function sniffImage(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "png";
  if (b.length > 12 && b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") return "webp";
  if (b.length > 6 && b.slice(0, 4).toString() === "GIF8") return "gif";
  return null;
}
function fmtPhone(raw) {
  const d = String(raw).replace(/\D/g, "");
  const n = d.length === 9 ? "998" + d : d;
  return /^998\d{9}$/.test(n) ? `+998 (${n.slice(3, 5)}) ${n.slice(5, 8)}-${n.slice(8, 10)}-${n.slice(10, 12)}` : str(raw, 30);
}
const clientIp = (req) => (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

/* ---------- Parol va sessiya ---------- */
function hashPw(pw, salt = crypto.randomBytes(16).toString("hex")) {
  return salt + ":" + crypto.scryptSync(pw, salt, 32).toString("hex");
}
function checkPw(pw) {
  const stored = db.auth.passwordHash;
  if (!stored) {
    const env = process.env.ADMIN_PASSWORD || "admin123";
    const a = crypto.createHash("sha256").update(pw).digest(), b = crypto.createHash("sha256").update(env).digest();
    return crypto.timingSafeEqual(a, b);
  }
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, "hex"));
}
const sign = (payload) => crypto.createHmac("sha256", db.auth.secret).update(payload).digest("hex");
function makeToken() {
  const exp = String(Date.now() + 7 * 864e5);
  return exp + "." + sign(exp);
}
function isAuthed(req) {
  const m = /(?:^|;\s*)tm_session=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
const cookie = (val, maxAge, req) =>
  `tm_session=${val}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}` + (req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "");

/* Oddiy rate-limit: kalit -> [vaqtlar] */
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 36e5)) hits.delete(k); }, 6e5).unref();

/* ---------- Tozalash (validatsiya) ---------- */
function cleanHero(h = {}, cur) {
  const f = (k, max) => str(h[k], max) || cur[k];
  return { eyebrow: f("eyebrow", 60), title1: f("title1", 40), accent: f("accent", 40), title3: f("title3", 40),
    intro: f("intro", 300), note: f("note", 120), captionLabel: f("captionLabel", 40), caption: f("caption", 120) };
}
function cleanSettings(s = {}) {
  const cur = db.settings;
  const stats = Array.isArray(s.stats) ? s.stats.slice(0, 4).map((x) => ({ value: str(x?.value, 20), label: str(x?.label, 60) })) : cur.stats;
  return {
    brand: str(s.brand, 30) || cur.brand,
    authorName: str(s.authorName, 60) || cur.authorName,
    telegram: str(s.telegram, 40).replace(/^@/, "").replace(/[^\w]/g, "") || cur.telegram,
    freeGuidesUrl: s.freeGuidesUrl === undefined ? cur.freeGuidesUrl : /^https:\/\/[^\s"<>]{3,300}$/.test(str(s.freeGuidesUrl, 300)) ? str(s.freeGuidesUrl, 300) : cur.freeGuidesUrl,
    enrollStart: isDate(s.enrollStart) ? s.enrollStart : cur.enrollStart,
    enrollEnd: isDate(s.enrollEnd) ? s.enrollEnd : cur.enrollEnd,
    enrollmentOpen: typeof s.enrollmentOpen === "boolean" ? s.enrollmentOpen : cur.enrollmentOpen,
    tgChatId: cur.tgChatId || "",
    capitals: Array.isArray(s.capitals) && s.capitals.some((x) => str(x, 40)) ? s.capitals.map((x) => str(x, 40)).filter(Boolean).slice(0, 8) : cur.capitals,
    stats,
    riskNote: str(s.riskNote, 1200) || cur.riskNote,
    hero: cleanHero(s.hero, cur.hero),
    payments: s.payments === undefined ? cur.payments : cleanPayments(s.payments),
  };
}
function cleanPayments(p = {}) {
  const bad = (m) => { throw Object.assign(new Error(m), { code: 400 }); };
  const wallet = str(p.usdtWallet, 60);
  if (wallet && !pay.normAddr(wallet)) bad("USDT hamyon manzili noto‘g‘ri (BEP20: 0x bilan boshlanadigan 42 belgi)");
  const card = String(p.cardNumber ?? "").replace(/\D/g, "");
  if (card && (card.length < 16 || card.length > 19)) bad("Karta raqami 16 xonali bo‘lsin");
  const rate = Math.round(Number(p.usdRate) || 0);
  if (rate && (rate < 1000 || rate > 100000)) bad("Dollar kursi noto‘g‘ri (masalan 12700)");
  return { usdtWallet: pay.normAddr(wallet), cardNumber: card.replace(/(\d{4})(?=\d)/g, "$1 "), cardHolder: str(p.cardHolder, 60), cardBank: str(p.cardBank, 40), usdRate: rate };
}
/* To'lov sozlamalari: env ustun */
const envCard = () => { const d = String(process.env.PAY_CARD_NUMBER || "").replace(/\D/g, ""); return d.length >= 16 && d.length <= 19 ? d.replace(/(\d{4})(?=\d)/g, "$1 ") : ""; };
const envRate = () => { const r = Math.round(Number(process.env.USD_RATE) || 0); return r >= 1000 && r <= 100000 ? r : 0; };
const payCfg = () => {
  const p = db.settings.payments || {};
  const cbu = db.cbuRate && db.cbuRate.rate > 0 ? db.cbuRate : null;
  return { ...p, usdtWallet: pay.normAddr(process.env.USDT_WALLET) || p.usdtWallet || "", walletFromEnv: !!pay.normAddr(process.env.USDT_WALLET),
    cardNumber: envCard() || p.cardNumber || "", cardFromEnv: !!envCard(), cardHolder: p.cardHolder || str(process.env.PAY_CARD_HOLDER, 60), cardBank: p.cardBank || str(process.env.PAY_CARD_BANK, 40),
    usdRate: p.usdRate > 0 ? p.usdRate : envRate() || (cbu ? cbu.rate : 0), rateManual: p.usdRate > 0, cbuRate: cbu,
    rateSource: p.usdRate > 0 ? "admin" : envRate() ? "env" : cbu ? "auto" : "" };
};
/* Markaziy bank (cbu.uz) dollar kursi — admin kurs kiritmagan bo'lsa ishlatiladi, 6 soatda yangilanadi */
async function refreshCbuRate() {
  try {
    const r = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/", { signal: AbortSignal.timeout(15000) });
    const d = await r.json();
    const row = Array.isArray(d) ? d.find((x) => x && x.Ccy === "USD") || d[0] : null;
    const rate = Math.round(parseFloat(String(row?.Rate || "").replace(",", ".")));
    if (rate >= 1000 && rate <= 100000) { db.cbuRate = { rate, date: str(row.Date, 20), source: "Markaziy bank", at: new Date().toISOString() }; save(); return; }
    console.warn("CBU kursi noto‘g‘ri javob:", JSON.stringify(d).slice(0, 200));
  } catch (e) { console.warn("CBU kursini olib bo‘lmadi:", e.message); }
  // Zaxira: cbu.uz chet eldan ochilmasa (Railway serveri AQShda)
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(15000) });
    const d = await r.json(), rate = Math.round(Number(d?.rates?.UZS));
    if (rate >= 1000 && rate <= 100000) { db.cbuRate = { rate, date: tashkent(new Date().toISOString()).slice(0, 10), source: "open.er-api.com", at: new Date().toISOString() }; save(); }
  } catch (e) { console.warn("Zaxira kursni ham olib bo‘lmadi:", e.message); }
}
const methodsOn = () => { const p = payCfg(); return { usdt: !!p.usdtWallet, card: !!(p.cardNumber && p.usdRate > 0) }; };
const planLabel = (p) => `${p.format === "offline" ? "Offlayn" : "Online"} · ${p.name}`;
const strList = (a, n = 30) => (Array.isArray(a) ? a.map((x) => str(x, 200)).filter(Boolean).slice(0, n) : []);
function cleanPlans(arr) {
  if (!Array.isArray(arr) || !arr.length) throw Object.assign(new Error("Kamida bitta tarif kerak"), { code: 400 });
  const seen = new Set();
  return arr.slice(0, 12).map((p) => {
    let id = str(p.id, 30).replace(/[^\w-]/g, "") || uid();
    while (seen.has(id)) id = uid();
    seen.add(id);
    return {
      id, eyebrow: str(p.eyebrow, 40), badge: str(p.badge, 40),
      name: str(p.name, 40) || "Tarif", description: str(p.description, 300),
      duration: str(p.duration, 80), featured: !!p.featured, image: cleanImg(p.image),
      features: strList(p.features), excluded: strList(p.excluded, 10),
      format: p.format === "offline" ? "offline" : "online",
      price: Math.max(0, Math.round(Number(p.price) * 100) / 100 || 0),
      oldPrice: Math.max(0, Math.round(Number(p.oldPrice) * 100) / 100 || 0),
      available: p.available !== false, whales: str(p.whales, 30),
    };
  });
}
function cleanPromos(arr) {
  if (!Array.isArray(arr)) throw Object.assign(new Error("Noto‘g‘ri ro‘yxat"), { code: 400 });
  const seen = new Set(), old = new Map(db.promos.map((x) => [x.id, x]));
  return arr.slice(0, 200).map((x) => {
    const code = str(x?.code, 20).toUpperCase();
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw Object.assign(new Error(`Promo kod noto‘g‘ri: “${code || "bo‘sh"}” (3–20 belgi: lotin harf, raqam, - _)`), { code: 400 });
    if (seen.has(code)) throw Object.assign(new Error(`Promo kod takrorlangan: ${code}`), { code: 400 });
    seen.add(code);
    const type = x.type === "fixed" ? "fixed" : "percent", value = Math.round(Number(x.value) * 100) / 100 || 0;
    if (value <= 0 || (type === "percent" && value >= 100)) throw Object.assign(new Error(`${code}: chegirma qiymati noto‘g‘ri`), { code: 400 });
    const prev = old.get(x.id);
    return { id: prev ? prev.id : uid(), code, type, value, plans: Array.isArray(x.plans) ? x.plans.filter((id) => db.plans.some((p) => p.id === id)) : [],
      maxUses: Math.max(0, parseInt(x.maxUses, 10) || 0), used: prev ? prev.used : 0,
      expiresAt: isDate(x.expiresAt) ? x.expiresAt : "", active: x.active !== false, note: str(x.note, 100) };
  });
}
function cleanResults(arr) {
  if (!Array.isArray(arr)) throw Object.assign(new Error("Noto‘g‘ri ro‘yxat"), { code: 400 });
  return arr.slice(0, 60).map((r) => ({ image: cleanImg(r?.image), caption: str(r?.caption, 80) })).filter((r) => r.image);
}
function cleanLessons(arr) {
  if (!Array.isArray(arr)) throw Object.assign(new Error("Noto‘g‘ri ro‘yxat"), { code: 400 });
  return arr.slice(0, 20).map((l, i) => ({ n: String(i + 1).padStart(2, "0"), t: str(l.t, 50) || "Dars", d: str(l.d, 100), image: cleanImg(l.image) }));
}

/* ---------- Buyurtma va to'lov ---------- */
const ORDER_TTL = 48 * 36e5; // to'lov kutish muddati
const findPromo = (code) => { const c = str(code, 20).toUpperCase(); return c ? db.promos.find((x) => x.code === c) : null; };
/* Promo kodni tekshiradi: { ok, error?, discountCents } */
function applyPromo(code, plan) {
  const pr = findPromo(code), price = Math.round(plan.price * 100);
  if (!pr || !pr.active) return { ok: false, error: "Bunday promo kod yo‘q yoki faol emas" };
  if (pr.expiresAt && Date.parse(pr.expiresAt) < Date.now()) return { ok: false, error: "Promo kod muddati tugagan" };
  if (pr.maxUses && pr.used >= pr.maxUses) return { ok: false, error: "Promo kod limiti tugagan" };
  if (pr.plans.length && !pr.plans.includes(plan.id)) return { ok: false, error: "Bu promo kod tanlangan tarifga amal qilmaydi" };
  const d = pr.type === "fixed" ? Math.round(pr.value * 100) : Math.round(price * pr.value / 100);
  return { ok: true, promo: pr, discountCents: Math.max(0, Math.min(d, price - 100)) };
}
/* USDT summasi har bir kutilayotgan buyurtma uchun noyob (kasr qismi bilan) — kelgan o'tkazmani aniq topish uchun */
function uniquePayCents(base) {
  const busy = new Set(db.leads.filter((o) => o.method === "usdt" && o.payStatus === "pending").map((o) => o.payCents));
  for (let k = 1 + Math.floor(Math.random() * 99), n = 0; n < 400; n++, k = (k % 399) + 1) if (!busy.has(base + k)) return base + k;
  return base + 1 + Math.floor(Math.random() * 999);
}
function payInfo(o) {
  const p = payCfg();
  const raw = String(process.env.USDT_WALLET || "").trim(), shown = pay.normAddr(raw) === o.payAddress ? raw : o.payAddress;
  if (o.method === "usdt") return { network: "BEP20 (BNB Smart Chain)", token: "USDT", address: shown || p.usdtWallet, amount: (o.payCents / 100).toFixed(2), expiresAt: new Date(Date.parse(o.createdAt) + ORDER_TTL).toISOString() };
  if (o.method === "card") return { card: p.cardNumber, holder: p.cardHolder, bank: p.cardBank, sum: o.paySom, rate: o.rate };
  return null;
}
const publicOrder = (o) => ({ id: o.id, no: o.no, planName: o.planName, planId: o.plan, priceCents: o.priceCents, discountCents: o.discountCents, amountCents: o.amountCents, promo: o.promo || "",
  method: o.method, payStatus: o.payStatus, pay: payInfo(o), txid: o.txid || "", hasReceipt: !!o.receipt, createdAt: o.createdAt, paidAt: o.paidAt || "" });
const orderByToken = (id, t) => { const o = db.leads.find((x) => x.id === id && x.no); return o && typeof t === "string" && o.token && t.length === o.token.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(o.token)) ? o : null; };

/* To'lov tasdiqlanganda (avtomatik yoki admin) — bir marta */
function markPaid(o, how, extra = {}) {
  if (o.payStatus === "paid") return false;
  o.payStatus = "paid"; o.status = "paid"; o.paidAt = new Date().toISOString(); o.paidVia = how; Object.assign(o, extra);
  const pr = o.promo && findPromo(o.promo);
  if (pr) pr.used = (pr.used || 0) + 1;
  save();
  tgNotify(`✅ <b>To‘lov qabul qilindi</b> (${htmlEsc(how)})\n${orderLine(o)}\n💬 ${o.username ? "@" + htmlEsc(o.username) : htmlEsc(o.phone)}${o.txid ? `\n🔗 https://bscscan.com/tx/${o.txid}` : ""}\n\nMijozni Whales guruhi va darslarga qo‘shing.`);
  return true;
}
function expireOrders() {
  const now = Date.now(); let n = 0;
  for (const o of db.leads) if (o.no && o.payStatus === "pending" && now - Date.parse(o.createdAt) > ORDER_TTL) { o.payStatus = "expired"; n++; }
  if (n) save();
}
/* Kelgan o'tkazmani buyurtmaga moslash */
const openUsdt = (addr) => db.leads.filter((o) => o.method === "usdt" && (o.payStatus === "pending" || o.payStatus === "expired") && o.payAddress === addr && Date.now() - Date.parse(o.createdAt) < ORDER_TTL + 24 * 36e5);
async function onTransfer(t) {
  if (db.transfers.some((x) => x.ref === t.ref)) return;
  const rec = { ref: t.ref, tx: t.tx, from: t.from, to: t.to, cents: t.cents, block: t.block, at: new Date().toISOString(), orderId: null };
  db.transfers.unshift(rec);
  if (db.transfers.length > 500) db.transfers.length = 500;
  const open = openUsdt(t.to);
  // 1) TxID allaqachon yuborilgan  2) summa aynan mos  3) summaga mos YAGONA buyurtma (1 USDT gacha ortiq/kam)
  let o = open.find((x) => x.claimTx === t.tx && t.cents >= x.payCents - 100)
    || open.find((x) => x.payCents === t.cents);
  if (!o) { const fits = open.filter((x) => t.cents >= x.payCents - 100 && t.cents < x.payCents + 100); if (fits.length === 1) o = fits[0]; }
  if (o) { rec.orderId = o.id; markPaid(o, "USDT avtomatik", { txid: t.tx, paidCents: t.cents }); return; }
  save();
  tgNotify(`⚠️ <b>USDT keldi, lekin mos buyurtma topilmadi</b>\nSumma: <b>${usdt(t.cents)}</b>\nYuboruvchi: <code>${t.from}</code>\nTx: https://bscscan.com/tx/${t.tx}\n\nAdmin panel → Arizalar → “Biriktirilmagan o‘tkazmalar” dan buyurtmaga biriktiring.`);
}
let scanning = false, scanError = "", lastScan = 0;
async function scanTick(force) {
  if (scanning) return;
  expireOrders();
  const wallet = payCfg().usdtWallet;
  if (!wallet) return;
  const pending = db.leads.some((o) => o.method === "usdt" && o.payStatus === "pending");
  if (!pending && !force && Date.now() - lastScan < 15 * 6e4) return; // kutilayotgan to'lov yo'q — kamdan-kam tekshiramiz
  scanning = true;
  try { await pay.scan(db.chain, wallet, onTransfer); lastScan = Date.now(); scanError = ""; save(); }
  catch (e) { scanError = String(e.message).slice(0, 200); console.warn("USDT skaner:", scanError); }
  finally { scanning = false; }
}
/* Mijoz TxID yuborganda — darhol tekshiramiz */
async function claimTx(o, txRaw) {
  const tx = pay.normTx(txRaw);
  if (!tx) return { error: "TxID noto‘g‘ri (0x bilan boshlanadigan 66 belgi)" };
  if (db.leads.some((x) => x !== o && (x.txid === tx || x.claimTx === tx))) return { error: "Bu TxID boshqa buyurtmaga biriktirilgan" };
  o.claimTx = tx; save();
  let r;
  try { r = await pay.lookupTx(tx, o.payAddress); } catch (e) { return { status: "saved", note: "Tarmoqni hozir tekshirib bo‘lmadi — to‘lov avtomatik tekshiriladi." }; }
  if (r.status === "failed") return { error: "Bu tranzaksiya tarmoqda muvaffaqiyatsiz bo‘lgan" };
  if (r.status === "none") return { error: "Bu tranzaksiyada bizning hamyonga USDT (BEP20) o‘tkazmasi topilmadi. Tarmoq va manzilni tekshiring." };
  if (r.status === "pending") return { status: "saved", note: "Tranzaksiya hali tasdiqlanmoqda — bir necha daqiqada avtomatik qabul qilinadi." };
  if (r.time && r.time < Date.parse(o.createdAt) - 10 * 6e4) return { error: "Bu tranzaksiya buyurtmadan oldin qilingan" };
  const fresh = r.transfers.filter((t) => !db.transfers.some((x) => x.ref === t.ref && x.orderId && x.orderId !== o.id));
  const cents = fresh.reduce((a, t) => a + t.cents, 0);
  if (!fresh.length) return { error: "Bu o‘tkazma allaqachon boshqa buyurtmaga biriktirilgan" };
  if (cents < o.payCents - 100) return { error: `Kelgan summa (${usdt(cents)}) to‘lov summasidan kam. Menejerga yozing.` };
  for (const t of fresh) { const ex = db.transfers.find((x) => x.ref === t.ref); if (ex) ex.orderId = o.id; else db.transfers.unshift({ ...t, at: new Date().toISOString(), orderId: o.id }); }
  markPaid(o, "USDT TxID", { txid: tx, paidCents: cents });
  return { status: "paid" };
}
function notifyReceipt(o, title) {
  const fp = o.receipt && cleanReceipt(o.receipt);
  let photo = null;
  try { if (fp) { const buf = fs.readFileSync(fp), ext = path.extname(fp).slice(1); photo = { buf, type: IMG_MIME[ext], ext }; } } catch {}
  tgNotify(`🧾 <b>${htmlEsc(title)}</b>\n${orderLine(o)}\nSumma: <b>${som(o.paySom)}</b>\n💬 @${htmlEsc(o.username)} · ${htmlEsc(o.phone)}\n\nAdmin panel → Arizalar’da tekshirib, “To‘lovni tasdiqlash” ni bosing.`, photo);
}
function cleanReceipt(name) { return RECEIPT_RE.test(name) ? path.join(RECEIPT_DIR, name) : null; }

/* ---------- Dashboard ---------- */
function dashboard() {
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() + 5 * 36e5 - i * 864e5).toISOString().slice(0, 10));
  const leadsByDay = {};
  for (const l of db.leads) { const d = l.createdAt.slice(0, 10); leadsByDay[d] = (leadsByDay[d] || 0) + 1; }
  const byStatus = { new: 0, contacted: 0, paid: 0, rejected: 0 };
  const byPlan = {};
  for (const l of db.leads) {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    const k = l.planName || l.capital || "—"; byPlan[k] = (byPlan[k] || 0) + 1;
  }
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const clicksByPlan = {};
  let clicksTotal = 0;
  for (const d of Object.values(db.stats.clicks)) for (const [k, v] of Object.entries(d)) { clicksByPlan[k] = (clicksByPlan[k] || 0) + v; clicksTotal += v; }
  const viewsTotal = sum(db.stats.views);
  const revenueCents = db.leads.filter((l) => l.payStatus === "paid").reduce((a, l) => a + (l.amountCents || 0), 0);
  return {
    totals: { views: viewsTotal, clicks: clicksTotal, leads: db.leads.length, paid: byStatus.paid, revenueCents,
      conversion: viewsTotal ? +(db.leads.length / viewsTotal * 100).toFixed(1) : 0 },
    byStatus, byPlan, clicksByPlan,
    series: days.map((d) => ({ date: d, views: db.stats.views[d] || 0, leads: leadsByDay[d] || 0 })),
  };
}

/* ---------- Marshrutlar ---------- */
async function api(req, res, url) {
  const m = req.method, p = url.pathname;

  if (m === "GET" && p === "/api/config") {
    const { brand, authorName, telegram, freeGuidesUrl, enrollStart, enrollEnd, enrollmentOpen, capitals, stats, riskNote, hero } = db.settings;
    const pc = payCfg();
    return send(res, 200, { settings: { brand, authorName, telegram, freeGuidesUrl, enrollStart, enrollEnd, enrollmentOpen, capitals, stats, riskNote, hero }, payments: { ...methodsOn(), usdRate: pc.usdRate || 0 }, promos: db.promos.some((x) => x.active), plans: db.plans.map((p) => ({ ...p, image: versioned(p.image) })), lessons: db.lessons.map((l) => ({ ...l, image: versioned(l.image) })), audience: db.audience.map((a) => ({ ...a, image: versioned(a.image) })), results: db.results });
  }

  if (m === "POST" && p === "/api/track") {
    const b = await readJson(req);
    const ip = clientIp(req);
    if (limited("t:" + ip, 120, 36e5)) return send(res, 429, { error: "Ko‘p so‘rov" });
    const d = today();
    if (b.type === "view") db.stats.views[d] = (db.stats.views[d] || 0) + 1;
    else if (b.type === "click") {
      const pl = db.plans.find((x) => x.id === str(b.plan, 40)), plan = pl && planLabel(pl);
      if (plan) {
        db.stats.clicks[d] = db.stats.clicks[d] || {};
        db.stats.clicks[d][plan] = (db.stats.clicks[d][plan] || 0) + 1;
      }
    } else return send(res, 400, { error: "Noto‘g‘ri tur" });
    save();
    return send(res, 204);
  }

  if (m === "POST" && p === "/api/leads") {
    const b = await readJson(req);
    if (limited("l:" + clientIp(req), 5, 36e5)) return send(res, 429, { error: "Juda ko‘p ariza. Keyinroq urinib ko‘ring." });
    if (b.website) return send(res, 204); // honeypot
    if (b.consent !== true) return send(res, 400, { error: "Davom etish uchun shaxsiy ma’lumotlarni qayta ishlashga rozilik bering" });
    const name = str(b.name, 80), digits = String(b.phone ?? "").replace(/\D/g, "");
    if (name.length < 2) return send(res, 400, { error: "Ismingizni kiriting" });
    if (digits.length < 9 || digits.length > 15) return send(res, 400, { error: "Telefon raqamini to‘liq kiriting" });
    const username = str(b.username, 80).replace(/^(https?:\/\/)?(t\.me\/|telegram\.me\/)/i, "").replace(/^@/, "");
    if (username && !/^[A-Za-z0-9_]{3,32}$/.test(username)) return send(res, 400, { error: "Telegram username noto‘g‘ri (faqat lotin harf, raqam va _ )" });
    const capital = str(b.capital, 40);
    if (!db.settings.capitals.includes(capital)) return send(res, 400, { error: "Kapital miqdorini tanlang" });
    const city = str(b.city, 60);
    if (city.length < 2) return send(res, 400, { error: "Shaharni kiriting" });
    const format = ["Online", "Offlayn"].includes(b.format) ? b.format : "";
    if (!format) return send(res, 400, { error: "O‘qish formatini tanlang: Online yoki Offlayn" });
    const lead = { id: uid(), name, phone: fmtPhone(b.phone), username, capital, city, format, status: "new", adminNote: "", consent: true, tg: "pending", createdAt: new Date().toISOString() };
    db.leads.unshift(lead);
    if (db.leads.length > 5000) db.leads.length = 5000;
    save();
    notifyLead(lead).catch((e) => console.error("notifyLead:", e.message)); // javobni kutdirmaymiz
    return send(res, 201, { ok: true });
  }

  if (m === "POST" && p === "/api/promo") {
    const b = await readJson(req);
    if (limited("pr:" + clientIp(req), 30, 36e5)) return send(res, 429, { error: "Ko‘p urinish. Keyinroq qayta urinib ko‘ring." });
    const plan = db.plans.find((x) => x.id === str(b.plan, 40));
    if (!plan) return send(res, 400, { error: "Tarifni tanlang" });
    const r = applyPromo(b.code, plan);
    if (!r.ok) return send(res, 400, { error: r.error });
    return send(res, 200, { code: r.promo.code, discountCents: r.discountCents, amountCents: Math.round(plan.price * 100) - r.discountCents });
  }

  if (m === "POST" && p === "/api/orders") {
    const b = await readJson(req);
    if (b.website) return send(res, 204); // honeypot
    if (limited("o:" + clientIp(req), 8, 36e5)) return send(res, 429, { error: "Juda ko‘p buyurtma. Keyinroq urinib ko‘ring yoki menejerga yozing." });
    if (b.consent !== true) return send(res, 400, { error: "Davom etish uchun shaxsiy ma’lumotlarni qayta ishlashga rozilik bering" });
    const plan = db.plans.find((x) => x.id === str(b.plan, 40));
    if (!plan) return send(res, 400, { error: "Tarifni tanlang" });
    if (!plan.available) return send(res, 400, { error: "Bu tarif vaqtincha mavjud emas" });
    const name = str(b.name, 80), digits = String(b.phone ?? "").replace(/\D/g, "");
    if (name.length < 2) return send(res, 400, { error: "Ismingizni kiriting" });
    if (digits.length < 9 || digits.length > 15) return send(res, 400, { error: "Telefon raqamini to‘liq kiriting" });
    const username = str(b.username, 80).replace(/^(https?:\/\/)?(t\.me\/|telegram\.me\/)/i, "").replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) return send(res, 400, { error: "Telegram username kiriting (Whales guruhiga shu orqali qo‘shamiz)" });
    const city = str(b.city, 60);
    if (city.length < 2) return send(res, 400, { error: "Shaharni kiriting" });
    const capital = db.settings.capitals.includes(str(b.capital, 40)) ? str(b.capital, 40) : "";
    const on = methodsOn(), anyOn = on.usdt || on.card;
    const method = anyOn ? (["usdt", "card"].includes(b.method) && on[b.method] ? b.method : "") : "manager";
    if (!method) return send(res, 400, { error: "To‘lov usulini tanlang" });
    const priceCents = Math.round(plan.price * 100);
    let discountCents = 0, promo = "";
    if (str(b.promo, 20)) {
      const r = applyPromo(b.promo, plan);
      if (!r.ok) return send(res, 400, { error: r.error });
      discountCents = r.discountCents; promo = r.promo.code;
    }
    const amountCents = priceCents - discountCents, pc = payCfg();
    const o = { id: uid(), no: ++db.orderSeq, token: crypto.randomBytes(16).toString("hex"), name, phone: fmtPhone(b.phone), username, capital, city,
      format: plan.format === "offline" ? "Offlayn" : "Online", plan: plan.id, planName: planLabel(plan), priceCents, discountCents, promo, amountCents,
      method, payStatus: method === "manager" ? "none" : "pending", status: "new", adminNote: "", consent: true, tg: "pending", createdAt: new Date().toISOString() };
    if (method === "usdt") { o.payAddress = pc.usdtWallet; o.payCents = uniquePayCents(amountCents); }
    if (method === "card") { o.rate = pc.usdRate; o.paySom = Math.ceil(amountCents / 100 * pc.usdRate / 1000) * 1000; }
    db.leads.unshift(o);
    if (db.leads.length > 5000) db.leads.length = 5000;
    save();
    notifyLead(o).catch((e) => console.error("notifyLead:", e.message));
    if (method === "usdt") setTimeout(() => scanTick(true), 1000);
    return send(res, 201, { ...publicOrder(o), token: o.token });
  }
  const ord = /^\/api\/orders\/(\w+)(\/txid|\/receipt|\/paid|\/cancel)?$/.exec(p);
  if (ord) {
    const o = orderByToken(ord[1], url.searchParams.get("t") || "");
    if (!o) return send(res, 404, { error: "Buyurtma topilmadi" });
    if (m === "GET" && !ord[2]) return send(res, 200, publicOrder(o));
    if (m === "POST" && ord[2] === "/txid") {
      if (o.method !== "usdt") return send(res, 400, { error: "Bu buyurtma USDT orqali emas" });
      if (o.payStatus === "paid") return send(res, 200, publicOrder(o));
      if (limited("tx:" + clientIp(req), 20, 36e5)) return send(res, 429, { error: "Ko‘p urinish. Keyinroq qayta urinib ko‘ring." });
      const r = await claimTx(o, (await readJson(req)).txid);
      if (r.error) return send(res, 400, { error: r.error });
      return send(res, 200, { ...publicOrder(o), note: r.note || "" });
    }
    if (m === "POST" && ord[2] === "/receipt") {
      if (o.method !== "card") return send(res, 400, { error: "Bu buyurtma karta orqali emas" });
      if (o.payStatus === "paid") return send(res, 200, publicOrder(o));
      if (limited("rc:" + clientIp(req), 10, 36e5)) return send(res, 429, { error: "Ko‘p urinish. Keyinroq qayta urinib ko‘ring." });
      if (!/^image\/(jpeg|png|webp)$/.test(req.headers["content-type"] || "")) return send(res, 415, { error: "Chekni rasm (JPG yoki PNG) sifatida yuklang" });
      const buf = await readRaw(req, 6 * 1024 * 1024);
      const ext = sniffImage(buf);
      if (!ext || ext === "gif") return send(res, 400, { error: "Bu rasm fayli emas" });
      fs.mkdirSync(RECEIPT_DIR, { recursive: true });
      const fname = crypto.randomBytes(12).toString("hex") + "." + ext;
      fs.writeFileSync(path.join(RECEIPT_DIR, fname), buf);
      o.receipts = [...(o.receipts || []), fname].slice(-5); o.receipt = fname; save();
      // "To'lov qildim" bosilgandan keyin yangi chek yuklansa — adminga yana yuboramiz
      if (o.payStatus === "review") notifyReceipt(o, "Yangilangan chek");
      return send(res, 200, publicOrder(o));
    }
    if (m === "POST" && ord[2] === "/paid") {
      if (o.payStatus === "paid") return send(res, 200, publicOrder(o));
      if (!["pending", "review", "expired"].includes(o.payStatus)) return send(res, 400, { error: "Bu buyurtma faol emas" });
      if (limited("pd:" + clientIp(req), 20, 36e5)) return send(res, 429, { error: "Ko‘p urinish. Keyinroq qayta urinib ko‘ring." });
      if (o.method === "card") {
        if (!o.receipt) return send(res, 400, { error: "Avval to‘lov chekini yuklang" });
        if (o.payStatus !== "review") { o.payStatus = "review"; o.claimedAt = new Date().toISOString(); save(); notifyReceipt(o, "Karta to‘lovi — mijoz “To‘lov qildim” bosdi"); }
        return send(res, 200, publicOrder(o));
      }
      if (o.method === "usdt") {
        if (!o.claimedAt) { o.claimedAt = new Date().toISOString(); save(); tgNotify(`💬 <b>Mijoz “To‘lov qildim” bosdi</b> (USDT)\n${orderLine(o)}\nKutilgan summa: <b>${usdt(o.payCents)}</b>\n💬 @${htmlEsc(o.username)}\n\nHamyon avtomatik tekshirilmoqda.`); }
        await scanTick(true);
        return send(res, 200, { ...publicOrder(o), note: o.payStatus === "paid" ? "" : "Hamyon tekshirilmoqda. To‘lov tarmoqda tasdiqlangach (odatda 1–3 daqiqa) bu sahifa o‘zi yangilanadi." });
      }
      return send(res, 400, { error: "Bu buyurtma uchun kerak emas" });
    }
    if (m === "POST" && ord[2] === "/cancel") {
      if (o.payStatus === "pending") { o.payStatus = "cancelled"; save(); }
      return send(res, 200, publicOrder(o));
    }
    return send(res, 404, { error: "Topilmadi" });
  }

  /* ---- Admin ---- */
  if (m === "POST" && p === "/api/admin/login") {
    const ip = clientIp(req);
    if (limited("a:" + ip, 8, 15 * 6e4)) return send(res, 429, { error: "Ko‘p urinish. 15 daqiqadan keyin qayta urinib ko‘ring." });
    const b = await readJson(req);
    if (!checkPw(str(b.password, 200))) return send(res, 401, { error: "Parol noto‘g‘ri" });
    return send(res, 200, { ok: true, defaultPassword: !db.auth.passwordHash && !process.env.ADMIN_PASSWORD },
      { "Set-Cookie": cookie(makeToken(), 7 * 86400, req) });
  }
  if (!p.startsWith("/api/admin/")) return send(res, 404, { error: "Topilmadi" });
  if (m === "POST" && p === "/api/admin/logout") return send(res, 204, null, { "Set-Cookie": cookie("", 0, req) });
  if (!isAuthed(req)) return send(res, 401, { error: "Kirish kerak" });

  if (m === "GET" && p === "/api/admin/me") return send(res, 200, { ok: true, defaultPassword: !db.auth.passwordHash && !process.env.ADMIN_PASSWORD });
  if (m === "GET" && p === "/api/admin/telegram") return send(res, 200, { hasToken: !!tgToken(), hasChat: !!tgChat(), chatId: tgChat(), fromEnv: !!process.env.TELEGRAM_CHAT_ID, configured: tgConfigured() });
  if (m === "PUT" && p === "/api/admin/telegram/chat") {
    const id = str(String((await readJson(req)).id ?? ""), 30);
    if (!/^-?\d{3,20}$/.test(id)) return send(res, 400, { error: "Noto‘g‘ri chat ID" });
    db.settings.tgChatId = id; save();
    return send(res, 200, { ok: true });
  }
  if (m === "POST" && p === "/api/admin/telegram/test") {
    if (!tgConfigured()) return send(res, 400, { error: "Bot sozlanmagan: TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID kerak" });
    try { await tgCall("sendMessage", { chat_id: tgChat(), text: "✅ Test xabar: " + db.settings.brand + " admin paneli botga ulangan." }); return send(res, 200, { ok: true }); }
    catch (e) { return send(res, 502, { error: "Telegram: " + e.message }); }
  }
  if (m === "GET" && p === "/api/admin/telegram/chats") {
    if (!tgToken()) return send(res, 400, { error: "Avval TELEGRAM_BOT_TOKEN ni o‘rnating" });
    try {
      const ups = await tgCall("getUpdates", { limit: 100, allowed_updates: ["message", "channel_post", "my_chat_member"] });
      const chats = new Map();
      for (const u of ups) { const c = (u.message || u.channel_post || u.my_chat_member)?.chat; if (c) chats.set(c.id, { id: c.id, type: c.type, name: c.title || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || "" }); }
      return send(res, 200, { chats: [...chats.values()] });
    } catch (e) { return send(res, 502, { error: "Telegram: " + e.message }); }
  }
  const resend = /^\/api\/admin\/leads\/(\w+)\/resend$/.exec(p);
  if (m === "POST" && resend) {
    const l = db.leads.find((x) => x.id === resend[1]);
    if (!l) return send(res, 404, { error: "Ariza topilmadi" });
    await notifyLead(l);
    return send(res, 200, { tg: l.tg, tgError: l.tgError || "" });
  }
  if (m === "GET" && p === "/api/admin/dashboard") return send(res, 200, dashboard());
  if (m === "GET" && p === "/api/admin/leads") return send(res, 200, { leads: db.leads });
  if (m === "GET" && p === "/api/admin/all") return send(res, 200, { settings: db.settings, plans: db.plans, lessons: db.lessons, audience: db.audience, results: db.results, promos: db.promos, payments: payCfg(), methods: methodsOn(), featureLib: featureLibrary() });
  if (m === "PUT" && p === "/api/admin/rate") {
    const rate = Math.round(Number((await readJson(req)).rate) || 0);
    if (rate && (rate < 1000 || rate > 100000)) return send(res, 400, { error: "Kurs noto‘g‘ri (masalan 12400)" });
    db.settings.payments = { ...db.settings.payments, usdRate: rate }; save();
    return send(res, 200, payCfg());
  }
  if (m === "PUT" && p === "/api/admin/promos") { db.promos = cleanPromos((await readJson(req)).promos); save(); return send(res, 200, db.promos); }
  if (m === "GET" && p === "/api/admin/transfers") {
    return send(res, 200, { wallet: payCfg().usdtWallet, lastBlock: db.chain.lastBlock, lastScan: lastScan ? new Date(lastScan).toISOString() : "", error: scanError,
      unmatched: db.transfers.filter((t) => !t.orderId).slice(0, 50) });
  }
  if (m === "POST" && p === "/api/admin/scan") { await scanTick(true); return send(res, 200, { ok: !scanError, error: scanError, lastBlock: db.chain.lastBlock }); }
  if (m === "POST" && p === "/api/admin/transfers/assign") {
    const b = await readJson(req), t = db.transfers.find((x) => x.ref === str(b.ref, 100)), o = db.leads.find((x) => x.id === str(b.orderId, 20) && x.no);
    if (!t || t.orderId) return send(res, 400, { error: "O‘tkazma topilmadi yoki allaqachon biriktirilgan" });
    if (!o) return send(res, 400, { error: "Buyurtma topilmadi" });
    if (o.payStatus === "paid") return send(res, 400, { error: "Bu buyurtma allaqachon to‘langan" });
    t.orderId = o.id; markPaid(o, "USDT (admin biriktirdi)", { txid: t.tx, paidCents: t.cents });
    return send(res, 200, { ok: true, order: o });
  }
  const rcpt = /^\/api\/admin\/receipts\/([\w.]+)$/.exec(p);
  if (m === "GET" && rcpt) {
    const fp = cleanReceipt(rcpt[1]);
    if (!fp || !fs.existsSync(fp)) return send(res, 404, { error: "Topilmadi" });
    res.writeHead(200, { "Content-Type": IMG_MIME[path.extname(fp).slice(1)], "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" });
    return fs.createReadStream(fp).pipe(res);
  }

  const lead = /^\/api\/admin\/leads\/(\w+)$/.exec(p);
  if (lead) {
    const i = db.leads.findIndex((l) => l.id === lead[1]);
    if (i < 0) return send(res, 404, { error: "Ariza topilmadi" });
    if (m === "DELETE") { db.leads.splice(i, 1); save(); return send(res, 204); }
    if (m === "PATCH") {
      const b = await readJson(req);
      if (b.status !== undefined) {
        if (!["new", "contacted", "paid", "rejected"].includes(b.status)) return send(res, 400, { error: "Noto‘g‘ri status" });
        db.leads[i].status = b.status;
      }
      if (b.adminNote !== undefined) db.leads[i].adminNote = str(b.adminNote, 500);
      if (b.payStatus !== undefined && db.leads[i].no) {
        const o = db.leads[i];
        if (b.payStatus === "paid") { markPaid(o, "admin tasdiqladi"); return send(res, 200, o); }
        if (!["pending", "review", "expired", "cancelled", "none"].includes(b.payStatus)) return send(res, 400, { error: "Noto‘g‘ri to‘lov holati" });
        if (o.payStatus === "paid") { const pr = o.promo && findPromo(o.promo); if (pr && pr.used > 0) pr.used--; delete o.paidAt; if (o.status === "paid") o.status = "contacted"; }
        o.payStatus = b.payStatus;
      }
      save();
      return send(res, 200, db.leads[i]);
    }
  }

  if (m === "POST" && p === "/api/admin/upload") {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(req.headers["content-type"] || "")) return send(res, 415, { error: "Faqat JPG, PNG, WebP yoki GIF" });
    const buf = await readRaw(req, 4 * 1024 * 1024);
    const ext = sniffImage(buf);
    if (!ext) return send(res, 400, { error: "Bu rasm fayli emas" });
    const name = crypto.randomBytes(8).toString("hex") + "." + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return send(res, 201, { url: "/uploads/" + name });
  }
  if (m === "PUT" && p === "/api/admin/settings") { db.settings = cleanSettings(await readJson(req)); save(); return send(res, 200, db.settings); }
  if (m === "PUT" && p === "/api/admin/plans") {
    const b = await readJson(req);
    db.plans = cleanPlans(b.plans);
    if (Array.isArray(b.featureLib)) db.featureLib = strList(b.featureLib, 150);
    save(); return send(res, 200, db.plans);
  }
  if (m === "PUT" && p === "/api/admin/audience") {
    const a = (await readJson(req)).audience;
    if (!Array.isArray(a)) return send(res, 400, { error: "Noto‘g‘ri ro‘yxat" });
    db.audience = a.map((x) => (typeof x === "string" ? { t: str(x, 300), image: "" } : { t: str(x?.t, 300), image: cleanImg(x?.image) })).filter((x) => x.t).slice(0, 16);
    save(); return send(res, 200, db.audience);
  }
  if (m === "POST" && p === "/api/admin/audience/auto-images") { const count = autoAudienceImages(); return send(res, 200, { count, audience: db.audience }); }
  if (m === "POST" && p === "/api/admin/lessons/auto-images") { const count = autoLessonImages(); return send(res, 200, { count, lessons: db.lessons }); }
  if (m === "PUT" && p === "/api/admin/results") { db.results = cleanResults((await readJson(req)).results); save(); return send(res, 200, db.results); }
  if (m === "PUT" && p === "/api/admin/lessons") { db.lessons = cleanLessons((await readJson(req)).lessons); save(); return send(res, 200, db.lessons); }

  if (m === "POST" && p === "/api/admin/password") {
    const b = await readJson(req);
    if (!checkPw(str(b.current, 200))) return send(res, 401, { error: "Joriy parol noto‘g‘ri" });
    const next = str(b.next, 200);
    if (next.length < 8) return send(res, 400, { error: "Yangi parol kamida 8 belgi bo‘lsin" });
    db.auth.passwordHash = hashPw(next);
    db.auth.secret = crypto.randomBytes(32).toString("hex"); // eski sessiyalar bekor
    save();
    return send(res, 200, { ok: true }, { "Set-Cookie": cookie(makeToken(), 7 * 86400, req) });
  }

  return send(res, 404, { error: "Topilmadi" });
}

load();
setInterval(() => scanTick().catch(() => {}), (parseInt(process.env.BSC_SCAN_SECONDS, 10) || 20) * 1000).unref();
refreshCbuRate(); setInterval(refreshCbuRate, 6 * 36e5).unref();
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    // Bitta asosiy manzil (SEO): www va *.up.railway.app -> https://mamurjon.com (API'ga tegilmaydi)
    const host = String(req.headers.host || "").toLowerCase().split(":")[0], SITE = process.env.SITE_HOST || "mamurjon.com";
    if ((host === "www." + SITE || host.endsWith(".up.railway.app")) && (req.method === "GET" || req.method === "HEAD") && !url.pathname.startsWith("/api/")) {
      res.writeHead(301, { Location: `https://${SITE}${url.pathname}${url.search}`, "Cache-Control": "public, max-age=3600" }); return res.end();
    }
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (url.pathname.startsWith("/seed/")) {
      if (req.method !== "GET" || !SEED_RE.test(url.pathname)) return send(res, 404, "Topilmadi");
      const fp = path.join(SEED_DIR, path.basename(url.pathname));
      if (!fs.existsSync(fp)) return send(res, 404, "Topilmadi");
      const tag = etagOf(fp);
      if (req.headers["if-none-match"] === tag) { res.writeHead(304, { ETag: tag, "Cache-Control": "no-cache" }); return res.end(); }
      res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-cache", ETag: tag, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" });
      return fs.createReadStream(fp).pipe(res);
    }
    if (url.pathname.startsWith("/photos/")) { // sayt suratlari (assets/photos)
      if (req.method !== "GET" || !/^\/photos\/[a-z0-9-]+\.jpg$/.test(url.pathname)) return send(res, 404, "Topilmadi");
      const fp = path.join(__dirname, "assets", "photos", path.basename(url.pathname));
      if (!fs.existsSync(fp)) return send(res, 404, "Topilmadi");
      const tag = etagOf(fp);
      if (req.headers["if-none-match"] === tag) { res.writeHead(304, { ETag: tag, "Cache-Control": "public, max-age=86400" }); return res.end(); }
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", ETag: tag, "X-Content-Type-Options": "nosniff" });
      return fs.createReadStream(fp).pipe(res);
    }
    if (url.pathname.startsWith("/uploads/")) {
      if (req.method !== "GET" || !IMG_RE.test(url.pathname)) return send(res, 404, "Topilmadi");
      const fp = path.join(UPLOAD_DIR, path.basename(url.pathname));
      if (!fs.existsSync(fp)) return send(res, 404, "Topilmadi");
      res.writeHead(200, { "Content-Type": IMG_MIME[path.extname(fp).slice(1)], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
      return fs.createReadStream(fp).pipe(res);
    }
    const file = STATIC[url.pathname];
    if (!file || req.method !== "GET") return send(res, 404, "Topilmadi");
    const headers = { "Content-Type": MIME[path.extname(file)], "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache" };
    if (file === "admin.html") { headers["X-Frame-Options"] = "DENY"; headers["Referrer-Policy"] = "no-referrer"; headers["X-Robots-Tag"] = "noindex"; }
    const fp = path.join(__dirname, file), tag = etagOf(fp);
    headers.ETag = tag;
    if (file === "sitemap.xml") { // lastmod — sayt oxirgi yangilangan sana (deploy vaqti)
      const xml = fs.readFileSync(fp, "utf8").replace("<changefreq>", `<lastmod>${STARTED}</lastmod><changefreq>`);
      delete headers.ETag; res.writeHead(200, { ...headers, "Cache-Control": "public, max-age=3600" }); return res.end(xml);
    }
    if (file === "index.html" || file === "admin.html") { // css/js manzillariga versiya — telefon eski faylni xotiradan olmasin
      const ver = (n) => etagOf(path.join(__dirname, n)).slice(1, 9);
      // Google Search Console tasdiqlash kodi (GOOGLE_SITE_VERIFICATION) — faqat bosh sahifaga
      const gsv = file === "index.html" ? String(process.env.GOOGLE_SITE_VERIFICATION || "").replace(/^.*content="([^"]+)".*$/s, "$1").replace(/[^\w-]/g, "").slice(0, 100) : "";
      const html = fs.readFileSync(fp, "utf8").replace("</title>", gsv ? `</title>\n  <meta name="google-site-verification" content="${gsv}" />` : "</title>").replace(/(href|src)="\/?(styles\.css|script\.js|fx\.js|admin\.css|admin\.js)"/g, (m0, a, n) => `${a}="/${n}?v=${ver(n)}"`);
      const htag = `"${crypto.createHash("sha1").update(html).digest("hex").slice(0, 16)}"`;
      if (req.headers["if-none-match"] === htag) { res.writeHead(304, { ETag: htag, "Cache-Control": "no-cache" }); return res.end(); }
      res.writeHead(200, { ...headers, ETag: htag });
      return res.end(html);
    }
    if (req.headers["if-none-match"] === tag) { res.writeHead(304, { ETag: tag, "Cache-Control": "no-cache" }); return res.end(); }
    res.writeHead(200, headers);
    fs.createReadStream(fp).pipe(res);
  } catch (e) {
    const code = e.code >= 400 && e.code < 600 ? e.code : 500;
    if (code === 500) console.error(e);
    if (!res.headersSent) send(res, code, { error: code === 500 ? "Server xatosi" : e.message });
  }
}).listen(PORT, () => {
  console.log(`Mamurjon | MT: http://localhost:${PORT}   admin: http://localhost:${PORT}/admin`);
  if (!tgConfigured()) console.warn("⚠️  Telegram bot sozlanmagan (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID) — arizalar faqat admin panelda saqlanadi.");
  if (!db.auth.passwordHash && !process.env.ADMIN_PASSWORD) console.warn("⚠️  ADMIN_PASSWORD berilmagan — vaqtinchalik parol: admin123. Uni o‘zgartiring!");
});
