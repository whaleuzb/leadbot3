/* =========================================================
   trademove — server (Node >= 18, tashqi kutubxonasiz)
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
const STATIC = {
  "/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css", "/script.js": "script.js",
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
      brand: "trademove",
      authorName: "[Ismingiz]",
      telegram: "managermtuz",
      enrollStart: "2026-09-30T00:00:00+05:00",
      enrollEnd: "2026-10-10T23:59:00+05:00",
      enrollmentOpen: true,
      stats: [
        { value: "3+ yil", label: "bozor tajribasi" },
        { value: "1:2", label: "minimal risk / foyda nisbati" },
        { value: "1–2%", label: "bitimga maksimal risk" },
        { value: "100%", label: "jurnal bilan nazorat" },
      ],
      riskNote: "Treyding — yuqori xavfli faoliyat, kapitalingizning bir qismini yoki hammasini yo‘qotishingiz mumkin. Ushbu community ta’lim maqsadida va moliyaviy maslahat emas; o‘tgan natijalar kelajakdagi daromadni kafolatlamaydi. Faqat yo‘qotishga tayyor bo‘lgan mablag‘ bilan savdo qiling.",
    },
    plans: [
      { id: "mini", eyebrow: "01 / MUSTAQIL", badge: "", name: "Mini", description: "O‘z ritmida o‘rganishni istaganlar uchun. Chat va kurator nazoratisiz", price: 699000, duration: "Community 2 oy", featured: false, features: [...BASE_FEATURES], excluded: ["Umumiy chat va kurator yordamisiz"] },
      { id: "pro", eyebrow: "02 / BIRGALIKDA", badge: "CHAT + QO‘LLAB-QUVVATLASH", name: "Community Pro", description: "Umumiy chatda muhokamalar va kurator nazorati ostida topshiriqlarni bajarish.", price: 1199000, duration: "community 2 oy · materiallar 4 oy", featured: true, features: [...BASE_FEATURES, "Barcha materiallarga kirish — 4 oy", "Ishtirokchilar uchun umumiy chat", "Kurator bilan aloqa va qo‘llab-quvvatlash", "Haftalik bozor sharhi va tahlili", "2 ta guruhli savol-javob videoqo‘ng‘irog‘i"], excluded: [] },
      { id: "individual", eyebrow: "03 / SHAXSIY", badge: "10 TA JOY", name: "Individual", description: "Mentor nazorati ostida ishlash, individual tavsiyalar va bitimlaringiz xatolari ustida ishlash (online)", price: 3499000, duration: "community 2 oy · materiallar 7 oy", featured: true, features: [...BASE_FEATURES, "Barcha materiallarga kirish — 7 oy", "Ishtirokchilar uchun umumiy chat", "Mentor bilan shaxsiy aloqa va qo‘llab-quvvatlash", "Treyding jurnalingizni individual tahlil qilish", "6 ta guruhli savol-javob videoqo‘ng‘irog‘i"], excluded: [] },
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
    leads: [],
    stats: { views: {}, clicks: {} }, // views: {sana: n}, clicks: {sana: {tarif: n}}
    auth: { secret: crypto.randomBytes(32).toString("hex"), passwordHash: null },
  };
}

/* ---------- Saqlash ---------- */
let db;
function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { db = defaults(); save(); }
  const d = defaults();
  for (const k of Object.keys(d)) if (db[k] === undefined) db[k] = d[k];
  db.auth.secret = db.auth.secret || d.auth.secret;
  // eski namunaviy username o'zgartirilmagan bo'lsa — yangisiga almashtiramiz
  if (db.settings.telegram === "trademove_admin") { db.settings.telegram = d.settings.telegram; save(); }
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
    stats,
    riskNote: str(s.riskNote, 1200) || cur.riskNote,
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
    const price = Math.round(Number(p.price));
    return {
      id, eyebrow: str(p.eyebrow, 40), badge: str(p.badge, 40),
      name: str(p.name, 40) || "Tarif", description: str(p.description, 300),
      price: Number.isFinite(price) && price >= 0 ? price : 0,
      duration: str(p.duration, 80), featured: !!p.featured,
      features: strList(p.features), excluded: strList(p.excluded, 10),
    };
  });
}
function cleanLessons(arr) {
  if (!Array.isArray(arr)) throw Object.assign(new Error("Noto‘g‘ri ro‘yxat"), { code: 400 });
  return arr.slice(0, 20).map((l, i) => ({ n: String(i + 1).padStart(2, "0"), t: str(l.t, 50) || "Dars", d: str(l.d, 100) }));
}

/* ---------- Dashboard ---------- */
function dashboard() {
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() + 5 * 36e5 - i * 864e5).toISOString().slice(0, 10));
  const leadsByDay = {};
  for (const l of db.leads) { const d = l.createdAt.slice(0, 10); leadsByDay[d] = (leadsByDay[d] || 0) + 1; }
  const byStatus = { new: 0, contacted: 0, paid: 0, rejected: 0 };
  const byPlan = {};
  let revenue = 0;
  const priceOf = (name) => db.plans.find((p) => p.name === name)?.price || 0;
  for (const l of db.leads) {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    byPlan[l.plan || "—"] = (byPlan[l.plan || "—"] || 0) + 1;
    if (l.status === "paid") revenue += priceOf(l.plan);
  }
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const clicksByPlan = {};
  let clicksTotal = 0;
  for (const d of Object.values(db.stats.clicks)) for (const [k, v] of Object.entries(d)) { clicksByPlan[k] = (clicksByPlan[k] || 0) + v; clicksTotal += v; }
  const viewsTotal = sum(db.stats.views);
  return {
    totals: { views: viewsTotal, clicks: clicksTotal, leads: db.leads.length, paid: byStatus.paid, revenue,
      conversion: viewsTotal ? +(db.leads.length / viewsTotal * 100).toFixed(1) : 0 },
    byStatus, byPlan, clicksByPlan,
    series: days.map((d) => ({ date: d, views: db.stats.views[d] || 0, leads: leadsByDay[d] || 0 })),
  };
}

/* ---------- Marshrutlar ---------- */
async function api(req, res, url) {
  const m = req.method, p = url.pathname;

  if (m === "GET" && p === "/api/config") {
    const { brand, authorName, telegram, enrollStart, enrollEnd, enrollmentOpen, stats, riskNote } = db.settings;
    return send(res, 200, { settings: { brand, authorName, telegram, enrollStart, enrollEnd, enrollmentOpen, stats, riskNote }, plans: db.plans, lessons: db.lessons, audience: db.audience });
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
    const name = str(b.name, 80), phone = str(b.phone, 30), plan = str(b.plan, 40);
    if (name.length < 2) return send(res, 400, { error: "Ismingizni kiriting" });
    if (phone.replace(/\D/g, "").length < 9) return send(res, 400, { error: "Telefon raqamini to‘liq kiriting" });
    db.leads.unshift({ id: uid(), name, phone, plan, note: str(b.note, 300), status: "new", adminNote: "", consent: true, createdAt: new Date().toISOString() });
    if (db.leads.length > 5000) db.leads.length = 5000;
    save();
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
  if (m === "GET" && p === "/api/admin/dashboard") return send(res, 200, dashboard());
  if (m === "GET" && p === "/api/admin/leads") return send(res, 200, { leads: db.leads });
  if (m === "GET" && p === "/api/admin/all") return send(res, 200, { settings: db.settings, plans: db.plans, lessons: db.lessons, audience: db.audience });

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

  if (m === "PUT" && p === "/api/admin/settings") { db.settings = cleanSettings(await readJson(req)); save(); return send(res, 200, db.settings); }
  if (m === "PUT" && p === "/api/admin/plans") { db.plans = cleanPlans((await readJson(req)).plans); save(); return send(res, 200, db.plans); }
  if (m === "PUT" && p === "/api/admin/audience") {
    const a = (await readJson(req)).audience;
    if (!Array.isArray(a)) return send(res, 400, { error: "Noto‘g‘ri ro‘yxat" });
    db.audience = a.map((x) => str(x, 300)).filter(Boolean).slice(0, 16);
    save(); return send(res, 200, db.audience);
  }
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
    const file = STATIC[url.pathname];
    if (!file || req.method !== "GET") return send(res, 404, "Topilmadi");
    const headers = { "Content-Type": MIME[path.extname(file)], "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache" };
    if (file === "admin.html") { headers["X-Frame-Options"] = "DENY"; headers["Referrer-Policy"] = "no-referrer"; headers["X-Robots-Tag"] = "noindex"; }
    res.writeHead(200, headers);
    fs.createReadStream(path.join(__dirname, file)).pipe(res);
  } catch (e) {
    const code = e.code >= 400 && e.code < 600 ? e.code : 500;
    if (code === 500) console.error(e);
    if (!res.headersSent) send(res, code, { error: code === 500 ? "Server xatosi" : e.message });
  }
}).listen(PORT, () => {
  console.log(`trademove: http://localhost:${PORT}   admin: http://localhost:${PORT}/admin`);
  if (!db.auth.passwordHash && !process.env.ADMIN_PASSWORD) console.warn("⚠️  ADMIN_PASSWORD berilmagan — vaqtinchalik parol: admin123. Uni o‘zgartiring!");
});
