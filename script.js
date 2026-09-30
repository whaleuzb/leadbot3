/* =========================================================
   trademove — interaktivlik
   1) Tariflar  2) Mobil akkordeon  3) Galereya  4) Countdown  5) Hero sham grafigi
   ========================================================= */

let TELEGRAM = "managermtuz"; // ⚠️ Menejer Telegram username'ini yozing

// Qabul sanalari (Toshkent vaqti)
let ENROLL_START = "2026-09-30T00:00:00+05:00";
let ENROLL_END   = "2026-10-10T23:59:00+05:00";

const ARROW = '<svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M9 5h10v10"/></svg>';

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

let PLANS = [
  {
    eyebrow: "01 / MUSTAQIL",
    name: "Mini",
    description: "O‘z ritmida o‘rganishni istaganlar uchun. Chat va kurator nazoratisiz",
    price: "699 000",
    duration: "Community 2 oy",
    featured: false,
    features: [...BASE_FEATURES],
    excluded: ["Umumiy chat va kurator yordamisiz"],
  },
  {
    eyebrow: "02 / BIRGALIKDA",
    badge: "CHAT + QO‘LLAB-QUVVATLASH",
    name: "Community Pro",
    description: "Umumiy chatda muhokamalar va kurator nazorati ostida topshiriqlarni bajarish.",
    price: "1 199 000",
    duration: "community 2 oy · materiallar 4 oy",
    featured: true,
    features: [
      ...BASE_FEATURES,
      "Barcha materiallarga kirish — 4 oy",
      "Ishtirokchilar uchun umumiy chat",
      "Kurator bilan aloqa va qo‘llab-quvvatlash",
      "Haftalik bozor sharhi va tahlili",
      "2 ta guruhli savol-javob videoqo‘ng‘irog‘i",
    ],
  },
  {
    eyebrow: "03 / SHAXSIY",
    badge: "10 TA JOY",
    name: "Individual",
    description: "Mentor nazorati ostida ishlash, individual tavsiyalar va bitimlaringiz xatolari ustida ishlash (online)",
    price: "3 499 000",
    duration: "community 2 oy · materiallar 7 oy",
    featured: true,
    features: [
      ...BASE_FEATURES,
      "Barcha materiallarga kirish — 7 oy",
      "Ishtirokchilar uchun umumiy chat",
      "Mentor bilan shaxsiy aloqa va qo‘llab-quvvatlash",
      "Treyding jurnalingizni individual tahlil qilish",
      "6 ta guruhli savol-javob videoqo‘ng‘irog‘i",
    ],
  },
];

let LESSONS = [
  { n: "01", t: "Bozor tuzilishi", d: "Trend, diapazon, likvidlik" },
  { n: "02", t: "Daraja va zonalar", d: "Support / resistance qanday chiziladi" },
  { n: "03", t: "Risk-menejment", d: "Pozitsiya hajmi va stop-loss" },
  { n: "04", t: "Treyding rejasi", d: "Kirish, chiqish, shartlar" },
  { n: "05", t: "Psixologiya", d: "Hissiyotlarni nazorat qilish" },
];

let ENROLL_OPEN = true;
let AUDIENCE = null;
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtPrice = (p) => (typeof p === "number" ? p.toLocaleString("ru-RU").replace(/\u00a0/g, " ") : p);

function telegramLink(text) {
  return `https://t.me/${TELEGRAM}?text=${encodeURIComponent(text)}`;
}
const planLink = (name) =>
  telegramLink(`Tarif: ${name}\n\nAssalomu alaykum! «${name}» tarifini sotib olmoqchiman. To‘lovni qanday amalga oshirish mumkin?`);

function featureList(plan) {
  const ok = plan.features.map((f) => `<li><span>✓</span>${esc(f)}</li>`).join("");
  const no = (plan.excluded || []).map((f) => `<li class="excluded"><span>×</span>${esc(f)}</li>`).join("");
  return `<ul>${ok}${no}</ul>`;
}

/* ---------- 1) Tariflar ---------- */
function renderPlans() {
  const grid = document.getElementById("plans-grid");
  if (!grid) return;
  grid.innerHTML = PLANS.map((p, i) => `
    <article class="plan ${p.featured ? "featured" : ""}">
      <div class="plan-top">
        <p class="eyebrow">${esc(p.eyebrow)}</p>
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
      </div>
      <h3>${esc(p.name)}</h3>
      <p class="plan-description">${esc(p.description)}</p>
      <p class="price">${fmtPrice(p.price)} <small>so‘m</small></p>
      <p class="duration">${esc(p.duration)}</p>
      <a class="button" target="_blank" rel="noopener noreferrer" href="${planLink(p.name)}" data-plan="${esc(p.name)}">Sotib olish${ARROW}</a>
      <p class="telegram-note">Telegram orqali · Menejer</p>
      <div class="desktop-features">${featureList(p)}</div>
      <div class="mobile-features">
        <button type="button" class="features-toggle" aria-expanded="false" aria-controls="features-${i}">
          Tarifga nimalar kiradi?<span>+</span>
        </button>
        <div id="features-${i}" hidden>${featureList(p)}</div>
      </div>
    </article>`).join("");

  /* ---------- 2) Mobil akkordeon ---------- */
  grid.querySelectorAll(".features-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      btn.querySelector("span").textContent = open ? "+" : "−";
      panel.hidden = open;
    });
  });
}

/* ---------- 3) Community galereyasi ---------- */
function initGallery() {
  const track = document.getElementById("galleryTrack");
  const gallery = track?.closest(".community-gallery");
  if (!track || !gallery) return;

  const bars = (seed) => {
    let x = seed, out = "";
    for (let i = 0; i < 14; i++) {
      x = (x * 9301 + 49297) % 233280;
      const h = 20 + Math.round((x / 233280) * 70);
      out += `<i style="height:${h}%"></i>`;
    }
    return out;
  };
  const group = (hidden) =>
    `<div class="gallery-group"${hidden ? ' aria-hidden="true"' : ""}>` +
    LESSONS.map((l, i) =>
      `<figure class="community-shot lesson-card">
         <span class="lesson-n">${esc(l.n)}</span>
         <div class="lesson-bars" aria-hidden="true">${bars(i + 3)}</div>
         <figcaption><strong>${esc(l.t)}</strong><span>${esc(l.d)}</span></figcaption>
       </figure>`).join("") + "</div>";

  track.innerHTML = group(true) + group(false) + group(true);

  const groupWidth = () => track.firstElementChild.getBoundingClientRect().width;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  requestAnimationFrame(() => { gallery.scrollLeft = groupWidth(); });

  const wrap = () => {
    const w = groupWidth();
    if (gallery.scrollLeft >= w * 2) gallery.scrollLeft -= w;
    else if (gallery.scrollLeft <= 0) gallery.scrollLeft += w;
  };

  let paused = false, dragging = false, startX = 0, startScroll = 0, resumeTimer;
  const pause = () => { paused = true; clearTimeout(resumeTimer); };
  const resume = (ms = 1500) => { clearTimeout(resumeTimer); resumeTimer = setTimeout(() => (paused = false), ms); };

  let last = performance.now();
  const tick = (now) => {
    const dt = now - last; last = now;
    if (!paused && !dragging && !reduce) { gallery.scrollLeft += dt * 0.04; wrap(); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  gallery.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    dragging = true; startX = e.clientX; startScroll = gallery.scrollLeft;
    gallery.setPointerCapture(e.pointerId);
  });
  gallery.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    gallery.scrollLeft = startScroll - (e.clientX - startX);
    wrap();
  });
  const endDrag = () => { if (dragging) { dragging = false; resume(); } };
  gallery.addEventListener("pointerup", endDrag);
  gallery.addEventListener("pointercancel", endDrag);
  gallery.addEventListener("mouseenter", pause);
  gallery.addEventListener("mouseleave", () => resume(300));
  gallery.addEventListener("touchstart", pause, { passive: true });
  gallery.addEventListener("touchend", () => resume(2000), { passive: true });
  gallery.addEventListener("scroll", wrap, { passive: true });
  gallery.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { gallery.scrollBy({ left: 300, behavior: "smooth" }); pause(); resume(); }
    if (e.key === "ArrowLeft")  { gallery.scrollBy({ left: -300, behavior: "smooth" }); pause(); resume(); }
  });
}

/* ---------- 4) Countdown ---------- */
let cdTimer;
function initCountdown() {
  const START = new Date(ENROLL_START).getTime();
  const END = new Date(ENROLL_END).getTime();
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (t) => {
    const d = new Date(t + 5 * 36e5); // Toshkent (UTC+5)
    return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  };

  $("cd-range").textContent = `${fmt(START)} — ${fmt(END)}`;
  $("cd-open").textContent = `Qabul boshlandi: ${fmt(START)}`;
  const endD = new Date(END + 5 * 36e5);
  $("cd-close").textContent = `Yopilish: ${fmt(END)} · ${pad(endD.getUTCHours())}:${pad(endD.getUTCMinutes())} · Toshkent vaqti`;

  const update = () => {
    const now = Date.now();
    let diff = Math.max(0, END - now);
    let d = Math.floor(diff / 864e5); diff -= d * 864e5;
    let h = Math.floor(diff / 36e5);  diff -= h * 36e5;
    let m = Math.floor(diff / 6e4);   diff -= m * 6e4;
    let s = Math.floor(diff / 1e3);
    if (!ENROLL_OPEN) { d = h = m = s = 0; }
    $("cd-days").textContent = pad(d);
    $("cd-hours").textContent = pad(h);
    $("cd-mins").textContent = pad(m);
    $("cd-secs").textContent = pad(s);
    $("cd-progress").style.width = Math.min(100, Math.max(0, ((now - START) / (END - START)) * 100)) + "%";
    if (!ENROLL_OPEN || now >= END) $("countdown-status").textContent = "Qabul yakunlandi. Keyingi oqim haqida menejerga yozing.";
  };
  update();
  clearInterval(cdTimer);
  cdTimer = setInterval(update, 1000);
}

/* ---------- 5) Hero sham grafigi (bezak) ---------- */
function initCandles() {
  const g = document.getElementById("candles");
  if (!g) return;
  let x = 7, price = 230, out = "";
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 22; i++) {
    const cx = 22 + i * 17;
    const open = price;
    const close = price - 4 - (rnd() - 0.32) * 26; // umumiy o'sish trendi
    const hi = Math.min(open, close) - rnd() * 12 - 3;
    const lo = Math.max(open, close) + rnd() * 12 + 3;
    price = close;
    const up = close < open;
    const col = up ? "#bba5fa" : "#6d6577";
    const y = Math.min(open, close), hgt = Math.max(3, Math.abs(open - close));
    out += `<line x1="${cx}" x2="${cx}" y1="${hi.toFixed(1)}" y2="${lo.toFixed(1)}" stroke="${col}" stroke-width="1.5"/>` +
           `<rect x="${cx - 5}" y="${y.toFixed(1)}" width="10" height="${hgt.toFixed(1)}" rx="2" fill="${col}"/>`;
  }
  g.innerHTML = out;
}

function renderAudience() {
  const ol = document.getElementById("audience-grid");
  if (!ol || !AUDIENCE) return;
  ol.innerHTML = AUDIENCE.map((t, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><p>${esc(t)}</p></li>`).join("");
}

/* ---------- 6) Server ma'lumotlari, kuzatuv, ariza formasi ---------- */
function applyHero(h) {
  if (!h) return;
  const set = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };
  const br = (t) => esc(t).replace(/\n/g, "<br>");
  set("hero-eyebrow", esc(h.eyebrow));
  set("hero-title", `${br(h.title1)}<br><em>${br(h.accent)}</em><br>${br(h.title3)}`);
  set("hero-intro", esc(h.intro));
  set("hero-note", esc(h.note));
  set("hero-clabel", esc(h.captionLabel));
  set("hero-caption", br(h.caption));
}

async function loadConfig() {
  try {
    const r = await fetch("/api/config", { cache: "no-store" });
    if (!r.ok) throw new Error();
    const { settings: s, plans, lessons, audience } = await r.json();
    TELEGRAM = s.telegram; ENROLL_START = s.enrollStart; ENROLL_END = s.enrollEnd; ENROLL_OPEN = s.enrollmentOpen !== false;
    if (plans?.length) PLANS = plans;
    if (lessons) LESSONS = lessons;
    if (Array.isArray(audience) && audience.length) AUDIENCE = audience;
    document.title = `${s.brand} — Treydingni tizim bilan o‘rgan`;
    document.querySelectorAll(".js-brand").forEach((e) => (e.textContent = s.brand));
    document.querySelectorAll(".js-author").forEach((e) => (e.textContent = s.authorName));
    const grid = document.getElementById("stats-grid");
    if (grid) grid.innerHTML = s.stats.map((x) => `<div><strong>${esc(x.value)}</strong><span>${esc(x.label)}</span></div>`).join("");
    applyHero(s.hero);
    const risk = document.getElementById("risk-text");
    if (risk) risk.textContent = s.riskNote;
  } catch { /* server yo'q — standart ma'lumotlar bilan ishlaydi */ }
}
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });

function initTracking() {
  try {
    if (!sessionStorage.getItem("tm_view")) { sessionStorage.setItem("tm_view", "1"); post("/api/track", { type: "view" }).catch(() => {}); }
  } catch { post("/api/track", { type: "view" }).catch(() => {}); }
  document.getElementById("plans-grid")?.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-plan]");
    if (a) post("/api/track", { type: "click", plan: a.dataset.plan }).catch(() => {});
  });
}

function initLeadForm() {
  const form = document.getElementById("lead-form");
  if (!form) return;
  const sel = document.getElementById("lf-plan"), msg = document.getElementById("lf-msg");
  sel.innerHTML = PLANS.map((p) => `<option>${esc(p.name)}</option>`).join("");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button"), fd = new FormData(form);
    msg.className = "lf-msg"; msg.textContent = "";
    btn.disabled = true;
    try {
      const r = await post("/api/leads", { name: fd.get("name"), phone: fd.get("phone"), plan: fd.get("plan"), website: fd.get("website"), consent: fd.get("consent") === "on" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Xatolik. Keyinroq urinib ko‘ring.");
      form.reset(); msg.className = "lf-msg ok"; msg.textContent = "Rahmat! Ariza qabul qilindi. Menejer tez orada bog‘lanadi.";
    } catch (err) { msg.className = "lf-msg err"; msg.textContent = err.message; }
    btn.disabled = false;
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadConfig();
  const contact = telegramLink("Assalomu alaykum! Tariflar haqida ma’lumot olmoqchiman.");
  ["contact-btn", "footer-tg"].forEach((id) => { const a = document.getElementById(id); if (a) a.href = contact; });
  renderPlans();
  renderAudience();
  initGallery();
  initCountdown();
  initCandles();
  initTracking();
  initLeadForm();
});
