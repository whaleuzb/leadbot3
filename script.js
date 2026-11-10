/* =========================================================
   Mamurjon | MT — interaktivlik
   1) Tariflar  2) Mobil akkordeon  3) Galereya  4) Countdown  5) Hero sham grafigi
   ========================================================= */

let TELEGRAM = "managermtuz"; // ⚠️ Menejer Telegram username'ini yozing

// Qabul sanalari (Toshkent vaqti)
let ENROLL_START = "2026-09-30T00:00:00+05:00";
let ENROLL_END   = "2026-10-10T23:59:00+05:00";

const ARROW = '<svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M9 5h10v10"/></svg>';

let PLANS = [];
let PAYMENTS = { usdt: false, card: false };
let HAS_PROMOS = false;
let FORMAT = "online";

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

/* ---------- 1) Tariflar (Online / Offlayn) ---------- */
const money = (n) => { const v = Math.round(Number(n) * 100) / 100; return "$" + v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).replace(/,/g, " "); };
const cents = (c) => money(c / 100);
const fmtName = (f) => (f === "offline" ? "Offlayn" : "Online");
const WHALE = '<svg class="whale-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13c0 4 3.6 6 8 6 5 0 9-3 9-8 1.6-.3 2.6-1.6 3-3-1.2.5-2.3.4-3-.2C19.6 5 18.6 4 17 4c.4 1.2 0 2.4-1 3H11c-4.4 0-8 2-8 6Z"/><circle cx="9" cy="12" r="1"/></svg>';
function priceBlock(p) {
  if (!p.price) return "";
  const off = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  return `<div class="plan-price">
      ${off ? `<p class="old-price"><s>${money(p.oldPrice)}</s><span class="off">−${off}%</span></p>` : ""}
      <p class="price">${money(p.price)}</p>
    </div>`;
}
function renderPlans() {
  const grid = document.getElementById("plans-grid");
  if (!grid) return;
  // ajratilgan (pinned) va sotuvdagi tarif — o'z bo'limida birinchi
  const list = PLANS.filter((p) => (p.format || "online") === FORMAT).sort((a, b) => (pinOn(b) ? 1 : 0) - (pinOn(a) ? 1 : 0));
  grid.classList.toggle("two", list.length === 2);
  grid.classList.toggle("one", list.length === 1);
  grid.setAttribute("aria-labelledby", "fmt-" + FORMAT);
  grid.innerHTML = list.map((p, i) => {
    const off = p.available === false;
    return `
    <article class="plan ${p.featured ? "featured" : ""}${off ? " unavailable" : ""}" id="plan-${esc(p.id)}">
      ${p.image ? `<div class="plan-media"><img class="plan-img" src="${esc(p.image)}" alt="" loading="lazy"></div>` : ""}
      <div class="plan-top">
        <p class="eyebrow">${esc(p.eyebrow)}</p>
        ${off ? `<span class="badge muted">VAQTINCHA MAVJUD EMAS</span>` : p.availableUntil ? `<span class="badge hot">${esc(untilText(p.availableUntil).toUpperCase())}</span>` : p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
      </div>
      <h3>${esc(p.name)}</h3>
      <p class="plan-description">${esc(p.description)}</p>
      ${priceBlock(p)}
      <p class="duration">Davomiyligi: <b>${esc(p.duration)}</b></p>
      ${p.whales ? `<p class="whales">${WHALE}<span>Whales signal guruhi: <b>${esc(p.whales)}</b></span></p>` : ""}
      ${off ? `<button class="button" type="button" disabled>Vaqtincha mavjud emas</button>`
        : `<a class="button" href="#apply" data-plan="${esc(p.id)}">To‘lash va qo‘shilish${ARROW}</a>`}
      <div class="desktop-features">${featureList(p)}</div>
      <div class="mobile-features">
        <button type="button" class="features-toggle" aria-expanded="false" aria-controls="features-${FORMAT}-${i}">
          Tarifga nimalar kiradi?<span>+</span>
        </button>
        <div id="features-${FORMAT}-${i}" hidden>${featureList(p)}</div>
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
  if (window.FX && FX.refresh) FX.refresh();
}
/* Muddatli takliflar: "15-noyabrgacha" */
const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const tashDate = (iso) => new Date(Date.parse(iso) + 5 * 36e5); // Toshkent vaqti
const untilText = (iso) => { const d = tashDate(iso); return `${d.getUTCDate()}-${UZ_MONTHS[d.getUTCMonth()]}gacha`; };
const pinOn = (p) => p.pinned && p.available !== false;
function renderSpotlight() {
  const box = document.getElementById("spotlight");
  if (!box) return;
  const p = PLANS.find(pinOn);
  if (!p) { box.hidden = true; return; }
  const off = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  box.hidden = false;
  box.innerHTML = `<div class="sp-copy">
      <p class="sp-eyebrow"><i></i>QABUL OCHIQ${p.availableUntil ? " · " + esc(untilText(p.availableUntil).toUpperCase()) : ""}</p>
      <h3>${fmtName(p.format)} · ${esc(p.name)}</h3>
      <p class="sp-desc">${esc(p.description)}</p>
    </div>
    <div class="sp-side">
      <p class="sp-price">${off ? `<s>${money(p.oldPrice)}</s>` : ""}<b>${money(p.price)}</b></p>
      ${p.availableUntil ? `<p class="sp-left" data-until="${esc(p.availableUntil)}"></p>` : ""}
      <a class="button" href="#plan-${esc(p.id)}" data-spot="${esc(p.id)}" data-fmt-go="${esc(p.format || "online")}">Batafsil${ARROW}</a>
    </div>`;
  const left = box.querySelector(".sp-left");
  if (left) {
    const tick = () => {
      const ms = Date.parse(left.dataset.until) - Date.now();
      if (ms <= 0) { box.hidden = true; return; }
      const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
      left.textContent = `Yopilishiga: ${d ? d + " kun " : ""}${h} soat ${m} daqiqa`;
    };
    tick(); setInterval(tick, 30000);
  }
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-spot]"); if (!a) return;
  e.preventDefault();
  document.querySelector(`.fmt-tabs [data-fmt="${a.dataset.fmtGo}"]`)?.click();
  requestAnimationFrame(() => {
    const card = document.getElementById("plan-" + a.dataset.spot);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
  });
});

function initFormatTabs() {
  const tabs = [...document.querySelectorAll(".fmt-tabs [data-fmt]")];
  const select = (b, focus) => {
    FORMAT = b.dataset.fmt;
    tabs.forEach((t) => { const on = t === b; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
    if (focus) b.focus();
    renderPlans();
  };
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => select(b));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault(); select(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true);
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
  const card = (r, i, clone) => `<button class="res-card" type="button" data-i="${i}"${clone ? ' tabindex="-1" aria-hidden="true"' : ""} aria-label="${esc(r.caption || "Natija " + (i + 1))} — kattalashtirish">
      <span class="res-shot"><img src="${esc(r.image)}" alt="${clone ? "" : esc(r.caption || "Shogird natijasi")}" loading="lazy" draggable="false"></span>
      <span class="res-cap"><span class="res-num">${pad(i + 1)}</span>${capHtml(r.caption)}</span>
    </button>`;
  const set = (clone) => RESULTS.map((r, i) => card(r, i, clone)).join("");
  // tartib: nusxa | asl (fokus shu yerda) | nusxa… — chap chetda ham har doim karta bo'ladi
  track.innerHTML = `<div class="res-rail">${set(true)}${set(false)}</div>`;
  sec.hidden = false;
  const rail = track.firstElementChild, bar = document.getElementById("res-bar"), count = document.getElementById("res-count");

  // Uzluksiz lenta: kartalar nusxalanadi, siljish bitta to'plam kengligiga yetganda boshiga qaytadi (sezilmaydi)
  let W = 0, STEP = 0;
  const measure = () => {
    const cs = rail.children, old = W;
    STEP = cs[1] ? cs[1].offsetLeft - cs[0].offsetLeft : cs[0].offsetWidth;
    W = STEP * N;
    const need = Math.ceil((2 * W + track.clientWidth) / W); // ekranni har doim to'ldirish uchun to'plamlar soni
    while (rail.children.length < need * N) rail.insertAdjacentHTML("beforeend", set(true));
    if (old) x = (x / old) * W;
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BASE = () => (innerWidth < 760 ? 38 : 52); // px/soniya
  let x = 0, vel = 0, hover = false, visible = true, nudge = 0, drag = null, moved = false, last = 0, shown = "";
  const wrap = (v) => ((v % W) + W) % W;
  measure();
  addEventListener("resize", measure);
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => (visible = es[0].isIntersecting), { rootMargin: "100px" }).observe(track);
  const paint = () => {
    rail.style.transform = `translate3d(${-(x + W)}px,0,0)`;
    bar.style.width = ((x / W) * 100).toFixed(2) + "%";
    const t = `${pad((Math.round(x / STEP) % N) + 1)} / ${pad(N)}`;
    if (t !== shown) count.textContent = shown = t;
  };
  const frame = (now) => {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (visible && !drag) {
      const target = reduce || lb.open ? 0 : BASE() * (hover ? 0.35 : 1);
      vel += (target - vel) * Math.min(1, dt * 3); // inersiyadan doimiy tezlikka silliq qaytadi
      x += vel * dt;
      if (nudge) { const d = Math.abs(nudge) < 0.5 ? nudge : nudge * Math.min(1, dt * 9); x += d; nudge -= d; }
      x = wrap(x); paint();
    }
    requestAnimationFrame(frame);
  };
  paint(); requestAnimationFrame(frame);

  const go = (dir) => { nudge += dir * STEP; };
  sec.querySelectorAll("[data-res]").forEach((b) => b.addEventListener("click", () => go(b.dataset.res === "next" ? 1 : -1)));
  track.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); go(e.key === "ArrowRight" ? 1 : -1); } });
  track.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hover = true; });
  track.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hover = false; });
  // Tab bilan fokus: brauzer o'zi skroll qilmasin, kartani ko'rinadigan joyga olib kelamiz
  track.addEventListener("scroll", () => { if (track.scrollLeft) track.scrollLeft = 0; });
  track.addEventListener("focusin", (e) => { const c = e.target.closest(".res-card"); if (c && e.target.matches(":focus-visible")) { x = wrap(+c.dataset.i * STEP); paint(); } });

  // Sudrash (sichqoncha va barmoq): qo'yib yuborilganda inersiya bilan davom etadi
  track.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { sx: e.clientX, sy: e.clientY, x0: x, lx: e.clientX, lt: performance.now(), v: 0, id: e.pointerId }; moved = false;
  });
  track.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx;
    if (!moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(e.clientY - drag.sy)) return;
      moved = true; track.classList.add("dragging");
      try { track.setPointerCapture(e.pointerId); } catch {}
    }
    const now = performance.now(), dtm = Math.max(1, now - drag.lt);
    drag.v = 0.8 * ((drag.lx - e.clientX) / dtm) * 1000 + 0.2 * drag.v; drag.lx = e.clientX; drag.lt = now;
    x = wrap(drag.x0 - dx); nudge = 0; paint();
  });
  const end = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (moved) { vel = Math.max(-2500, Math.min(2500, performance.now() - drag.lt > 120 ? 0 : drag.v)); track.classList.remove("dragging"); }
    drag = null; last = 0;
  };
  track.addEventListener("pointerup", end);
  track.addEventListener("pointercancel", end);
  track.addEventListener("lostpointercapture", (e) => { if (e.target === track) end(e); });
  track.addEventListener("click", (e) => {
    if (moved) { e.preventDefault(); moved = false; return; }
    const c = e.target.closest(".res-card");
    if (c) lb.show(+c.dataset.i, c.hasAttribute("aria-hidden") ? rail.querySelector(`.res-card:not([aria-hidden])[data-i="${c.dataset.i}"]`) : c);
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

/* ---------- Hero: shogirdlar natijalari (demo grafik o'rniga) ---------- */
function initHeroResults() {
  const fig = document.querySelector(".hero-image.chart-card");
  if (!fig || !RESULTS.length) return; // natija yo'q bo'lsa — eski grafik qoladi
  // foizli natijalar (+30% kabi) birinchi
  const list = [...RESULTS].sort((a, b) => (/\+\d/.test(b.caption || "") ? 1 : 0) - (/\+\d/.test(a.caption || "") ? 1 : 0));
  const N = list.length, pad = (n) => String(n).padStart(2, "0");
  fig.querySelector(".hero-chart")?.remove();
  fig.classList.add("hero-results");
  fig.setAttribute("aria-label", "Shogirdlar natijalari");
  fig.insertAdjacentHTML("afterbegin", `<a class="hr-link" href="#natijalar" aria-label="Barcha natijalarni ko‘rish"></a>
    <div class="hr-slides">${list.map((r, i) => `<div class="hr-slide${i === 0 ? " on" : ""}" data-i="${i}"><span class="hr-bg"></span><img class="hr-shot" alt="${esc(r.caption || "Shogird natijasi")}" decoding="async" draggable="false"></div>`).join("")}</div>
    <span class="demo-chip"><i></i>SHOGIRDLAR NATIJALARI</span>`);
  const cap = fig.querySelector("figcaption");
  cap.innerHTML = `<span id="hero-clabel"></span><strong id="hero-caption"></strong>`;
  const slides = [...fig.querySelectorAll(".hr-slide")], label = cap.querySelector("span"), title = cap.querySelector("strong");
  const load = (i) => { const sl = slides[i % N], im = sl.querySelector("img"); if (!im.src) { im.src = list[i % N].image; sl.querySelector(".hr-bg").style.backgroundImage = `url("${list[i % N].image}")`; } };
  let cur = 0;
  const show = (i) => {
    slides[cur].classList.remove("on"); cur = (i + N) % N; slides[cur].classList.add("on");
    const [head, ...rest] = String(list[cur].caption || "Shogird natijasi").split(" · ");
    label.textContent = `SHOGIRD NATIJASI · ${pad(cur + 1)} / ${pad(N)}`;
    title.innerHTML = `${esc(head)}${rest.length ? ` <em class="${/\+\d/.test(rest.join(" ")) ? "up" : ""}">${esc(rest.join(" · "))}</em>` : ""}`;
    load(cur + 1); // keyingisini oldindan yuklab qo'yamiz
  };
  load(0); show(0);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || N < 2) return;
  let hover = false, visible = true;
  fig.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hover = true; });
  fig.addEventListener("pointerleave", () => (hover = false));
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(fig);
  setInterval(() => { if (!hover && visible && !document.hidden) show(cur + 1); }, 3200);
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
    const { settings: s, plans, lessons, audience, results, payments, promos } = await r.json();
    if (payments) PAYMENTS = payments;
    HAS_PROMOS = !!promos;
    TELEGRAM = s.telegram; if (s.freeGuidesUrl) window.TM_FREE_URL = s.freeGuidesUrl; ENROLL_START = s.enrollStart; ENROLL_END = s.enrollEnd; ENROLL_OPEN = s.enrollmentOpen !== false; if (Array.isArray(s.capitals) && s.capitals.length) CAPITALS = s.capitals;
    if (plans?.length) PLANS = plans;
    if (lessons) LESSONS = lessons;
    if (Array.isArray(audience) && audience.length) AUDIENCE = audience;
    if (Array.isArray(results)) RESULTS = results;
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
    window.tmSelectPlan?.(a.dataset.plan);
    setTimeout(() => document.getElementById("lf-name")?.focus({ preventScroll: true }), 600);
  });
}

/* ---------- Buyurtma va to'lov ---------- */
const ORDER_KEY = "tm-order";
const svgI = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const COPY_ICO = svgI("M9 9h10v12H9zM5 15V3h10");
function copyBtn(value, label) {
  return `<button class="copy-btn" type="button" data-copy="${esc(value)}" aria-label="${esc(label)} — nusxalash">${COPY_ICO}<span>Nusxalash</span></button>`;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); } catch {
    const t = Object.assign(document.createElement("textarea"), { value: b.dataset.copy }); document.body.append(t); t.select(); document.execCommand("copy"); t.remove();
  }
  const sp = b.querySelector("span"); sp.textContent = "Nusxalandi ✓"; b.classList.add("done");
  setTimeout(() => { sp.textContent = "Nusxalash"; b.classList.remove("done"); }, 1600);
});

function initLeadForm() {
  const form = document.getElementById("lead-form");
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const msg = $("lf-msg"), cap = $("lf-capital"), planSel = $("lf-plan"), summary = $("co-summary"), panel = $("pay-panel");
  const promoIn = $("lf-promo"), promoMsg = $("lf-promo-msg");
  if (CAPITALS) cap.innerHTML = `<option value="">Tanlang</option>` + CAPITALS.map((c) => `<option>${esc(c)}</option>`).join("");
  $("lf-promo-wrap").hidden = !HAS_PROMOS;

  // Tariflar ro'yxati (Online / Offlayn guruhlari)
  const groups = ["online", "offline"].map((f) => {
    const ps = PLANS.filter((p) => (p.format || "online") === f);
    return ps.length ? `<optgroup label="${fmtName(f)}">${ps.map((p) => `<option value="${esc(p.id)}"${p.available === false ? " disabled" : ""}>${fmtName(f)} · ${esc(p.name)} — ${p.available === false ? "vaqtincha mavjud emas" : money(p.price)}</option>`).join("")}</optgroup>` : "";
  }).join("");
  planSel.innerHTML = `<option value="">Tarifni tanlang</option>` + groups;

  // To'lov usullari
  const methods = ["usdt", "card"].filter((k) => PAYMENTS[k]);
  $("lf-method-wrap").hidden = !methods.length;
  form.querySelectorAll('input[name="method"]').forEach((r) => { r.closest("label").hidden = !PAYMENTS[r.value]; r.disabled = !PAYMENTS[r.value]; });
  const seg = form.querySelector("#lf-method-wrap .seg");
  seg.classList.toggle("single", methods.length === 1);
  if (methods.length === 1) form.querySelector(`input[name="method"][value="${methods[0]}"]`).checked = true;
  const submitTxt = () => { const b = $("lf-submit"); b.firstChild.textContent = methods.length ? "To‘lovga o‘tish" : "Ariza yuborish"; };
  submitTxt();

  let promo = null; // { code, discountCents, plan }
  const plan = () => PLANS.find((p) => p.id === planSel.value);
  function renderSummary() {
    const p = plan();
    if (!p) { summary.innerHTML = `<p class="co-empty">Tarifni tanlang — narx va nimalar kirishi shu yerda ko‘rinadi.</p>`; return; }
    const price = Math.round(p.price * 100), disc = promo && promo.plan === p.id ? promo.discountCents : 0, total = price - disc;
    const usdRate = PAYMENTS.usdRate || 0, m = form.querySelector('input[name="method"]:checked')?.value;
    summary.innerHTML = `
      <div class="co-plan"><span>${fmtName(p.format)} · ${esc(p.duration)}</span><strong>${esc(p.name)}</strong></div>
      ${p.whales ? `<p class="whales">${WHALE}<span>Whales signal guruhi: <b>${esc(p.whales)}</b></span></p>` : ""}
      <dl class="co-lines">
        ${p.oldPrice > p.price ? `<div><dt>Asl narx</dt><dd><s>${money(p.oldPrice)}</s></dd></div>` : ""}
        <div><dt>Chegirmali narx</dt><dd>${money(p.price)}</dd></div>
        ${disc ? `<div class="promo-line"><dt>Promo kod ${esc(promo.code)}</dt><dd>−${cents(disc)}</dd></div>` : ""}
        <div class="total"><dt>Jami</dt><dd>${cents(total)}</dd></div>
        ${m === "card" && usdRate ? `<div class="som"><dt>Karta orqali</dt><dd>≈ ${(Math.ceil(total / 100 * usdRate / 1000) * 1000).toLocaleString("ru-RU")} so‘m</dd></div>` : ""}
      </dl>`;
  }
  window.tmSelectPlan = (id) => {
    const p = PLANS.find((x) => x.id === id);
    if (!p || p.available === false) return;
    if (panel.hidden === false && CURRENT && CURRENT.payStatus !== "paid") return; // to'lov jarayonida — almashtirmaymiz
    planSel.value = id; onPlanChange();
  };
  function onPlanChange() {
    if (promo && promo.plan !== planSel.value) {
      if (promoIn.value.trim()) checkPromo(true); else { promo = null; promoMsg.textContent = ""; }
    }
    renderSummary();
  }
  planSel.addEventListener("change", onPlanChange);
  form.addEventListener("change", (e) => { if (e.target.name === "method") renderSummary(); });

  async function checkPromo(silent) {
    const code = promoIn.value.trim();
    promoMsg.className = "promo-msg"; promoMsg.textContent = "";
    promo = null;
    if (!code) { renderSummary(); return true; }
    if (!plan()) { promoMsg.className = "promo-msg err"; promoMsg.textContent = "Avval tarifni tanlang"; renderSummary(); return false; }
    try {
      const r = await post("/api/promo", { code, plan: planSel.value });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Promo kodni tekshirib bo‘lmadi");
      promo = { code: d.code, discountCents: d.discountCents, plan: planSel.value };
      promoMsg.className = "promo-msg ok"; promoMsg.textContent = `Promo kod qo‘llandi: −${cents(d.discountCents)}`;
      renderSummary(); return true;
    } catch (err) { if (!silent || code) { promoMsg.className = "promo-msg err"; promoMsg.textContent = err.message; } renderSummary(); return false; }
  }
  $("lf-promo-btn").addEventListener("click", () => checkPromo());
  promoIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); checkPromo(); } });
  promoIn.addEventListener("input", () => { if (promo) { promo = null; promoMsg.textContent = ""; renderSummary(); } });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("lf-submit"), fd = new FormData(form);
    msg.className = "lf-msg"; msg.textContent = "";
    const fail = (t, el) => { msg.className = "lf-msg err"; msg.textContent = t; el?.focus(); };
    if (!plan()) return fail("Tarifni tanlang", planSel);
    if (methods.length && !fd.get("method")) return fail("To‘lov usulini tanlang", form.querySelector('input[name="method"]:not(:disabled)'));
    if (promoIn.value.trim() && (!promo || promo.plan !== planSel.value) && !(await checkPromo())) return fail("Promo kodni tekshiring yoki o‘chiring", promoIn);
    btn.disabled = true;
    try {
      const r = await post("/api/orders", { plan: planSel.value, name: fd.get("name"), phone: fd.get("phone"), username: fd.get("username"), city: fd.get("city"), capital: fd.get("capital"),
        promo: promo ? promo.code : "", method: fd.get("method") || "", website: fd.get("website"), consent: fd.get("consent") === "on" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Xatolik. Keyinroq urinib ko‘ring.");
      try { localStorage.setItem(ORDER_KEY, JSON.stringify({ id: d.id, t: d.token })); } catch {}
      showOrder(d, d.token, true);
    } catch (err) { fail(err.message); }
    btn.disabled = false;
  });

  /* ----- To'lov paneli ----- */
  let CURRENT = null, TOKEN = "", poll = null;
  const STATUS_TXT = { pending: "To‘lov kutilmoqda", review: "Chek tekshirilmoqda", paid: "To‘landi", expired: "Muddati o‘tdi", cancelled: "Bekor qilingan", none: "Ariza qabul qilindi" };
  const tgLink = (o, text) => telegramLink(text || `Assalomu alaykum! Buyurtma #${o.no} (${o.planName}) bo‘yicha yozyapman.`);
  function showOrder(o, token, scroll) {
    CURRENT = o; TOKEN = token;
    form.hidden = true; panel.hidden = false;
    const p = PLANS.find((x) => x.id === o.planId);
    if (p) { planSel.value = p.id; promo = o.discountCents ? { code: o.promo, discountCents: o.discountCents, plan: p.id } : null; renderSummary(); }
    panel.innerHTML = panelHtml(o);
    if (scroll) { document.getElementById("apply").scrollIntoView({ behavior: "smooth", block: "start" }); panel.focus({ preventScroll: true }); }
    clearInterval(poll);
    if (o.payStatus === "pending" || o.payStatus === "review") poll = setInterval(refresh, o.method === "usdt" ? 8000 : 15000);
  }
  async function refresh() {
    if (document.hidden || !CURRENT) return;
    try {
      const r = await fetch(`/api/orders/${CURRENT.id}?t=${TOKEN}`, { cache: "no-store" });
      if (r.status === 404) return resetOrder();
      if (!r.ok) return;
      const o = await r.json();
      if (o.payStatus !== CURRENT.payStatus) showOrder(o, TOKEN, false);
    } catch {}
  }
  function resetOrder() {
    clearInterval(poll); CURRENT = null;
    try { localStorage.removeItem(ORDER_KEY); } catch {}
    panel.hidden = true; panel.innerHTML = ""; form.hidden = false;
  }
  function panelHtml(o) {
    const head = `<div class="pay-head"><div><p class="eyebrow">BUYURTMA #${o.no}</p><h3>${esc(o.planName)}</h3></div><span class="pay-pill ${o.payStatus}">${STATUS_TXT[o.payStatus] || ""}</span></div>`;
    const foot = `<div class="pay-foot"><a class="text-link" href="${esc(tgLink(o))}" target="_blank" rel="noopener noreferrer">Menejerga yozish</a>${o.payStatus === "paid" || o.payStatus === "none" ? `<button class="text-link" type="button" data-pay="new">Yangi buyurtma</button>` : `<button class="text-link" type="button" data-pay="cancel">Bekor qilish / boshqa usul</button>`}</div>`;
    if (o.payStatus === "paid") return `${head}<div class="pay-done"><div class="pay-check">${svgI("M5 12.5l4.5 4.5L19 7")}</div>
      <h4>To‘lov qabul qilindi!</h4><p>Rahmat, ${cents(o.amountCents)} to‘lovingiz tasdiqlandi. Menejer tez orada Telegram orqali bog‘lanib, sizni darslar va <b>Whales signal guruhi</b>ga qo‘shadi.</p>
      <a class="button" href="${esc(tgLink(o, `Assalomu alaykum! Buyurtma #${o.no} to‘landi (${o.planName}). Kirishni bersangiz.`))}" target="_blank" rel="noopener noreferrer">Menejerga yozish${ARROW}</a></div>${foot}`;
    if (o.payStatus === "none") return `${head}<div class="pay-done"><h4>Ariza qabul qilindi</h4><p>Menejer tez orada bog‘lanib, to‘lov tartibini tushuntiradi.</p></div>${foot}`;
    if (o.payStatus === "expired" || o.payStatus === "cancelled") return `${head}<div class="pay-done"><p>${o.payStatus === "expired" ? "To‘lov muddati o‘tdi. Agar to‘lagan bo‘lsangiz — menejerga TxID yoki chekni yuboring." : "Buyurtma bekor qilindi."}</p></div>${foot}`;
    if (o.method === "usdt") {
      const P = o.pay;
      return `${head}
        <ol class="pay-steps">
          <li><span>Tarmoq</span><div class="pay-net"><b>USDT</b> · ${esc(P.network)}</div><small class="warn">Faqat <b>BEP20 (BSC)</b> tarmog‘ida yuboring — boshqa tarmoqda yuborilgan mablag‘ yo‘qoladi.</small></li>
          <li><span>Aynan shu summani yuboring</span><div class="pay-box"><code class="pay-amount">${esc(P.amount)} USDT</code>${copyBtn(P.amount, "Summa")}</div><small>Kasr qismi (.${esc(P.amount.split(".")[1])}) to‘lovingizni avtomatik aniqlash uchun. Birja komissiyasini hisobga oling — hamyonga aynan shu summa yetib kelsin.</small></li>
          <li><span>Hamyon manzili</span><div class="pay-box"><code class="pay-addr">${esc(P.address)}</code>${copyBtn(P.address, "Hamyon manzili")}</div></li>
        </ol>
        <div class="pay-wait"><i class="spin" aria-hidden="true"></i><p>To‘lov tarmoqda tasdiqlangach (odatda 1–3 daqiqa) bu sahifa o‘zi yangilanadi. Sahifani yopsangiz ham buyurtma saqlanadi.</p></div>
        <div class="paid-wrap"><button class="button paid-btn" type="button" data-pay="paid">To‘lov qildim${ARROW}</button><p class="promo-msg" id="paid-msg" role="status"></p></div>
        <form class="txid-form" data-pay="txid"><label for="pay-txid">Tezlashtirish uchun TxID (ixtiyoriy)</label><div class="promo-row"><input id="pay-txid" name="txid" autocomplete="off" placeholder="0x…" maxlength="70" /><button class="promo-btn" type="submit">Tekshirish</button></div><p class="promo-msg" role="status"></p></form>
        ${foot}`;
    }
    const P = o.pay;
    return `${head}
      <ol class="pay-steps">
        <li><span>Shu summani o‘tkazing</span><div class="pay-box"><code class="pay-amount">${Number(P.sum).toLocaleString("ru-RU")} so‘m</code>${copyBtn(String(P.sum), "Summa")}</div><small>${cents(o.amountCents)} × ${Number(P.rate).toLocaleString("ru-RU")} so‘m kurs bo‘yicha</small></li>
        <li><span>Karta raqami</span><div class="pay-box"><code class="pay-addr">${esc(P.card)}</code>${copyBtn(P.card.replace(/\s/g, ""), "Karta raqami")}</div>${P.holder || P.bank ? `<small>${esc([P.holder, P.bank].filter(Boolean).join(" · "))}</small>` : ""}</li>
        <li><span>Chekni yuklang</span>
          ${o.payStatus === "review" ? `<div class="pay-wait"><i class="spin" aria-hidden="true"></i><p>To‘lovingiz tekshirilmoqda. Menejer chekni ko‘rib tasdiqlaydi — odatda bir necha daqiqadan bir necha soatgacha. Sahifa o‘zi yangilanadi.</p></div>`
            : o.hasReceipt ? `<p class="rc-ok">${svgI("M5 12.5l4.5 4.5L19 7")}Chek yuklandi</p>` : ""}
          <label class="upload${o.hasReceipt ? " small" : ""}"><input type="file" accept="image/jpeg,image/png,image/webp" data-pay="receipt" /><span>${o.hasReceipt ? "Boshqa chek yuklash" : "Chek skrinshotini tanlash"}</span></label>
          <p class="promo-msg" id="rc-msg" role="status"></p></li>
        ${o.payStatus === "review" ? "" : `<li><span>To‘lovni tasdiqlang</span>
          <button class="button paid-btn" type="button" data-pay="paid"${o.hasReceipt ? "" : " disabled"}>To‘lov qildim${ARROW}</button>
          <small>${o.hasReceipt ? "Bosganingizdan keyin menejer chekni tekshirib, to‘lovni tasdiqlaydi." : "Avval chekni yuklang — keyin bu tugma faollashadi."}</small></li>`}
      </ol>${foot}`;
  }
  async function shrinkImg(file) {
    if (!/^image\//.test(file.type)) throw new Error("Chekni rasm sifatida yuklang");
    try {
      const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Rasmni o‘qib bo‘lmadi"))), "image/jpeg", 0.88));
    } catch (e) { if (file.size < 6e6 && /jpe?g|png|webp/.test(file.type)) return file; throw e; }
  }
  panel.addEventListener("change", async (e) => {
    if (e.target.dataset.pay !== "receipt" || !e.target.files[0]) return;
    const m = document.getElementById("rc-msg"), lab = e.target.closest(".upload");
    m.className = "promo-msg"; m.textContent = "Yuklanmoqda…"; lab.classList.add("busy");
    try {
      const blob = await shrinkImg(e.target.files[0]);
      const r = await fetch(`/api/orders/${CURRENT.id}/receipt?t=${TOKEN}`, { method: "POST", headers: { "Content-Type": blob.type || "image/jpeg" }, body: blob });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Yuklab bo‘lmadi");
      showOrder(d, TOKEN, false);
    } catch (err) { m.className = "promo-msg err"; m.textContent = err.message; lab.classList.remove("busy"); }
    e.target.value = "";
  });
  panel.addEventListener("submit", async (e) => {
    if (e.target.dataset.pay !== "txid") return;
    e.preventDefault();
    const m = e.target.querySelector(".promo-msg"), b = e.target.querySelector("button");
    m.className = "promo-msg"; m.textContent = "Tekshirilmoqda…"; b.disabled = true;
    try {
      const r = await post(`/api/orders/${CURRENT.id}/txid?t=${TOKEN}`, { txid: e.target.txid.value.trim() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Tekshirib bo‘lmadi");
      if (d.payStatus === "paid") return showOrder(d, TOKEN, false);
      m.className = "promo-msg ok"; m.textContent = d.note || "TxID saqlandi — to‘lov avtomatik tekshiriladi.";
    } catch (err) { m.className = "promo-msg err"; m.textContent = err.message; }
    b.disabled = false;
  });
  panel.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-pay]"); if (!b || b.tagName === "FORM" || b.tagName === "INPUT") return;
    if (b.dataset.pay === "new") return resetOrder();
    if (b.dataset.pay === "paid") {
      b.disabled = true; const m = document.getElementById("paid-msg") || document.getElementById("rc-msg");
      if (m) { m.className = "promo-msg"; m.textContent = "Tekshirilmoqda…"; }
      try {
        const r = await post(`/api/orders/${CURRENT.id}/paid?t=${TOKEN}`, {});
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Xatolik. Qayta urinib ko‘ring.");
        if (d.payStatus !== CURRENT.payStatus || d.method === "card") return showOrder(d, TOKEN, false);
        if (m) { m.className = "promo-msg ok"; m.textContent = d.note || "Qabul qilindi."; }
      } catch (err) { if (m) { m.className = "promo-msg err"; m.textContent = err.message; } }
      b.disabled = false; return;
    }
    if (b.dataset.pay === "cancel") {
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Ishonchingiz komilmi? Yana bosing"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Bekor qilish / boshqa usul"; }, 4000); return; }
      await post(`/api/orders/${CURRENT.id}/cancel?t=${TOKEN}`, {}).catch(() => {});
      resetOrder();
    }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

  // Avvalgi buyurtmani tiklash (sahifa yangilansa ham)
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(ORDER_KEY) || "null"); } catch {}
  renderSummary();
  if (saved?.id && saved?.t) {
    fetch(`/api/orders/${saved.id}?t=${saved.t}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((o) => {
      if (o.payStatus === "cancelled" || (o.payStatus === "expired") || (o.payStatus === "paid" && Date.now() - Date.parse(o.paidAt || 0) > 7 * 864e5)) return resetOrder();
      showOrder(o, saved.t, false);
    }).catch((st) => { if (st === 404) resetOrder(); });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadConfig();
  const contact = telegramLink("Assalomu alaykum! Tariflar haqida ma’lumot olmoqchiman.");
  ["contact-btn", "footer-tg"].forEach((id) => { const a = document.getElementById(id); if (a) a.href = contact; });
  initFormatTabs();
  renderSpotlight();
  renderPlans();
  renderAudience();
  initResults();
  initHeroResults();
  initGallery();
  initCountdown();
  initTracking();
  initLeadForm();
  if (window.FX) FX.init();
});
