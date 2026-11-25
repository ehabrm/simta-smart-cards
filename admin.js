"use strict";
const CFG = window.SIMTA_CONFIG || {};
const API = (CFG.API_BASE || "").replace(/\/$/, "");
const TOKEN_KEY = "simta_admin_token";
const LANG_KEY = "simta_admin_lang";

const I = {
 ar: {
  title:"SIMTA | لوحة التحكم", loginTitle:"تسجيل دخول المسؤول", email:"البريد الإلكتروني", password:"كلمة المرور", signIn:"دخول", signOut:"خروج",
  tabDash:"نظرة عامة", tabEmps:"الموظفون", tabAudit:"سجل التغييرات", total:"إجمالي الموظفين", active:"نشط", inactive:"غير نشط", withPhoto:"لديهم صورة",
  byDept:"حسب القسم", recent:"آخر التعديلات", noDept:"بدون قسم", search:"بحث بالرقم أو الاسم أو القسم أو المسمى", all:"الكل", add:"إضافة موظف",
  id:"الرقم الوظيفي", nameAr:"الاسم بالعربي", nameEn:"الاسم بالإنجليزي", titleAr:"المسمى بالعربي", titleEn:"المسمى بالإنجليزي", dept:"القسم (رمز)", deptAr:"القسم بالعربي", deptEn:"القسم بالإنجليزي",
  phone:"الهاتف", whatsapp:"واتساب", mail:"البريد الإلكتروني", locAr:"الموقع بالعربي", locEn:"الموقع بالإنجليزي", photo:"الصورة", choosePhoto:"اختيار صورة", removePhoto:"حذف الصورة",
  save:"حفظ", cancel:"إلغاء", edit:"تعديل", preview:"البطاقة", deactivate:"إيقاف", reactivate:"تفعيل", status:"الحالة", employee:"الموظف", contact:"التواصل", actions:"إجراءات",
  statusActive:"نشط", statusInactive:"موقوف", none:"لا يوجد موظفون مطابقون", count:"عدد", newEmp:"موظف جديد", editEmp:"تعديل الموظف", saved:"تم الحفظ", copied:"تم نسخ الرابط",
  cardUrl:"رابط البطاقة", copy:"نسخ", qr:"رمز QR", downloadPng:"تحميل PNG", downloadSvg:"تحميل SVG", openCard:"فتح البطاقة", close:"إغلاق", confirmDeact:"إيقاف هذا الموظف؟ لن يظهر في البطاقة العامة، وتبقى بياناته محفوظة.",
  confirmReact:"إعادة تفعيل هذا الموظف؟", deactDone:"تم الإيقاف", reactDone:"تمت إعادة التفعيل", idHint:"مثال: SMT-005", loading:"جارٍ التحميل…", netErr:"تعذّر الاتصال بالخدمة", sessionEnd:"انتهت الجلسة، سجّل الدخول مرة أخرى",
  time:"الوقت", user:"المستخدم", action:"الإجراء", entity:"العنصر", details:"التفاصيل", prev:"السابق", next:"التالي", photoBad:"الملف ليس صورة صالحة", photoBig:"الصورة كبيرة جدًا", readOnly:"صلاحيتك للقراءة فقط", role:"الدور",
  sortBy:"ترتيب حسب", sortDir:"اتجاه الترتيب", sort_id:"الرقم الوظيفي", sort_name:"الاسم", sort_dept:"القسم", sort_title:"المسمى", sort_updated:"آخر تعديل",
  cardPreviewNote:"المعاينة تعرض البطاقة العامة الحقيقية. الموظف الموقوف يظهر كغير موجود.", extra:"حقول إضافية (اختياري)", extraHint:"مفتاح=قيمة، سطر لكل حقل"
 },
 en: {
  title:"SIMTA | Admin", loginTitle:"Admin sign in", email:"Email", password:"Password", signIn:"Sign in", signOut:"Sign out",
  tabDash:"Overview", tabEmps:"Employees", tabAudit:"Audit log", total:"Total employees", active:"Active", inactive:"Inactive", withPhoto:"With photo",
  byDept:"By department", recent:"Recent changes", noDept:"No department", search:"Search by ID, name, department or job title", all:"All", add:"Add employee",
  id:"Employee ID", nameAr:"Arabic name", nameEn:"English name", titleAr:"Arabic job title", titleEn:"English job title", dept:"Department (code)", deptAr:"Arabic department", deptEn:"English department",
  phone:"Phone", whatsapp:"WhatsApp", mail:"Email", locAr:"Arabic location", locEn:"English location", photo:"Photo", choosePhoto:"Choose photo", removePhoto:"Remove photo",
  save:"Save", cancel:"Cancel", edit:"Edit", preview:"Card", deactivate:"Deactivate", reactivate:"Reactivate", status:"Status", employee:"Employee", contact:"Contact", actions:"Actions",
  statusActive:"Active", statusInactive:"Inactive", none:"No matching employees", count:"Count", newEmp:"New employee", editEmp:"Edit employee", saved:"Saved", copied:"Link copied",
  cardUrl:"Card URL", copy:"Copy", qr:"QR code", downloadPng:"Download PNG", downloadSvg:"Download SVG", openCard:"Open card", close:"Close", confirmDeact:"Deactivate this employee? Their public card stops working, but their record is kept.",
  confirmReact:"Reactivate this employee?", deactDone:"Deactivated", reactDone:"Reactivated", idHint:"e.g. SMT-005", loading:"Loading…", netErr:"Could not reach the service", sessionEnd:"Session ended, please sign in again",
  time:"Time", user:"User", action:"Action", entity:"Item", details:"Details", prev:"Previous", next:"Next", photoBad:"Not a valid image", photoBig:"Image too large", readOnly:"Your role is read-only", role:"Role",
  sortBy:"Sort by", sortDir:"Sort direction", sort_id:"Employee ID", sort_name:"Name", sort_dept:"Department", sort_title:"Job title", sort_updated:"Last updated",
  cardPreviewNote:"The preview shows the real public card. A deactivated employee shows as not found.", extra:"Extra fields (optional)", extraHint:"key=value, one per line"
 }
};
let lang = localStorage.getItem(LANG_KEY) || "ar";
let token = sessionStorage.getItem(TOKEN_KEY) || "";
let me = null;
const t = (k) => I[lang][k] || k;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, ""); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
function toast(m) { const e = $("#toast"); e.textContent = m; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("on"), 2200); }
function cardUrl(id) {
  const base = CFG.CARD_BASE_URL || new URL("card.html", location.href).href;
  return base + "?id=" + encodeURIComponent(id);
}
function applyLang() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.title = t("title");
  $$("[data-i]").forEach((n) => n.textContent = t(n.dataset.i));
  $$(".langbtn").forEach((b) => b.textContent = lang === "ar" ? "English" : "العربية");
  if (me) { $("#who").textContent = `${me.email} · ${me.role}`; showTab(currentTab, true); }
}
$$(".langbtn").forEach((b) => b.addEventListener("click", () => { lang = lang === "ar" ? "en" : "ar"; localStorage.setItem(LANG_KEY, lang); applyLang(); }));

async function api(method, path, body, opts = {}) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  let b;
  if (opts.raw) { headers["Content-Type"] = opts.contentType; b = opts.raw; }
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; b = JSON.stringify(body); }
  let res;
  try { res = await fetch(API + path, { method, headers, body: b }); }
  catch (e) { const er = new Error(t("netErr")); er.net = true; throw er; }
  let data = null; try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && token && !path.startsWith("/api/auth/login")) { signedOut(t("sessionEnd")); const er = new Error(t("sessionEnd")); er.auth = true; throw er; }
  if (!res.ok) { const er = new Error((data && data.error) || ("HTTP " + res.status)); er.status = res.status; er.details = data && data.details; throw er; }
  return data;
}

// ---------- auth ----------
function signedOut(msg) {
  token = ""; me = null; sessionStorage.removeItem(TOKEN_KEY);
  $("#appView").classList.add("hidden"); $("#loginView").classList.remove("hidden");
  const e = $("#loginErr"); if (msg) { e.textContent = msg; e.classList.remove("hidden"); } else e.classList.add("hidden");
}
$("#loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = $("#loginForm button"); btn.disabled = true;
  try {
    const r = await api("POST", "/api/auth/login", { email: $("#lemail").value, password: $("#lpass").value });
    token = r.token; sessionStorage.setItem(TOKEN_KEY, token); $("#lpass").value = "";
    await enter();
  } catch (e) { signedOut(e.message); }
  btn.disabled = false;
});
$("#logoutBtn").addEventListener("click", async () => { try { await api("POST", "/api/auth/logout"); } catch { /* ignore */ } signedOut(""); });
const canEdit = () => me && (me.role === "admin" || me.role === "editor");

async function enter() {
  const r = await api("GET", "/api/auth/me"); me = r.user;
  $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden");
  $("#auditTab").classList.toggle("hidden", me.role !== "admin");
  $$(".tab").forEach((b) => b.onclick = () => showTab(b.dataset.tab));
  applyLang();
}
let currentTab = "dash";
function showTab(name, keep) {
  currentTab = name;
  $$(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  ["dash", "emps", "audit"].forEach((s) => $("#" + s).classList.toggle("hidden", s !== name));
  if (name === "dash") renderDash(); else if (name === "emps") renderEmps(); else if (name === "audit") renderAudit();
}

// ---------- dashboard ----------
async function renderDash() {
  const box = $("#dash"); box.replaceChildren(el("p", { class: "muted" }, t("loading")));
  try {
    const s = await api("GET", "/api/admin/stats");
    const stat = (n, l) => el("div", { class: "card stat" }, el("b", {}, n), el("span", {}, l));
    const max = Math.max(1, ...s.departments.map((d) => d.n));
    const nm = (r) => lang === "ar" ? (r.name_ar || r.name_en) : (r.name_en || r.name_ar);
    box.replaceChildren(
      el("div", { class: "grid stats" }, stat(s.total, t("total")), stat(s.active, t("active")), stat(s.inactive, t("inactive")), stat(s.with_photo, t("withPhoto"))),
      el("div", { class: "grid two", style: "margin-top:14px" },
        el("div", { class: "card" }, el("h2", {}, t("byDept")),
          s.departments.length ? s.departments.map((d) => el("div", { class: "deptbar" }, el("span", { style: "min-width:110px" }, (lang === "ar" ? d.dept_ar : d.dept_en) || d.department || t("noDept")), el("i", { style: `width:${Math.round(d.n / max * 100)}%;min-width:8px` }), el("b", {}, d.n))) : el("p", { class: "muted" }, "—")),
        el("div", { class: "card" }, el("h2", {}, t("recent")),
          s.recent.length ? s.recent.map((r) => el("div", { class: "deptbar" }, el("span", { class: "mono" }, r.id), el("span", { style: "flex:1" }, nm(r)), el("span", { class: "badge " + (r.active ? "on" : "off") }, r.active ? t("statusActive") : t("statusInactive")))) : el("p", { class: "muted" }, "—"))
      ));
  } catch (e) { if (!e.auth) box.replaceChildren(el("div", { class: "err" }, e.message)); }
}

// ---------- employees ----------
let query = { q: "", status: "all", offset: 0, sort: "id", dir: "asc" }; const PAGE = 25;
function avatar(emp, big) {
  const a = el("div", { class: "av" + (big ? " lg" : "") });
  const nm = (emp.name_en || emp.name_ar || "?").trim();
  if (emp.photo_url) { const im = el("img", { alt: "", src: API + emp.photo_url }); im.onerror = () => { a.replaceChildren(nm[0].toUpperCase()); }; a.append(im); }
  else a.append(nm[0].toUpperCase());
  return a;
}
async function renderEmps() {
  const box = $("#emps");
  if (!$("#empList", box) || box.dataset.lang !== lang) { // rebuild the toolbar when the language changes so labels are translated
    box.dataset.lang = lang;
    const search = el("input", { type: "search", id: "q", placeholder: t("search"), "aria-label": t("search"), value: query.q });
    let tm; search.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => { query.q = search.value; query.offset = 0; loadEmps(); }, 250); });
    const sel = el("select", { id: "stat", "aria-label": t("status") }, ...["all", "active", "inactive"].map((v) => el("option", { value: v }, v === "all" ? t("all") : v === "active" ? t("statusActive") : t("statusInactive"))));
    sel.value = query.status; sel.addEventListener("change", () => { query.status = sel.value; query.offset = 0; loadEmps(); });
    const sortSel = el("select", { id: "sortBy", "aria-label": t("sortBy") }, ...["id", "name", "dept", "title", "updated"].map((v) => el("option", { value: v }, t("sort_" + v))));
    sortSel.value = query.sort; sortSel.addEventListener("change", () => { query.sort = sortSel.value; query.offset = 0; loadEmps(); });
    const dirBtn = el("button", { class: "btn alt", id: "sortDir", type: "button", "aria-label": t("sortDir"), title: t("sortDir") }, query.dir === "asc" ? "↑" : "↓");
    dirBtn.addEventListener("click", () => { query.dir = query.dir === "asc" ? "desc" : "asc"; dirBtn.textContent = query.dir === "asc" ? "↑" : "↓"; query.offset = 0; loadEmps(); });
    box.replaceChildren(el("div", { class: "bar" }, search, sel, sortSel, dirBtn, canEdit() ? el("button", { class: "btn", id: "addBtn", onclick: () => openForm(null) }, "+ " + t("add")) : null), el("div", { id: "empList" }));
  } else { $("#q").placeholder = t("search"); }
  loadEmps();
}
async function loadEmps() {
  const list = $("#empList");
  const seq = (loadEmps.seq = (loadEmps.seq || 0) + 1); // only the newest request may render (avoids a stale empty list after a quick create)
  try {
    const sortKey = query.sort === "name" ? (lang === "ar" ? "name_ar" : "name_en") : query.sort === "title" ? (lang === "ar" ? "title_ar" : "title_en") : query.sort === "dept" ? (lang === "ar" ? "dept_ar" : "dept_en") : query.sort;
    const qs = new URLSearchParams({ status: query.status, limit: PAGE, offset: query.offset, sort: sortKey, dir: query.dir }); if (query.q) qs.set("q", query.q);
    const r = await api("GET", "/api/admin/employees?" + qs);
    if (seq !== loadEmps.seq) return;
    if (!r.employees.length) { list.replaceChildren(el("div", { class: "card empty" }, t("none"))); return; }
    const status = (e) => el("span", { class: "badge " + (e.active ? "on" : "off") }, e.active ? t("statusActive") : t("statusInactive"));
    const name = (e) => lang === "ar" ? e.name_ar : e.name_en;
    const sub = (e) => lang === "ar" ? e.title_ar : e.title_en;
    const dpt = (e) => (lang === "ar" ? e.dept_ar : e.dept_en) || e.department || "";
    const actions = (e) => el("div", { class: "acts" },
      el("button", { class: "btn alt sm", "data-act": "preview", onclick: () => openPreview(e) }, t("preview")),
      canEdit() ? el("button", { class: "btn alt sm", "data-act": "edit", onclick: () => openForm(e) }, t("edit")) : null,
      canEdit() ? el("button", { class: "btn sm " + (e.active ? "danger" : "alt"), "data-act": e.active ? "deactivate" : "reactivate", onclick: () => toggleActive(e) }, e.active ? t("deactivate") : t("reactivate")) : null);
    const table = el("table", {}, el("thead", {}, el("tr", {}, ...["id", "employee", "dept", "contact", "status", "actions"].map((k) => el("th", {}, k === "employee" ? t("employee") : t(k))))),
      el("tbody", {}, r.employees.map((e) => el("tr", { "data-id": e.id },
        el("td", { class: "mono" }, e.id),
        el("td", {}, el("div", { class: "emp" }, avatar(e), el("div", {}, el("b", {}, name(e)), el("div", { class: "muted" }, sub(e))))),
        el("td", {}, dpt(e)), el("td", { class: "mono" }, e.phone), el("td", {}, status(e)), el("td", {}, actions(e))))));
    const cards = el("div", { class: "cards-m" }, r.employees.map((e) => el("div", { class: "mc", "data-id": e.id },
      el("div", { class: "emp" }, avatar(e), el("div", { style: "flex:1" }, el("b", {}, name(e)), el("div", { class: "muted" }, sub(e))), status(e)),
      el("div", { class: "meta" }, el("span", { class: "mono" }, e.id), " · ", dpt(e), " · ", el("span", { class: "mono" }, e.phone)), actions(e))));
    const pages = el("div", { class: "bar", style: "margin:12px 0 0;justify-content:space-between;align-items:center" },
      el("span", { class: "muted" }, `${t("count")}: ${r.total}`),
      el("div", { class: "acts" },
        el("button", { class: "btn alt sm", disabled: query.offset === 0, onclick: () => { query.offset = Math.max(0, query.offset - PAGE); loadEmps(); } }, t("prev")),
        el("button", { class: "btn alt sm", disabled: query.offset + PAGE >= r.total, onclick: () => { query.offset += PAGE; loadEmps(); } }, t("next"))));
    list.replaceChildren(el("div", { class: "tablewrap" }, table, cards), pages);
  } catch (e) { if (!e.auth) list.replaceChildren(el("div", { class: "err" }, e.message)); }
}
async function toggleActive(e) {
  if (!confirm(e.active ? t("confirmDeact") : t("confirmReact"))) return;
  try { await api("POST", `/api/admin/employees/${e.id}/${e.active ? "deactivate" : "reactivate"}`); toast(e.active ? t("deactDone") : t("reactDone")); loadEmps(); }
  catch (er) { if (!er.auth) toast(er.message); }
}

// ---------- modal helpers ----------
function openModal(content) {
  closeModal();
  const m = el("div", { class: "modal", role: "dialog", "aria-modal": "true", onclick: (ev) => { if (ev.target === m) closeModal(); } }, el("div", { class: "sheet" }, content));
  $("#modalHost").append(m);
  const first = $("input,button", m); if (first) first.focus();
  m._esc = (ev) => { if (ev.key === "Escape") closeModal(); }; document.addEventListener("keydown", m._esc);
}
function closeModal() { const m = $(".modal"); if (m) { document.removeEventListener("keydown", m._esc); m.remove(); } }

// ---------- form ----------
const TEXT_FIELDS = [
  ["name_ar", "nameAr", { dir: "rtl" }], ["name_en", "nameEn", { dir: "ltr" }], ["title_ar", "titleAr", { dir: "rtl" }], ["title_en", "titleEn", { dir: "ltr" }],
  ["dept_ar", "deptAr", { dir: "rtl" }], ["dept_en", "deptEn", { dir: "ltr" }], ["department", "dept", { dir: "ltr" }],
  ["phone", "phone", { dir: "ltr", type: "tel", placeholder: "+966..." }], ["whatsapp", "whatsapp", { dir: "ltr", type: "tel", placeholder: "966..." }], ["email", "mail", { dir: "ltr", type: "email" }],
  ["location_ar", "locAr", { dir: "rtl" }], ["location_en", "locEn", { dir: "ltr" }]
];
function openForm(emp) {
  const isNew = !emp; const data = emp || {};
  let pendingPhoto = null, removePhoto = false;
  let createdId = null;
  const err = el("div", { class: "err hidden", id: "formErr" });
  const inputs = {};
  const fields = [];
  const idIn = el("input", { id: "f_id", value: data.id || "", dir: "ltr", placeholder: t("idHint"), disabled: !isNew, maxlength: 10, autocapitalize: "characters" });
  inputs.id = idIn; fields.push(el("div", { class: "f" }, el("label", { for: "f_id" }, t("id")), idIn, el("div", { class: "fe", id: "e_id" })));
  for (const [k, lk, a] of TEXT_FIELDS) {
    const inp = el("input", { id: "f_" + k, value: data[k] || "", maxlength: 254, ...a }); inputs[k] = inp;
    fields.push(el("div", { class: "f" }, el("label", { for: "f_" + k }, t(lk)), inp, el("div", { class: "fe", id: "e_" + k })));
  }
  const extraTxt = el("textarea", { id: "f_extra", rows: 3, dir: "ltr", style: "width:100%;border:1px solid #d9ccb8;border-radius:12px;padding:10px 12px;font:inherit" }, Object.entries(data.extra || {}).map(([k, v]) => `${k}=${v}`).join("\n"));
  const prev = avatar(data, true); prev.id = "photoPrev";
  const fileIn = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", id: "f_photo", class: "hidden" });
  fileIn.addEventListener("change", async () => {
    const f = fileIn.files[0]; if (!f) return;
    try { pendingPhoto = await shrink(f); removePhoto = false; const u = URL.createObjectURL(pendingPhoto); prev.replaceChildren(el("img", { src: u, alt: "" })); }
    catch (e) { toast(e.message); }
  });
  const photoRow = el("div", { class: "photo-row" }, prev, el("div", { class: "acts" }, fileIn,
    el("button", { type: "button", class: "btn alt sm", onclick: () => fileIn.click() }, t("choosePhoto")),
    (data.photo_url) ? el("button", { type: "button", class: "btn danger sm", onclick: () => { removePhoto = true; pendingPhoto = null; prev.replaceChildren((data.name_en || "?")[0]); } }, t("removePhoto")) : null));
  const form = el("form", { novalidate: true },
    el("h3", {}, isNew ? t("newEmp") : t("editEmp")), err, photoRow, el("div", { class: "fgrid" }, fields),
    el("div", { class: "f" }, el("label", { for: "f_extra" }, `${t("extra")} (${t("extraHint")})`), extraTxt),
    el("div", { class: "foot" }, el("button", { type: "button", class: "btn alt", onclick: closeModal }, t("cancel")), el("button", { class: "btn", type: "submit", id: "saveBtn" }, t("save"))));
  const saveBtn = $("#saveBtn", form);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault(); $$(".fe", form).forEach((n) => n.textContent = ""); err.classList.add("hidden");
    const body = {}; for (const [k] of TEXT_FIELDS) body[k] = inputs[k].value;
    const extra = {}; for (const line of extraTxt.value.split("\n")) { const i = line.indexOf("="); if (i > 0) extra[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
    body.extra = extra;
    if (isNew) body.id = idIn.value;
    saveBtn.disabled = true;
    try {
      // If the employee was already created by an earlier attempt of this form (e.g. the photo upload failed), update it instead of creating a duplicate.
      const r = (isNew && !createdId) ? await api("POST", "/api/admin/employees", body) : await api("PUT", "/api/admin/employees/" + (createdId || data.id), (() => { const u = { ...body }; delete u.id; return u; })());
      const id = r.employee.id; createdId = id; if (isNew) idIn.disabled = true;
      if (pendingPhoto) await api("PUT", `/api/admin/employees/${id}/photo`, undefined, { raw: pendingPhoto, contentType: pendingPhoto.type });
      else if (removePhoto && data.photo_url) await api("DELETE", `/api/admin/employees/${id}/photo`);
      closeModal(); toast(t("saved")); if (currentTab === "emps") loadEmps(); else showTab(currentTab);
    } catch (e) {
      if (e.auth) return;
      if (e.details) { for (const [k, m] of Object.entries(e.details)) { const n = $("#e_" + k, form); if (n) n.textContent = m; } }
      err.textContent = e.message; err.classList.remove("hidden");
    }
    saveBtn.disabled = false;
  });
  openModal(form);
}
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(t("photoBad"));
  if (file.size > 15 * 1024 * 1024) throw new Error(t("photoBig"));
  const bmp = await createImageBitmap(file).catch(() => { throw new Error(t("photoBad")); });
  const S = 512, side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas"); c.width = c.height = S;
  c.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, S, S);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  if (!blob || blob.size > 300 * 1024) throw new Error(t("photoBig"));
  return blob;
}

// ---------- preview + QR ----------
function qrSvg(url) {
  const qr = qrcode(0, "M"); qr.addData(url); qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
}
function qrPng(url) {
  const qr = qrcode(0, "M"); qr.addData(url); qr.make();
  const n = qr.getModuleCount(), cell = 12, m = 4, size = (n + m * 2) * cell;
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, size, size); x.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if (qr.isDark(r, q)) x.fillRect((q + m) * cell, (r + m) * cell, cell, cell);
  return c.toDataURL("image/png");
}
function download(href, name) { const a = el("a", { href, download: name }); document.body.append(a); a.click(); a.remove(); }
function openPreview(emp) {
  const url = cardUrl(emp.id);
  const qrHost = el("div", { class: "qrbox", id: "qrHost" }); qrHost.innerHTML = qrSvg(url); // generated locally from our own URL string
  const urlIn = el("input", { value: url, readonly: true, dir: "ltr", id: "cardUrl", "aria-label": t("cardUrl") });
  const frame = el("iframe", { src: url + (lang === "en" ? "&lang=en" : ""), title: t("preview"), loading: "lazy" });
  openModal(el("div", {}, el("h3", {}, `${emp.id} · ${lang === "ar" ? emp.name_ar : emp.name_en}`),
    el("div", { class: "preview" }, frame, el("div", {},
      el("label", {}, t("cardUrl")),
      el("div", { class: "urlrow" }, urlIn, el("button", { class: "btn alt", id: "copyBtn", onclick: async () => { try { await navigator.clipboard.writeText(url); } catch { urlIn.select(); document.execCommand("copy"); } toast(t("copied")); } }, t("copy"))),
      el("label", {}, t("qr")), qrHost,
      el("div", { class: "acts", style: "margin-top:10px" },
        el("button", { class: "btn alt sm", id: "dlPng", onclick: () => download(qrPng(url), `SIMTA-${emp.id}-qr.png`) }, t("downloadPng")),
        el("button", { class: "btn alt sm", id: "dlSvg", onclick: () => download("data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrSvg(url)), `SIMTA-${emp.id}-qr.svg`) }, t("downloadSvg")),
        el("a", { class: "btn alt sm", href: url, target: "_blank", rel: "noopener" }, t("openCard"))),
      el("p", { class: "muted", style: "font-size:13px" }, t("cardPreviewNote")))),
    el("div", { class: "foot" }, el("button", { class: "btn alt", onclick: closeModal }, t("close")))));
}

// ---------- audit ----------
async function renderAudit() {
  const box = $("#audit"); box.replaceChildren(el("p", { class: "muted" }, t("loading")));
  try {
    const r = await api("GET", "/api/admin/audit?limit=100");
    box.replaceChildren(el("h2", {}, t("tabAudit")), el("div", { class: "tablewrap" }, el("table", { class: "audit" },
      el("thead", {}, el("tr", {}, ...["time", "user", "action", "entity", "details"].map((k) => el("th", {}, t(k))))),
      el("tbody", {}, r.entries.map((e) => el("tr", {}, el("td", { class: "mono" }, e.ts.replace("T", " ").slice(0, 19)), el("td", { class: "mono" }, e.user_email || "—"), el("td", {}, e.action), el("td", { class: "mono" }, `${e.entity} ${e.entity_id || ""}`), el("td", { class: "mono", style: "max-width:320px;overflow-wrap:anywhere" }, (e.changes || "").slice(0, 160))))))));
  } catch (e) { if (!e.auth) box.replaceChildren(el("div", { class: "err" }, e.message)); }
}

// ---------- start ----------
applyLang();
if (token) enter().catch((e) => { if (!e.auth) signedOut(e.message); }); else signedOut("");
