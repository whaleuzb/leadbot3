/* =========================================================
   trademove — animatsiyalar va slayder (kutubxonasiz)
   FX.init()      — sahifa chrome'i, hero, ribbon, grafik, hisoblagichlar
   FX.refresh()   — dinamik render qilingan bloklarga reveal/tilt ulash
   FX.coverflow() — Swiper "coverflow" uslubidagi slayder
   ========================================================= */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const FX = (window.FX = {});

  /* ---------- Skroll chizig'i + yopishqoq menyu ---------- */
  function chrome() {
    if ($(".scroll-progress")) return;
    const bar = Object.assign(document.createElement("div"), { className: "scroll-progress" });
    document.body.prepend(bar);

    const brand = ($(".js-brand") || {}).textContent || "trademove";
    const top = document.createElement("header");
    top.className = "topbar";
    top.innerHTML = `<a class="brand" href="#top">${brand.replace(/[<>&]/g, "")}</a>
      <nav aria-label="Bo‘limlar"><a href="#community">Community</a><a href="#for-whom">Kimga mos</a><a href="#results">Mening yo‘lim</a><a href="#plans">Tariflar</a></nav>
      <a class="topbar-cta" href="#apply">Ariza qoldirish</a>`;
    document.body.prepend(top);

    const links = $$("nav a", top);
    const secs = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
      top.classList.toggle("show", y > 560);
      let cur = null;
      secs.forEach((s) => { if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = s; });
      links.forEach((a) => a.classList.toggle("on", !!cur && a.getAttribute("href") === "#" + cur.id));
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update);
    update();
  }

  /* ---------- Hero sarlavhasi: qatorma-qator ochilish ---------- */
  function heroTitle() {
    const h = $("#hero-title");
    if (!h || h.dataset.fx) return;
    h.dataset.fx = "1";
    const parts = h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML = parts.map((p, i) => `<span class="ln"><span style="--i:${i}">${p}</span></span>`).join("");
  }

  /* ---------- Ribbon: cheksiz marquee ---------- */
  function marquee() {
    const r = $(".ribbon");
    if (!r || r.dataset.fx || reduce) return;
    r.dataset.fx = "1";
    const inner = r.innerHTML;
    const set = (hide) => `<div class="ribbon-set"${hide ? ' aria-hidden="true"' : ""}>${inner}</div>`;
    r.innerHTML = `<div class="ribbon-track">${set(false)}${set(true).repeat(5)}</div>`;
  }

  /* ---------- Hero grafigi: jonli (bezak) sham grafigi ---------- */
  function chart() {
    const g = $("#candles");
    if (!g || g.dataset.fx) return;
    g.dataset.fx = "1";
    const svg = g.ownerSVGElement;
    const old = $(".trend", svg); if (old) old.remove();
    const holder = svg.closest(".hero-image");
    if (holder && !$(".demo-chip", holder)) holder.insertAdjacentHTML("beforeend", '<span class="demo-chip"><i></i>DEMO GRAFIK</span>');

    const W = 23, X0 = 20, KEEP = 34;
    let seed = 11, price = 190, idx = 0, shift = 0;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const cs = [];
    const next = () => {
      const open = price;
      const goal = 155 + Math.sin(idx / 5) * 75 + Math.sin(idx / 13) * 25; // katta to'lqinlar: ko'tarilish va tushish
      const close = clamp(open + (goal - open) * 0.32 + (rnd() - 0.5) * 34, 40, 268);
      const hi = Math.min(open, close) - rnd() * 11 - 2, lo = Math.max(open, close) + rnd() * 11 + 2;
      price = close;
      return { i: idx++, open, close, hi, lo };
    };
    const el = (c, delay) => {
      const up = c.close < c.open, col = up ? "#bba5fa" : "#6d6577";
      const y = Math.min(c.open, c.close), h = Math.max(3, Math.abs(c.open - c.close));
      const x = X0 + c.i * W;
      return `<g class="cd" data-i="${c.i}" style="animation-delay:${delay}ms"><line x1="${x}" x2="${x}" y1="${c.hi.toFixed(1)}" y2="${c.lo.toFixed(1)}" stroke="${col}" stroke-width="2.2"/><rect x="${x - 7.5}" y="${y.toFixed(1)}" width="15" height="${h.toFixed(1)}" rx="2" fill="${col}"/></g>`;
    };
    for (let k = 0; k < 17; k++) cs.push(next());
    g.innerHTML = '<path class="ma" fill="none"></path>' + cs.map((c, k) => el(c, 250 + k * 45)).join("");
    const ma = $(".ma", g);
    const drawMA = () => {
      const pts = cs.map((c) => `${X0 + c.i * W},${c.close.toFixed(1)}`);
      ma.setAttribute("d", "M" + pts.join("L"));
    };
    drawMA();

    if (reduce) return;
    let visible = true;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(svg);
    setInterval(() => {
      if (!visible || document.hidden) return;
      const c = next(); cs.push(c);
      g.insertAdjacentHTML("beforeend", el(c, 0));
      shift++;
      g.style.transform = `translateX(${-shift * W}px)`;
      while (cs.length > KEEP) { const o = cs.shift(); $(`.cd[data-i="${o.i}"]`, g)?.remove(); }
      drawMA();
    }, 750);
  }

  /* ---------- Skroll bilan paydo bo'lish ---------- */
  const GROUPS = [
    [".personal-result .result-copy > *", 90], [".result-photo", 0],
    [".community-intro > *", 80], [".community-copy > *", 70], [".community-gallery", 0], [".community-caption", 0], [".gallery-ctl", 0],
    [".audience-heading > *", 90], [".audience-grid li", 60], [".audience-conclusion", 0],
    [".section-head > *", 90], [".plan", 110], [".enrollment-ticket", 0], [".lead-card", 0], [".contact", 0], [".risk-note", 0], ["footer", 0],
  ];
  let io;
  function reveal() {
    if (reduce) return;
    if (!("IntersectionObserver" in window)) { $$(".rv").forEach((e) => e.classList.add("in")); return; }
    io = io || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    GROUPS.forEach(([sel, gap]) => $$(sel).forEach((e, i) => {
      if (e.classList.contains("rv")) return;
      e.classList.add("rv");
      e.style.setProperty("--d", (i % 6) * gap + "ms");
      io.observe(e);
    }));
  }

  /* ---------- Raqamlar sanaladi ---------- */
  function counters() {
    $$(".stats-grid strong").forEach((el) => {
      if (el.dataset.cnt) return;
      const m = /^(\D*)(\d+(?:[.,]\d+)?)(\D*)$/.exec(el.textContent.trim());
      if (!m || reduce) return;
      el.dataset.cnt = "1";
      const [, pre, num, suf] = m, end = parseFloat(num.replace(",", ".")), dec = (num.split(/[.,]/)[1] || "").length;
      el.textContent = pre + (0).toFixed(dec) + suf;
      new IntersectionObserver((es, o) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        o.disconnect();
        const t0 = performance.now(), dur = 1300;
        const step = (t) => {
          const k = clamp((t - t0) / dur, 0, 1), v = end * (1 - Math.pow(1 - k, 3));
          el.textContent = pre + v.toFixed(dec) + suf;
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }), { threshold: 0.6 }).observe(el);
    });
  }

  /* ---------- Kursor bilan egilish (tilt) ---------- */
  function tilt() {
    if (!fine || reduce) return;
    [[".plan", 5], [".hero-image", 3], [".lead-card", 1.5]].forEach(([sel, deg]) => $$(sel).forEach((el) => {
      if (el.dataset.tilt) return;
      el.dataset.tilt = "1";
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ry", ((px - 0.5) * 2 * deg).toFixed(2) + "deg");
        el.style.setProperty("--rx", ((0.5 - py) * 2 * deg).toFixed(2) + "deg");
        el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      });
      el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
    }));
  }

  /* ---------- Countdown raqamlari "chayqaladi" ---------- */
  function flip() {
    if (reduce) return;
    $$(".countdown-number").forEach((el) => {
      if (el.dataset.fx) return;
      el.dataset.fx = "1";
      new MutationObserver(() => { el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  /* ---------- Coverflow slayder (Swiper uslubida) ---------- */
  FX.coverflow = ({ root, stage, slides, toggle }) => {
    const N = slides.length;
    if (!N || root.dataset.cf) return;
    root.dataset.cf = "1";
    root.classList.add("cf");
    let pos = 0, target = 0, raf = 0, auto = true, hover = false, dragging = false, visible = true, lastAuto = performance.now();

    const nav = document.createElement("div");
    nav.className = "cf-ui";
    nav.innerHTML = `<button class="cf-btn" data-k="-1" type="button" aria-label="Oldingi">‹</button>
      <div class="cf-dots" role="tablist">${slides.map((_, i) => `<button type="button" role="tab" data-i="${i}" aria-label="${i + 1}-slayd"></button>`).join("")}</div>
      <button class="cf-btn" data-k="1" type="button" aria-label="Keyingi">›</button>`;
    root.appendChild(nav);
    const dots = $$(".cf-dots button", nav);

    const S = () => clamp(root.clientWidth * 0.3, 150, 300);
    const wrap = (d) => ((((d + N / 2) % N) + N) % N) - N / 2;

    function layout() {
      const sp = S();
      slides.forEach((el, i) => {
        const d = wrap(i - pos), a = Math.abs(d), sg = Math.sign(d);
        const x = sg * (Math.min(a, 1) * sp + Math.max(a - 1, 0) * sp * 0.52);
        const rot = clamp(d, -1, 1) * -40;
        const z = -Math.min(a, 2.6) * 130;
        const sc = 1 - Math.min(a, 2.6) * 0.045;
        el.style.transform = `translateX(-50%) translate3d(${x.toFixed(1)}px,0,${z.toFixed(0)}px) rotateY(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
        el.style.opacity = clamp(1 - Math.max(0, a - 1.9) * 1.6, 0, 1).toFixed(2);
        el.style.zIndex = String(100 - Math.round(a * 10));
        el.style.filter = `brightness(${(1 - Math.min(a, 1) * 0.42).toFixed(2)})`;
        el.style.pointerEvents = a > 2.4 ? "none" : "auto";
        el.classList.toggle("is-active", a < 0.5);
      });
      const cur = ((Math.round(pos) % N) + N) % N;
      dots.forEach((b, i) => { b.classList.toggle("on", i === cur); b.setAttribute("aria-selected", String(i === cur)); });
    }
    function tick(now) {
      raf = 0;
      if (!dragging) {
        const diff = target - pos;
        pos = Math.abs(diff) > 0.0008 ? pos + diff * 0.12 : target;
      }
      layout();
      if (auto && !hover && !dragging && visible && now - lastAuto > 3300) { target = Math.round(target) + 1; lastAuto = now; }
      if (dragging || Math.abs(target - pos) > 0.0008 || (auto && visible)) raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const go = (k) => { target = Math.round(target) + k; lastAuto = performance.now(); kick(); };
    const goTo = (i) => { target = Math.round(pos) + wrap(i - Math.round(pos)); lastAuto = performance.now(); kick(); };

    // Surish (sichqoncha va sensor)
    let sx = 0, sp0 = 0, moved = 0, lx = 0, lt = 0, v = 0, pid = null;
    root.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".cf-ui") || (e.pointerType === "mouse" && e.button !== 0)) return;
      dragging = true; sx = lx = e.clientX; sp0 = pos; moved = 0; v = 0; lt = e.timeStamp; pid = e.pointerId;
      kick();
    });
    root.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== pid) return;
      const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      if (moved > 6 && !root.classList.contains("dragging")) { root.classList.add("dragging"); try { root.setPointerCapture(pid); } catch {} }
      pos = target = sp0 - dx / S();
      const dt = e.timeStamp - lt;
      if (dt > 0) { v = 0.8 * v + 0.2 * (-(e.clientX - lx) / S() / dt); lx = e.clientX; lt = e.timeStamp; }
    });
    const end = (e) => {
      if (!dragging || (e && e.pointerId !== pid)) return;
      dragging = false; root.classList.remove("dragging");
      if (moved <= 6) {
        const s = e && e.target.closest && e.target.closest(".community-shot"), i = slides.indexOf(s);
        if (i >= 0) goTo(i); else kick();
      } else {
        target = Math.round(pos + clamp(v * 220, -2, 2));
        lastAuto = performance.now(); kick();
      }
    };
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
    root.addEventListener("lostpointercapture", (e) => { if (e.target === root) end(e); }); // kartadagi yashirin capture yo'qolishi surishni tugatmasin

    nav.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.k) go(+b.dataset.k); else goTo(+b.dataset.i);
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); }
    });
    root.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hover = true; });
    root.addEventListener("pointerleave", () => { hover = false; lastAuto = performance.now(); kick(); });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { lastAuto = performance.now(); kick(); } }).observe(root);
    addEventListener("resize", () => { layout(); });

    if (toggle) toggle.addEventListener("click", () => {
      auto = !auto;
      toggle.setAttribute("aria-pressed", String(!auto));
      toggle.textContent = auto ? "❚❚ To‘xtatish" : "▶ Davom ettirish";
      lastAuto = performance.now(); kick();
    });
    layout(); kick();
  };

  FX.refresh = () => { reveal(); counters(); tilt(); };
  FX.init = () => {
    chrome(); heroTitle(); marquee(); chart(); flip(); FX.refresh();
    document.documentElement.dataset.fxReady = "1";
  };
})();
