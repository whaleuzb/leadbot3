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
let CAPITALS = null;
let RESULTS = [];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function telegramLink(text) {
  return `https://t.me/${TELEGRAM}?text=${encodeURIComponent(text)}`;
}
function featureList(plan) {
  const ok = plan.features.map((f) => `<li><span>✓</span>${esc(f)}</li>`).join("");
  const no = (plan.excluded || []).map((f) => `<li class="excluded"><span>×</span>${esc(f)}</li>`).join("");
  return `<ul>${ok}${no}</ul>`;
}

/* ---------- 1) Tariflar ---------- */
function renderPlans() {
  const grid = document.getElementById("plans-grid");
  if (!grid) return;
  grid.innerHTML = PLANS.map((p, i) => {
    return `
    <article class="plan ${p.featured ? "featured" : ""}">
      ${p.image ? `<div class="plan-media"><img class="plan-img" src="${esc(p.image)}" alt="" loading="lazy"></div>` : ""}
      <div class="plan-top">
        <p class="eyebrow">${esc(p.eyebrow)}</p>
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
      </div>
      <h3>${esc(p.name)}</h3>
      <p class="plan-description">${esc(p.description)}</p>
      <p class="duration">${esc(p.duration)}</p>
      <a class="button" href="#apply" data-plan="${esc(p.name)}">Ariza qoldirish${ARROW}</a>
      <div class="desktop-features">${featureList(p)}</div>
      <div class="mobile-features">
        <button type="button" class="features-toggle" aria-expanded="false" aria-controls="features-${i}">
          Tarifga nimalar kiradi?<span>+</span>
        </button>
        <div id="features-${i}" hidden>${featureList(p)}</div>
      </div>
    </article>`;
  }).join("");

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

/* ---------- 3) Community galereyasi (coverflow slayder, fx.js) ---------- */
function initGallery() {
  const stage = document.getElementById("galleryTrack");
  if (!stage || !window.FX) return;
  const bars = (seed) => {
    let x = seed, out = "";
    for (let i = 0; i < 14; i++) { x = (x * 9301 + 49297) % 233280; out += `<i style="height:${20 + Math.round((x / 233280) * 70)}%"></i>`; }
    return out;
  };
  stage.innerHTML = LESSONS.map((l, i) => `<figure class="community-shot lesson-card${l.image ? " has-img" : ""}">
      ${l.image ? `<img class="lesson-img" src="${esc(l.image)}" alt="" loading="lazy" draggable="false">` : ""}
      <span class="lesson-n">${esc(l.n)}</span>
      <div class="lesson-bars" aria-hidden="true">${bars(i + 3)}</div>
      <figcaption><strong>${esc(l.t)}</strong><span>${esc(l.d)}</span></figcaption>
    </figure>`).join("");
  FX.coverflow({ root: stage.closest(".community-gallery"), stage, slides: [...stage.children], toggle: document.getElementById("gallery-toggle") });
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

function renderAudience() {
  const ol = document.getElementById("audience-grid");
  if (!ol || !AUDIENCE) return;
  ol.innerHTML = AUDIENCE.map((a, i) => {
    const t = typeof a === "string" ? a : a.t, img = typeof a === "string" ? "" : a.image;
    return `<li${img ? ' class="has-img"' : ""}><span>${String(i + 1).padStart(2, "0")}</span><div><p>${esc(t)}</p></div>${img ? `<img class="aud-img" src="${esc(img)}" alt="" loading="lazy">` : ""}</li>`;
  }).join("");
}

/* ---------- Shogirtlar natijalari: karusel + kattalashtirish ---------- */
function initResults() {
  const sec = document.getElementById("natijalar"), track = document.getElementById("res-track");
  if (!sec || !track || !RESULTS.length) return;
  const N = RESULTS.length, pad = (n) => String(n).padStart(2, "0");
  const capHtml = (c) => {
    const [head, ...rest] = String(c || "").split(" · "), tail = rest.join(" · ");
    return `<b>${esc(head || "Natija")}</b>${tail ? `<small class="${/\+\d/.test(tail) ? "up" : ""}">${esc(tail)}</small>` : ""}`;
  };
  track.innerHTML = RESULTS.map((r, i) => `<button class="res-card" type="button" data-i="${i}" aria-label="${esc(r.caption || "Natija " + (i + 1))} — kattalashtirish">
      <span class="res-shot"><img src="${esc(r.image)}" alt="${esc(r.caption || "Shogird natijasi")}" loading="lazy" draggable="false"></span>
      <span class="res-cap"><span class="res-num">${pad(i + 1)}</span>${capHtml(r.caption)}</span>
    </button>`).join("");
  sec.hidden = false;
  const cards = [...track.children], bar = document.getElementById("res-bar"), count = document.getElementById("res-count");
  const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth);
  const maxX = () => track.scrollWidth - track.clientWidth;
  const sync = () => {
    const vis = Math.max(1, Math.round(track.clientWidth / step()));
    const first = Math.min(N - 1, Math.round(track.scrollLeft / step()));
    count.textContent = `${pad(Math.min(N, first + vis))} / ${pad(N)}`;
    bar.style.width = (maxX() > 0 ? Math.max(vis / N, track.scrollLeft / maxX()) * 100 : 100) + "%";
  };
  const go = (dir) => {
    const atEnd = track.scrollLeft >= maxX() - 4, atStart = track.scrollLeft <= 4;
    const x = dir > 0 && atEnd ? 0 : dir < 0 && atStart ? maxX() : track.scrollLeft + dir * step();
    track.scrollTo({ left: x, behavior: "smooth" });
  };
  track.addEventListener("scroll", () => requestAnimationFrame(sync), { passive: true });
  window.addEventListener("resize", sync);
  sync();
  sec.querySelectorAll("[data-res]").forEach((b) => b.addEventListener("click", () => { go(b.dataset.res === "next" ? 1 : -1); hold(); }));
  track.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); go(e.key === "ArrowRight" ? 1 : -1); hold(); } });

  // Avtomatik aylanish: sichqoncha ustida, teginishda yoki ko'rinmaganda to'xtaydi
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let paused = false, visible = false, holdUntil = 0;
  const hold = () => { holdUntil = Date.now() + 6000; };
  track.addEventListener("mouseenter", () => (paused = true));
  track.addEventListener("mouseleave", () => (paused = false));
  track.addEventListener("focusin", () => (paused = true));
  track.addEventListener("focusout", () => (paused = false));
  track.addEventListener("touchstart", hold, { passive: true });
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => (visible = es[0].isIntersecting), { threshold: 0.3 }).observe(track);
  if (!reduce) setInterval(() => { if (visible && !paused && !lb.open && Date.now() > holdUntil && !document.hidden) go(1); }, 3200);

  // Sichqoncha bilan sudrash (teginishda brauzerning o'z skroli ishlaydi)
  let drag = null, moved = false;
  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, left: track.scrollLeft }; moved = false;
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add("dragging"); }
    if (moved) track.scrollLeft = drag.left - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    drag = null;
    if (moved) {
      track.classList.remove("dragging");
      const x = Math.round(track.scrollLeft / step()) * step();
      track.scrollTo({ left: Math.min(x, maxX()), behavior: "smooth" }); hold();
    }
  });
  track.addEventListener("click", (e) => {
    if (moved) { e.preventDefault(); moved = false; return; }
    const c = e.target.closest(".res-card"); if (c) lb.show(+c.dataset.i, c);
  });

  // Lightbox
  const box = document.getElementById("res-lb"), img = document.getElementById("lb-img"), cap = document.getElementById("lb-cap");
  const lb = {
    open: false, i: 0, opener: null,
    show(i, opener) {
      this.i = (i + N) % N; const r = RESULTS[this.i];
      img.src = r.image; img.alt = r.caption || "Shogird natijasi";
      cap.innerHTML = `<span>${pad(this.i + 1)} / ${pad(N)}</span>${capHtml(r.caption)}`;
      if (!this.open) {
        this.open = true; this.opener = opener || null;
        box.hidden = false; document.documentElement.classList.add("lb-on");
        requestAnimationFrame(() => box.classList.add("on"));
        box.querySelector(".lb-close").focus({ preventScroll: true });
      }
    },
    hide() {
      if (!this.open) return;
      this.open = false; box.classList.remove("on"); document.documentElement.classList.remove("lb-on");
      setTimeout(() => { if (!lb.open) box.hidden = true; }, 250);
      this.opener?.focus({ preventScroll: true });
    },
  };
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lb]");
    if (b) return b.dataset.lb === "close" ? lb.hide() : lb.show(lb.i + (b.dataset.lb === "next" ? 1 : -1));
    if (!e.target.closest(".lb-fig img")) lb.hide();
  });
  document.addEventListener("keydown", (e) => {
    if (!lb.open) return;
    if (e.key === "Escape") lb.hide();
    else if (e.key === "ArrowRight") lb.show(lb.i + 1);
    else if (e.key === "ArrowLeft") lb.show(lb.i - 1);
    else if (e.key === "Tab") { // fokus oyna ichida qoladi
      const f = [...box.querySelectorAll("button")], k = f.indexOf(document.activeElement);
      e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  let sx = null;
  box.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
  box.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) lb.show(lb.i + (dx < 0 ? 1 : -1));
  });
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
    const { settings: s, plans, lessons, audience, results } = await r.json();
    TELEGRAM = s.telegram; ENROLL_START = s.enrollStart; ENROLL_END = s.enrollEnd; ENROLL_OPEN = s.enrollmentOpen !== false; if (Array.isArray(s.capitals) && s.capitals.length) CAPITALS = s.capitals;
    if (plans?.length) PLANS = plans;
    if (lessons) LESSONS = lessons;
    if (Array.isArray(audience) && audience.length) AUDIENCE = audience;
    if (Array.isArray(results)) RESULTS = results;
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
    if (!a) return;
    post("/api/track", { type: "click", plan: a.dataset.plan }).catch(() => {});
    setTimeout(() => document.getElementById("lf-name")?.focus({ preventScroll: true }), 600);
  });
}

function initLeadForm() {
  const form = document.getElementById("lead-form");
  if (!form) return;
  const msg = document.getElementById("lf-msg"), cap = document.getElementById("lf-capital");
  if (CAPITALS) cap.innerHTML = `<option value="">Tanlang</option>` + CAPITALS.map((c) => `<option>${esc(c)}</option>`).join("");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button"), fd = new FormData(form);
    msg.className = "lf-msg"; msg.textContent = "";
    btn.disabled = true;
    try {
      const r = await post("/api/leads", { name: fd.get("name"), phone: fd.get("phone"), username: fd.get("username"), capital: fd.get("capital"), city: fd.get("city"), format: fd.get("format"), website: fd.get("website"), consent: fd.get("consent") === "on" });
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
  initResults();
  initGallery();
  initCountdown();
  initTracking();
  initLeadForm();
  if (window.FX) FX.init();
});
