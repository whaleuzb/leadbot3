/* =========================================================
   Mamurjon | MT — server (Node >= 18, tashqi kutubxonasiz)
   - Statik fayllar (landing + admin)
   - Ochiq API: /api/config, /api/leads (POST), /api/track (POST)
   - Admin API: /api/admin/* (parol + imzolangan cookie)
   Muhit o'zgaruvchilari:
     PORT            (default 3000)
     ADMIN_PASSWORD  boshlang'ich parol (default: admin123 — DARHOL o'zgartiring!)
     DATA_DIR        ma'lumotlar papkasi (default ./data; Railway'da Volume ulang)
   ========================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const IMG_RE = /^\/uploads\/[a-f0-9]{16}\.(jpg|png|webp|gif)$/;
const IMG_MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
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
function leadText(l) {
  const line = "━━━━━━━━━━━━━━";
  return [`🆕 Yangi lid — ${htmlEsc(db.settings.brand)} Community kurs`, line,
    `👤 Ism: ${htmlEsc(l.name)}`, `📞 Tel: ${htmlEsc(l.phone)}`, `💬 Telegram: ${htmlEsc(l.username || "—")}`,
    `💰 Kapital: ${htmlEsc(l.capital || "—")}`, `🏙 Shahar: ${htmlEsc(l.city || "—")}`, `🎓 Format: ${htmlEsc(l.format || "—")}`, `🕐 Vaqt: ${tashkentFull(l.createdAt)}`, line].join("\n");
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
const cleanImg = (v) => (typeof v === "string" && (IMG_RE.test(v) || (/^\/seed\/[a-z0-9-]+\.svg$/.test(v) && fs.existsSync(path.join(__dirname, "assets", "seed", v.slice(6))))) ? v : "");
const STATIC = {
  "/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css", "/script.js": "script.js", "/fx.js": "fx.js",
  "/admin": "admin.html", "/admin.html": "admin.html", "/admin.css": "admin.css", "/admin.js": "admin.js",
};
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

/* ---------- Boshlang'ich ma'lumotlar ---------- */
const BASE_FEATURES = [
  "Treyding asoslari: bozor, aktivlar, brokerlar, terminal",
  "Texnik tahlil: trend, daraja, sham formatsiyalari, hajm",
  "Risk-menejment: pozitsiya hajmi, stop-loss, risk/foyda",
  "Shaxsiy treyding strategiyasini qurish bo‘yicha darslar",
  "Treyder psixologiyasi: qo‘rquv va ochko‘zlikni boshqarish",
  "Treyding jurnali shabloni va bitimlarni tahlil qilish",
  "Demo hisobda amaliy topshiriqlar",
  "Community davomiyligi — 2 oy",
];
function defaults() {
  return {
    settings: {
      brand: "Mamurjon | MT",
      authorName: "[Ismingiz]",
      telegram: "managermtuz",
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
      riskNote: "Treyding — yuqori xavfli faoliyat, kapitalingizning bir qismini yoki hammasini yo‘qotishingiz mumkin. Ushbu community ta’lim maqsadida va moliyaviy maslahat emas; o‘tgan natijalar kelajakdagi daromadni kafolatlamaydi. Faqat yo‘qotishga tayyor bo‘lgan mablag‘ bilan savdo qiling.",
    },
    plans: [
      { id: "mini", eyebrow: "01 / MUSTAQIL", badge: "", name: "Mini", description: "O‘z ritmida o‘rganishni istaganlar uchun. Chat va kurator nazoratisiz", duration: "Community 2 oy", featured: false, features: [...BASE_FEATURES], excluded: ["Umumiy chat va kurator yordamisiz"] },
      { id: "pro", eyebrow: "02 / BIRGALIKDA", badge: "CHAT + QO‘LLAB-QUVVATLASH", name: "Community Pro", description: "Umumiy chatda muhokamalar va kurator nazorati ostida topshiriqlarni bajarish.", duration: "community 2 oy · materiallar 4 oy", featured: true, features: [...BASE_FEATURES, "Barcha materiallarga kirish — 4 oy", "Ishtirokchilar uchun umumiy chat", "Kurator bilan aloqa va qo‘llab-quvvatlash", "Haftalik bozor sharhi va tahlili", "2 ta guruhli savol-javob videoqo‘ng‘irog‘i"], excluded: [] },
      { id: "individual", eyebrow: "03 / SHAXSIY", badge: "10 TA JOY", name: "Individual", description: "Mentor nazorati ostida ishlash, individual tavsiyalar va bitimlaringiz xatolari ustida ishlash (online)", duration: "community 2 oy · materiallar 7 oy", featured: true, features: [...BASE_FEATURES, "Barcha materiallarga kirish — 7 oy", "Ishtirokchilar uchun umumiy chat", "Mentor bilan shaxsiy aloqa va qo‘llab-quvvatlash", "Treyding jurnalingizni individual tahlil qilish", "6 ta guruhli savol-javob videoqo‘ng‘irog‘i"], excluded: [] },
    ],
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
    leads: [],
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
  const byId = { mini: "plan-mini", pro: "plan-pro", individual: "plan-individual" }, order = ["plan-mini", "plan-pro", "plan-individual"];
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
    req.on("data", (c) => { size += c.length; if (size > max) { reject(Object.assign(new Error("Rasm juda katta (4 MB dan oshmasin)"), { code: 413 })); req.destroy(); } else chunks.push(c); });
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
    enrollStart: isDate(s.enrollStart) ? s.enrollStart : cur.enrollStart,
    enrollEnd: isDate(s.enrollEnd) ? s.enrollEnd : cur.enrollEnd,
    enrollmentOpen: typeof s.enrollmentOpen === "boolean" ? s.enrollmentOpen : cur.enrollmentOpen,
    tgChatId: cur.tgChatId || "",
    capitals: Array.isArray(s.capitals) && s.capitals.some((x) => str(x, 40)) ? s.capitals.map((x) => str(x, 40)).filter(Boolean).slice(0, 8) : cur.capitals,
    stats,
    riskNote: str(s.riskNote, 1200) || cur.riskNote,
    hero: cleanHero(s.hero, cur.hero),
  };
}
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
    };
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
    const k = l.capital || l.plan || "—"; byPlan[k] = (byPlan[k] || 0) + 1;
  }
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const clicksByPlan = {};
  let clicksTotal = 0;
  for (const d of Object.values(db.stats.clicks)) for (const [k, v] of Object.entries(d)) { clicksByPlan[k] = (clicksByPlan[k] || 0) + v; clicksTotal += v; }
  const viewsTotal = sum(db.stats.views);
  return {
    totals: { views: viewsTotal, clicks: clicksTotal, leads: db.leads.length, paid: byStatus.paid,
      conversion: viewsTotal ? +(db.leads.length / viewsTotal * 100).toFixed(1) : 0 },
    byStatus, byPlan, clicksByPlan,
    series: days.map((d) => ({ date: d, views: db.stats.views[d] || 0, leads: leadsByDay[d] || 0 })),
  };
}

/* ---------- Marshrutlar ---------- */
async function api(req, res, url) {
  const m = req.method, p = url.pathname;

  if (m === "GET" && p === "/api/config") {
    const { brand, authorName, telegram, enrollStart, enrollEnd, enrollmentOpen, capitals, stats, riskNote, hero } = db.settings;
    return send(res, 200, { settings: { brand, authorName, telegram, enrollStart, enrollEnd, enrollmentOpen, capitals, stats, riskNote, hero }, plans: db.plans.map(({ price, oldPrice, discountUntil, ...rest }) => ({ ...rest, image: versioned(rest.image) })), lessons: db.lessons.map((l) => ({ ...l, image: versioned(l.image) })), audience: db.audience.map((a) => ({ ...a, image: versioned(a.image) })), results: db.results });
  }

  if (m === "POST" && p === "/api/track") {
    const b = await readJson(req);
    const ip = clientIp(req);
    if (limited("t:" + ip, 120, 36e5)) return send(res, 429, { error: "Ko‘p so‘rov" });
    const d = today();
    if (b.type === "view") db.stats.views[d] = (db.stats.views[d] || 0) + 1;
    else if (b.type === "click") {
      const plan = str(b.plan, 40);
      if (db.plans.some((x) => x.name === plan)) {
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
  if (m === "GET" && p === "/api/admin/all") return send(res, 200, { settings: db.settings, plans: db.plans, lessons: db.lessons, audience: db.audience, results: db.results });

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
  if (m === "PUT" && p === "/api/admin/plans") { db.plans = cleanPlans((await readJson(req)).plans); save(); return send(res, 200, db.plans); }
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
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
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
