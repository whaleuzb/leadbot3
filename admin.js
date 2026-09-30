/* trademove admin — vanilla JS */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => Number(n || 0).toLocaleString("ru-RU").replace(/ /g, " ");
const STATUS = { new: "Yangi", contacted: "Bog‘lanildi", paid: "To‘landi", rejected: "Rad etildi" };
const STATUS_COLOR = { new: "#7560b8", contacted: "#d9a21b", paid: "#2f7d57", rejected: "#b3372f" };

let toastTimer;
function toast(msg, error = false) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast show" + (error ? " error" : "");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = "toast"), 2800);
}

async function api(path, opts = {}) {
  const res = await fetch("/api/admin" + path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  if (res.status === 401 && path !== "/login") { showLogin(); throw new Error("Kirish kerak"); }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi");
  return data;
}
async function guard(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { toast(e.message, true); }
}

/* ---------- Kirish ---------- */
function showLogin() { $("#app").hidden = true; $("#login").hidden = false; $("#login-pw").focus(); }
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-error").textContent = "";
  try {
    const r = await api("/login", { method: "POST", body: { password: $("#login-pw").value } });
    $("#login-pw").value = "";
    start(r.defaultPassword);
  } catch (err) { $("#login-error").textContent = err.message; }
});
$("#logout").addEventListener("click", async () => { await api("/logout", { method: "POST" }).catch(() => {}); showLogin(); });

/* ---------- Marshrutlash ---------- */
const TABS = ["dashboard", "leads", "plans", "promos", "lessons", "audience", "settings", "security"];
const loaded = {};
function route() {
  const tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "dashboard";
  $$(".tab").forEach((s) => (s.hidden = s.id !== "tab-" + tab));
  $$("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
  const loader = { dashboard: loadDashboard, leads: loadLeads, plans: loadContent, promos: loadContent, lessons: loadContent, audience: loadContent, settings: loadContent }[tab];
  if (loader) guard(loader);
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

async function start(defaultPassword) {
  $("#login").hidden = true; $("#app").hidden = false;
  $("#warn").hidden = !defaultPassword;
  Object.keys(loaded).forEach((k) => delete loaded[k]);
  route();
  refreshBadge();
}
async function refreshBadge() {
  try {
    const { leads } = await api("/leads");
    const n = leads.filter((l) => l.status === "new").length;
    $("#nav-new").hidden = !n; $("#nav-new").textContent = n;
  } catch {}
}

/* ---------- Umumiy ko'rinish ---------- */
async function loadDashboard() {
  const [d, { leads }] = await Promise.all([api("/dashboard"), api("/leads")]);
  const t = d.totals;
  $("#kpis").innerHTML = [
    ["Tashriflar", money(t.views), "jami"],
    ["Tarif tugmasi bosildi", money(t.clicks), "jami"],
    ["Arizalar", money(t.leads), `konversiya ${t.conversion}%`],
    ["To‘langan", money(t.paid), "ta ariza"],
    ["Tushum", money(t.revenue), "so‘m (to‘langan arizalar)"],
    ["Berilgan chegirma", money(t.discount || 0), "so‘m (promo-kodlar)"],
  ].map(([l, v, s]) => `<div class="kpi"><span>${l}</span><strong>${v}</strong><small>${s}</small></div>`).join("");

  drawChart(d.series);

  const total = Object.values(d.byStatus).reduce((a, b) => a + b, 0) || 1;
  $("#status-bars").innerHTML = Object.keys(STATUS).map((k) =>
    `<div class="bar-row"><span>${STATUS[k]}</span><div class="track"><i style="width:${(d.byStatus[k] || 0) / total * 100}%;background:${STATUS_COLOR[k]}"></i></div><b>${d.byStatus[k] || 0}</b></div>`).join("");

  const names = [...new Set([...Object.keys(d.byPlan), ...Object.keys(d.clicksByPlan)])];
  $("#plan-table").innerHTML = names.length
    ? `<tr><th>Tarif</th><th class="num">Bosildi</th><th class="num">Ariza</th></tr>` +
      names.map((n) => `<tr><td>${esc(n)}</td><td class="num">${d.clicksByPlan[n] || 0}</td><td class="num">${d.byPlan[n] || 0}</td></tr>`).join("")
    : `<tr><td class="empty">Hali ma’lumot yo‘q</td></tr>`;

  $("#recent").innerHTML = leads.length
    ? leads.slice(0, 6).map((l) => `<div class="recent-item"><div><div class="lead-name">${esc(l.name)}</div><div class="lead-meta">${esc(l.plan || "—")} · ${fmtDate(l.createdAt)}</div></div><span class="pill ${l.status}">${STATUS[l.status]}</span></div>`).join("")
    : `<p class="empty">Hali ariza yo‘q. Saytdagi forma orqali kelgan arizalar shu yerda ko‘rinadi.</p>`;
}
function drawChart(series) {
  const W = 560, H = 220, L = 34, B = 26, T = 10, R = 6;
  const max = Math.max(4, ...series.map((s) => s.views));
  const top = Math.ceil(max / 4) * 4;
  const bw = (W - L - R) / series.length;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i;
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e6e2ee"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  series.forEach((s, i) => {
    const x = L + i * bw + bw * 0.14, w = bw * 0.72;
    g += `<rect x="${x}" y="${y(s.views)}" width="${w}" height="${H - B - y(s.views)}" rx="3" fill="#d6cafa"><title>${s.date}: ${s.views} tashrif</title></rect>`;
    if (s.leads) g += `<rect x="${x + w * 0.25}" y="${y(s.leads)}" width="${w * 0.5}" height="${H - B - y(s.leads)}" rx="3" fill="#7560b8"><title>${s.date}: ${s.leads} ariza</title></rect>`;
    if (i % 2 === 0 || series.length < 8) g += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${s.date.slice(8)}.${s.date.slice(5, 7)}</text>`;
  });
  $("#chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Oxirgi 14 kunlik tashrif va arizalar">${g}</svg>`;
}
const fmtDate = (iso) => {
  const d = new Date(new Date(iso).getTime() + 5 * 36e5);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

/* ---------- Arizalar ---------- */
let LEADS = [];
async function loadLeads() {
  LEADS = (await api("/leads")).leads;
  await ensureContent();
  const cur = $("#lead-plan").value;
  $("#lead-plan").innerHTML = `<option value="">Barcha tariflar</option>` + CONTENT.plans.map((p) => `<option>${esc(p.name)}</option>`).join("");
  $("#lead-plan").value = cur;
  renderLeads();
  refreshBadge();
}
function filteredLeads() {
  const q = $("#lead-search").value.trim().toLowerCase(), st = $("#lead-status").value, pl = $("#lead-plan").value;
  return LEADS.filter((l) => (!st || l.status === st) && (!pl || l.plan === pl) &&
    (!q || l.name.toLowerCase().includes(q) || l.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "\u0000") || l.phone.toLowerCase().includes(q)));
}
function renderLeads() {
  const rows = filteredLeads();
  $("#leads-sub").textContent = `${rows.length} ta ariza ko‘rsatilyapti · jami ${LEADS.length}`;
  $("#leads-table").innerHTML = rows.length
    ? `<tr><th>Mijoz</th><th>Tarif</th><th>Sana</th><th>Holat va izoh</th><th></th></tr>` + rows.map((l) => `
      <tr data-id="${l.id}">
        <td><div class="lead-name">${esc(l.name)}</div><div class="lead-meta"><a href="tel:${esc(l.phone.replace(/[^\d+]/g, ""))}">${esc(l.phone)}</a></div>${l.note ? `<div class="lead-meta">“${esc(l.note)}”</div>` : ""}</td>
        <td>${esc(l.plan || "—")}${l.price ? `<div class="lead-meta">${money(l.price)} so‘m${l.promo ? ` · <span class="pill paid">${esc(l.promo)}</span>` : ""}</div>` : ""}</td>
        <td class="lead-meta">${fmtDate(l.createdAt)}</td>
        <td><div class="lead-tools">
          <select data-act="status" aria-label="Holat">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${l.status === k ? " selected" : ""}>${v}</option>`).join("")}</select>
          <textarea data-act="note" rows="1" placeholder="Ichki izoh" aria-label="Ichki izoh">${esc(l.adminNote)}</textarea>
        </div></td>
        <td><button class="btn sm danger" data-act="delete" type="button">O‘chirish</button></td>
      </tr>`).join("")
    : `<tr><td class="empty">Ariza topilmadi.</td></tr>`;
}
["lead-search", "lead-status", "lead-plan"].forEach((id) => $("#" + id).addEventListener("input", renderLeads));
$("#leads-table").addEventListener("change", (e) => {
  const tr = e.target.closest("tr[data-id]"); if (!tr) return;
  const lead = LEADS.find((l) => l.id === tr.dataset.id);
  if (e.target.dataset.act === "status") guard(async () => { Object.assign(lead, await api("/leads/" + lead.id, { method: "PATCH", body: { status: e.target.value } })); refreshBadge(); }, "Holat yangilandi");
  if (e.target.dataset.act === "note") guard(async () => { Object.assign(lead, await api("/leads/" + lead.id, { method: "PATCH", body: { adminNote: e.target.value } })); }, "Izoh saqlandi");
});
$("#leads-table").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act=delete]"); if (!btn) return;
  const tr = btn.closest("tr");
  if (btn.dataset.armed !== "1") { btn.dataset.armed = "1"; btn.textContent = "Ishonchingiz komilmi?"; setTimeout(() => { btn.dataset.armed = ""; btn.textContent = "O‘chirish"; }, 3000); return; }
  guard(async () => { await api("/leads/" + tr.dataset.id, { method: "DELETE" }); LEADS = LEADS.filter((l) => l.id !== tr.dataset.id); renderLeads(); refreshBadge(); }, "Ariza o‘chirildi");
});
$("#export-csv").addEventListener("click", () => {
  const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const rows = [["Sana", "Ism", "Telefon", "Tarif", "Narx", "Promo-kod", "Holat", "Xabar", "Izoh"], ...filteredLeads().map((l) => [fmtDate(l.createdAt), l.name, l.phone, l.plan, l.price ?? "", l.promo || "", STATUS[l.status], l.note, l.adminNote])];
  const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "arizalar.csv" });
  a.click(); URL.revokeObjectURL(a.href);
});

/* ---------- Kontent (tariflar, darslar, sozlamalar) ---------- */
let CONTENT = null;
async function ensureContent() { if (!CONTENT) CONTENT = await api("/all"); }
async function loadContent() { CONTENT = await api("/all"); renderPlans(); renderPromos(); renderLessons(); renderAudience(); renderSettings(); }
const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

/* ---------- Rasm yuklash (umumiy) ---------- */
const imgField = (url) => `<div class="img-field">
  ${url ? `<img class="img-thumb" src="${esc(url)}" alt="Yuklangan rasm" />` : `<span class="img-thumb empty">Rasm yo‘q</span>`}
  <button class="btn sm" data-act="img" type="button">${url ? "Rasmni almashtirish" : "Rasm yuklash"}</button>
  ${url ? `<button class="btn sm danger" data-act="imgdel" type="button">Olib tashlash</button>` : ""}
  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-file hidden aria-label="Rasm tanlash" />
</div>`;
async function shrink(file) {
  if (!/^image\//.test(file.type)) throw new Error("Faqat rasm fayli tanlang");
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Rasmni o‘qib bo‘lmadi"))), "image/jpeg", 0.85));
}
async function uploadImage(file) {
  const blob = await shrink(file);
  const r = await fetch("/api/admin/upload", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob, credentials: "same-origin" });
  if (r.status === 401) { showLogin(); throw new Error("Kirish kerak"); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Yuklab bo‘lmadi");
  return d.url;
}
/* editor: konteyner, ma'lumot massivi olish funksiyasi, qayta chizish */
function wireImages(container, getArr, rerender) {
  container.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act=img],[data-act=imgdel]"); if (!b) return;
    const row = b.closest("[data-i]"); if (!row) return;
    if (b.dataset.act === "imgdel") { getArr()[row.dataset.i].image = ""; rerender(); return; }
    $("[data-file]", row).click();
  });
  container.addEventListener("change", async (e) => {
    if (!e.target.matches("[data-file]")) return;
    const row = e.target.closest("[data-i]"), file = e.target.files[0]; if (!file) return;
    toast("Rasm yuklanmoqda…");
    try { getArr()[row.dataset.i].image = await uploadImage(file); rerender(); toast("Rasm yuklandi. Oxirida “Saqlash” bosing."); }
    catch (err) { toast(err.message, true); }
    e.target.value = "";
  });
}

/* Tariflar */
const discPct = (old, price) => (old > price && price >= 0 ? Math.round((1 - price / old) * 100) : 0);
const discInfo = (p) => (p.oldPrice > p.price ? `Chegirma: −${discPct(p.oldPrice, p.price)}% (${money(p.oldPrice - p.price)} so‘m)` : "Chegirma yo‘q");
function renderPlans() {
  const plans = CONTENT.plans;
  $("#plans-editor").innerHTML = plans.map((p, i) => `
    <div class="card editor-card" data-i="${i}">
      <div class="editor-head"><strong>${i + 1}. ${esc(p.name)}</strong>
        <div class="editor-tools">
          <button class="btn sm" data-act="up" type="button" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="btn sm" data-act="down" type="button" ${i === plans.length - 1 ? "disabled" : ""}>↓</button>
          ${p.oldPrice > p.price ? `<button class="btn sm" data-act="nodisc" type="button">Chegirmani bekor qilish</button>` : ""}
          <button class="btn sm danger" data-act="del" type="button">O‘chirish</button>
        </div></div>
      <div class="fields">
        <div><label>Nomi</label><input data-f="name" value="${esc(p.name)}" maxlength="40" /></div>
        <div><label>Narx (so‘m)</label><input data-f="price" type="number" min="0" step="1000" value="${p.price}" /></div>
        <div><label>Yorliq (eyebrow)</label><input data-f="eyebrow" value="${esc(p.eyebrow)}" maxlength="40" /></div>
        <div><label>Nishon (badge)</label><input data-f="badge" value="${esc(p.badge)}" maxlength="40" placeholder="Masalan: 10 TA JOY" /></div>
        <div><label>Chegirma, %</label><input data-f="pct" type="number" min="0" max="90" value="${discPct(p.oldPrice, p.price) || ""}" placeholder="Masalan: 20" /><small>Foiz kiritsangiz, narx avtomatik hisoblanadi</small></div>
        <div><label>Eski narx (chegirmadan oldin)</label><input data-f="oldPrice" type="number" min="0" step="1000" value="${p.oldPrice || 0}" placeholder="0 = chegirma yo‘q" /><small>${discInfo(p)}</small></div>
        <div><label>Chegirma tugash vaqti</label><input data-f="discountUntil" type="datetime-local" value="${p.discountUntil ? toLocalInput(p.discountUntil) : ""}" /><small>Bo‘sh = muddatsiz</small></div>
        <div class="span2"><label>Muddat</label><input data-f="duration" value="${esc(p.duration)}" maxlength="80" /></div>
        <div class="span3"><label>Karta rasmi</label>${imgField(p.image)}</div>
        <div class="span3"><label>Tavsif</label><textarea data-f="description" rows="2" maxlength="300">${esc(p.description)}</textarea></div>
        <div class="span2"><label>Nimalar kiradi (har qatorda bittadan)</label><textarea data-f="features" rows="8">${esc(p.features.join("\n"))}</textarea></div>
        <div><label>Kirmaydi (har qatorda bittadan)</label><textarea data-f="excluded" rows="3">${esc(p.excluded.join("\n"))}</textarea>
          <label class="check" style="margin-top:12px"><input type="checkbox" data-f="featured" ${p.featured ? "checked" : ""} /> Ajratib ko‘rsatish (lilac fon)</label></div>
      </div>
    </div>`).join("");
}
$("#plans-editor").addEventListener("input", (e) => {
  const card = e.target.closest("[data-i]"), f = e.target.dataset.f; if (!card || !f) return;
  const p = CONTENT.plans[card.dataset.i];
  if (f === "features" || f === "excluded") p[f] = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean);
  else if (f === "featured") p.featured = e.target.checked;
  else if (f === "price" || f === "oldPrice") { p[f] = Number(e.target.value) || 0; const sm = e.target.closest(".fields").querySelector('[data-f=oldPrice]').parentElement.querySelector("small"); sm.textContent = discInfo(p); }
  else if (f === "pct") {
    const pct = Math.min(90, Math.max(0, Number(e.target.value) || 0)), base = p.oldPrice > p.price ? p.oldPrice : p.price;
    if (pct) { p.oldPrice = base; p.price = Math.round(base * (100 - pct) / 100 / 1000) * 1000; } else { p.price = base; p.oldPrice = 0; p.discountUntil = ""; }
    const f2 = e.target.closest(".fields");
    f2.querySelector("[data-f=price]").value = p.price; f2.querySelector("[data-f=oldPrice]").value = p.oldPrice || 0;
    f2.querySelector("[data-f=oldPrice]").parentElement.querySelector("small").textContent = discInfo(p);
  }
  else if (f === "discountUntil") p.discountUntil = e.target.value ? fromLocalInput(e.target.value) : "";
  else { p[f] = e.target.value; if (f === "name") $("strong", card).textContent = `${+card.dataset.i + 1}. ${e.target.value}`; }
});
$("#plans-editor").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"), card = e.target.closest("[data-i]"); if (!b || !card || b.dataset.act.startsWith("img")) return;
  const i = +card.dataset.i, plans = CONTENT.plans;
  if (b.dataset.act === "up") move(plans, i, -1);
  if (b.dataset.act === "down") move(plans, i, 1);
  if (b.dataset.act === "nodisc") { plans[i].price = plans[i].oldPrice || plans[i].price; plans[i].oldPrice = 0; plans[i].discountUntil = ""; }
  if (b.dataset.act === "del") {
    if (plans.length === 1) return toast("Kamida bitta tarif qolishi kerak", true);
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tasdiqlang"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "O‘chirish"; }, 3000); return; }
    plans.splice(i, 1);
  }
  renderPlans();
});
$("#add-plan").addEventListener("click", () => {
  CONTENT.plans.push({ id: "", eyebrow: String(CONTENT.plans.length + 1).padStart(2, "0") + " / YANGI", badge: "", name: "Yangi tarif", description: "", price: 0, duration: "", featured: false, image: "", oldPrice: 0, discountUntil: "", features: [], excluded: [] });
  renderPlans(); $$("#plans-editor .card").at(-1).scrollIntoView({ behavior: "smooth", block: "center" });
});
$("#bd-apply").addEventListener("click", () => {
  const pct = Number($("#bd-pct").value);
  if (!(pct >= 1 && pct <= 90)) return toast("Chegirma 1 dan 90 gacha bo‘lsin", true);
  const until = $("#bd-until").value ? fromLocalInput($("#bd-until").value) : "";
  if (until && Date.parse(until) <= Date.now()) return toast("Tugash vaqti kelajakda bo‘lsin", true);
  CONTENT.plans.forEach((p) => { const base = p.oldPrice > p.price ? p.oldPrice : p.price; p.oldPrice = base; p.price = Math.round(base * (100 - pct) / 100 / 1000) * 1000; p.discountUntil = until; });
  renderPlans(); toast(`−${pct}% qo‘llandi. Saqlash tugmasini bosing.`);
});
$("#bd-clear").addEventListener("click", () => {
  CONTENT.plans.forEach((p) => { if (p.oldPrice > p.price) p.price = p.oldPrice; p.oldPrice = 0; p.discountUntil = ""; });
  renderPlans(); toast("Chegirmalar bekor qilindi. Saqlash tugmasini bosing.");
});
$("#save-plans").addEventListener("click", () => guard(async () => { CONTENT.plans = await api("/plans", { method: "PUT", body: { plans: CONTENT.plans } }); renderPlans(); }, "Tariflar saqlandi — saytda yangilandi"));

/* Promo-kodlar */
const genCode = () => "TM" + Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
function renderPromos() {
  const P = CONTENT.promos;
  $("#promo-editor").innerHTML = P.length ? P.map((x, i) => `
    <div class="card editor-card" data-i="${i}">
      <div class="editor-head"><strong>${esc(x.code || "Yangi promo-kod")} <span class="pill ${x.active ? "paid" : "rejected"}">${x.active ? "Faol" : "O‘chirilgan"}</span></strong>
        <div class="editor-tools"><span class="lead-meta">Ishlatilgan: <b>${x.used || 0}</b>${x.maxUses ? " / " + x.maxUses : " (cheksiz)"}</span><button class="btn sm danger" data-act="del" type="button">O‘chirish</button></div></div>
      <div class="fields">
        <div><label>Kod</label><input data-f="code" value="${esc(x.code)}" maxlength="30" style="text-transform:uppercase" /><button class="link-btn" data-act="gen" type="button">Tasodifiy kod</button></div>
        <div><label>Turi</label><select data-f="type"><option value="percent"${x.type === "percent" ? " selected" : ""}>Foiz (%)</option><option value="fixed"${x.type === "fixed" ? " selected" : ""}>Aniq summa (so‘m)</option></select></div>
        <div><label>Chegirma qiymati</label><input data-f="value" type="number" min="1" value="${x.value}" /></div>
        <div><label>Necha marta ishlatilsin</label><input data-f="maxUses" type="number" min="0" value="${x.maxUses || 0}" /><small>0 = cheklanmagan</small></div>
        <div><label>Amal qilish muddati</label><input data-f="expiresAt" type="datetime-local" value="${x.expiresAt ? toLocalInput(x.expiresAt) : ""}" /><small>Bo‘sh = muddatsiz</small></div>
        <div><label class="check" style="margin-top:26px"><input type="checkbox" data-f="active" ${x.active ? "checked" : ""} /> Faol</label></div>
        <fieldset class="span3"><legend>Qaysi tariflarga amal qiladi</legend><div class="plan-checks">
          ${CONTENT.plans.filter((p) => p.id).map((p) => `<label class="check"><input type="checkbox" data-plan="${esc(p.id)}" ${x.plans.includes(p.id) ? "checked" : ""}/> ${esc(p.name)}</label>`).join("")}
        </div><small>Hech biri belgilanmasa — barcha tariflarga.</small></fieldset>
      </div>
    </div>`).join("") : `<div class="card empty">Promo-kodlar yo‘q. “+ Promo-kod” tugmasini bosing.</div>`;
}
$("#promo-editor").addEventListener("input", (e) => {
  const card = e.target.closest("[data-i]"); if (!card) return;
  const x = CONTENT.promos[card.dataset.i], f = e.target.dataset.f;
  if (e.target.dataset.plan) { x.plans = e.target.checked ? [...new Set([...x.plans, e.target.dataset.plan])] : x.plans.filter((p) => p !== e.target.dataset.plan); return; }
  if (!f) return;
  if (f === "active") x.active = e.target.checked;
  else if (f === "value" || f === "maxUses") x[f] = Number(e.target.value) || 0;
  else if (f === "expiresAt") x.expiresAt = e.target.value ? fromLocalInput(e.target.value) : "";
  else if (f === "code") x.code = e.target.value.toUpperCase();
  else x[f] = e.target.value;
});
$("#promo-editor").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"), card = e.target.closest("[data-i]"); if (!b || !card) return;
  const i = +card.dataset.i;
  if (b.dataset.act === "gen") CONTENT.promos[i].code = genCode();
  if (b.dataset.act === "del") {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tasdiqlang"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "O‘chirish"; }, 3000); return; }
    CONTENT.promos.splice(i, 1);
  }
  renderPromos();
});
$("#add-promo").addEventListener("click", () => { CONTENT.promos.push({ id: "", code: genCode(), type: "percent", value: 10, plans: [], maxUses: 0, used: 0, expiresAt: "", active: true }); renderPromos(); $$("#promo-editor .card").at(-1).scrollIntoView({ behavior: "smooth", block: "center" }); });
$("#save-promos").addEventListener("click", () => guard(async () => { CONTENT.promos = await api("/promos", { method: "PUT", body: { promos: CONTENT.promos } }); renderPromos(); }, "Promo-kodlar saqlandi"));

/* Darslar */
function renderLessons() {
  const ls = CONTENT.lessons;
  $("#lessons-editor").innerHTML = ls.length ? `<div class="card stack">` + ls.map((l, i) => `
    <div class="lesson-row" data-i="${i}">
      <span class="idx">${String(i + 1).padStart(2, "0")}</span>
      <input data-f="t" value="${esc(l.t)}" maxlength="50" aria-label="Dars nomi" placeholder="Dars nomi" />
      <input class="l-desc" data-f="d" value="${esc(l.d)}" maxlength="100" aria-label="Qisqa tavsif" placeholder="Qisqa tavsif" />
      <span class="editor-tools"><button class="btn sm" data-act="up" type="button" ${i === 0 ? "disabled" : ""}>↑</button><button class="btn sm" data-act="down" type="button" ${i === ls.length - 1 ? "disabled" : ""}>↓</button><button class="btn sm danger" data-act="del" type="button">×</button></span>
      ${imgField(l.image)}
    </div>`).join("") + `</div>` : `<div class="card empty">Darslar yo‘q. “+ Dars qo‘shish” tugmasini bosing.</div>`;
}
$("#lessons-editor").addEventListener("input", (e) => {
  const row = e.target.closest("[data-i]"); if (row && e.target.dataset.f) CONTENT.lessons[row.dataset.i][e.target.dataset.f] = e.target.value;
});
$("#lessons-editor").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"), row = e.target.closest("[data-i]"); if (!b || !row || b.dataset.act.startsWith("img")) return;
  const i = +row.dataset.i;
  if (b.dataset.act === "up") move(CONTENT.lessons, i, -1);
  if (b.dataset.act === "down") move(CONTENT.lessons, i, 1);
  if (b.dataset.act === "del") CONTENT.lessons.splice(i, 1);
  renderLessons();
});
$("#add-lesson").addEventListener("click", () => { CONTENT.lessons.push({ n: "", t: "", d: "", image: "" }); renderLessons(); $$("#lessons-editor input").at(-2)?.focus(); });
$("#save-lessons").addEventListener("click", () => guard(async () => { CONTENT.lessons = await api("/lessons", { method: "PUT", body: { lessons: CONTENT.lessons } }); renderLessons(); }, "Darslar saqlandi"));

/* Kimga mos */
function renderAudience() {
  const a = CONTENT.audience;
  $("#aud-editor").innerHTML = a.length ? `<div class="card stack">` + a.map((t, i) => `
    <div class="lesson-row aud-row" data-i="${i}">
      <span class="idx">${String(i + 1).padStart(2, "0")}</span>
      <textarea data-f="t" rows="2" maxlength="300" aria-label="Karta matni ${i + 1}">${esc(t.t)}</textarea>
      <span class="editor-tools"><button class="btn sm" data-act="up" type="button" ${i === 0 ? "disabled" : ""}>↑</button><button class="btn sm" data-act="down" type="button" ${i === a.length - 1 ? "disabled" : ""}>↓</button><button class="btn sm danger" data-act="del" type="button">×</button></span>
      ${imgField(t.image)}
    </div>`).join("") + `</div>` : `<div class="card empty">Kartalar yo‘q. “+ Karta qo‘shish” tugmasini bosing.</div>`;
}
$("#aud-editor").addEventListener("input", (e) => { const r = e.target.closest("[data-i]"); if (r && e.target.matches("textarea")) CONTENT.audience[r.dataset.i].t = e.target.value; });
$("#aud-editor").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"), r = e.target.closest("[data-i]"); if (!b || !r || b.dataset.act.startsWith("img")) return;
  const i = +r.dataset.i;
  if (b.dataset.act === "up") move(CONTENT.audience, i, -1);
  if (b.dataset.act === "down") move(CONTENT.audience, i, 1);
  if (b.dataset.act === "del") CONTENT.audience.splice(i, 1);
  renderAudience();
});
$("#add-aud").addEventListener("click", () => { CONTENT.audience.push({ t: "", image: "" }); renderAudience(); $$("#aud-editor textarea").at(-1)?.focus(); });
$("#save-aud").addEventListener("click", () => guard(async () => { CONTENT.audience = await api("/audience", { method: "PUT", body: { audience: CONTENT.audience } }); renderAudience(); }, "Kartalar saqlandi — saytda yangilandi"));

/* Sozlamalar */
function heroPreview() {
  $("#hero-preview").innerHTML = "Ko‘rinishi: <b>" + [$("#h-t1").value, "<span style='color:var(--accent)'>" + esc($("#h-acc").value) + "</span>", $("#h-t3").value].map((x, i) => i === 1 ? x : esc(x)).join(" / ") + "</b>";
}
["h-t1", "h-acc", "h-t3"].forEach((id) => $("#" + id).addEventListener("input", heroPreview));
const toLocalInput = (iso) => new Date(Date.parse(iso) + 5 * 36e5).toISOString().slice(0, 16);
const fromLocalInput = (v) => v + ":00+05:00";
function renderSettings() {
  const s = CONTENT.settings;
  $("#s-brand").value = s.brand; $("#s-author").value = s.authorName; $("#s-tg").value = s.telegram;
  $("#s-open").value = String(s.enrollmentOpen); $("#s-promo").value = String(!!s.promoEnabled);
  $("#s-start").value = toLocalInput(s.enrollStart); $("#s-end").value = toLocalInput(s.enrollEnd);
  $("#s-risk").value = s.riskNote;
  const H = s.hero;
  $("#h-eyebrow").value = H.eyebrow; $("#h-t1").value = H.title1; $("#h-acc").value = H.accent; $("#h-t3").value = H.title3;
  $("#h-intro").value = H.intro; $("#h-note").value = H.note; $("#h-clabel").value = H.captionLabel; $("#h-caption").value = H.caption;
  heroPreview();
  $("#stats-editor").innerHTML = s.stats.map((x, i) => `<div><input data-i="${i}" data-k="value" value="${esc(x.value)}" maxlength="20" aria-label="Qiymat ${i + 1}" /><input data-i="${i}" data-k="label" value="${esc(x.label)}" maxlength="60" aria-label="Izoh ${i + 1}" /></div>`).join("");
}
$("#save-settings").addEventListener("click", () => guard(async () => {
  if (!$("#s-start").value || !$("#s-end").value) throw new Error("Sanalarni to‘ldiring");
  if ($("#s-end").value <= $("#s-start").value) throw new Error("Tugash sanasi boshlanishdan keyin bo‘lishi kerak");
  const body = {
    brand: $("#s-brand").value, authorName: $("#s-author").value, telegram: $("#s-tg").value,
    enrollmentOpen: $("#s-open").value === "true", promoEnabled: $("#s-promo").value === "true", enrollStart: fromLocalInput($("#s-start").value), enrollEnd: fromLocalInput($("#s-end").value),
    riskNote: $("#s-risk").value,
    hero: { eyebrow: $("#h-eyebrow").value, title1: $("#h-t1").value, accent: $("#h-acc").value, title3: $("#h-t3").value,
      intro: $("#h-intro").value, note: $("#h-note").value, captionLabel: $("#h-clabel").value, caption: $("#h-caption").value },
    stats: $$("#stats-editor div").map((d) => ({ value: $("[data-k=value]", d).value, label: $("[data-k=label]", d).value })),
  };
  CONTENT.settings = await api("/settings", { method: "PUT", body }); renderSettings();
}, "Sozlamalar saqlandi — saytda yangilandi"));

/* ---------- Xavfsizlik ---------- */
$("#pw-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#pw-error"); err.textContent = "";
  if ($("#pw-new").value !== $("#pw-rep").value) { err.textContent = "Yangi parollar mos emas"; return; }
  try {
    await api("/password", { method: "POST", body: { current: $("#pw-cur").value, next: $("#pw-new").value } });
    e.target.reset(); $("#warn").hidden = true; toast("Parol yangilandi");
  } catch (ex) { err.textContent = ex.message; }
});

wireImages($("#plans-editor"), () => CONTENT.plans, renderPlans);
wireImages($("#lessons-editor"), () => CONTENT.lessons, renderLessons);
wireImages($("#aud-editor"), () => CONTENT.audience, renderAudience);

/* ---------- Boshlash ---------- */
(async () => {
  try { const me = await api("/me"); start(me.defaultPassword); } catch { showLogin(); }
})();
