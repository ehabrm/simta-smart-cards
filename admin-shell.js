"use strict";
// EANOVA Cards admin shell: sidebar navigation, platform dashboard, company management (list, company page, new-company wizard),
// users, security, settings. Loaded after admin.js, which keeps cards, QR, audit and sign-in code.

Object.assign(I.ar, {
 nHome: "الرئيسية", nCompanies: "الشركات والفروع", nCards: "البطاقات والموظفون", nAnalytics: "QR والتحليلات", nUsers: "المستخدمون والصلاحيات", nSecurity: "الأمان وسجل النشاط", nSettings: "إعدادات المنصة",
 hPlatform: "نظرة عامة على المنصة", hCompany: "نظرة عامة على الشركة", stCompanies: "الشركات", stBranches: "الفروع", stCards: "البطاقات", stActive: "نشطة", stInactive: "غير نشطة", stQrToday: "مسح QR اليوم", stQrTotal: "إجمالي مسح QR", stQr7: "مسح QR آخر 7 أيام", stUsers: "المستخدمون",
 alertsT: "التنبيهات المهمة", noAlerts: "لا توجد تنبيهات. كل شيء يعمل بشكل طبيعي.", al_maintenance: "الشركة {c} متوقفة حاليًا للصيانة", al_no_cards: "الشركة {c} ليس لديها بطاقات بعد", al_no_branches: "الشركة {c} لم تُضبط لها فروع بعد", al_users_without_2fa: "{n} مستخدم بدون تحقق بخطوتين",
 shortT: "اختصارات", scAddCo: "إضافة شركة", scAddCard: "إضافة بطاقة", scQr: "تحليلات QR", scUsers: "المستخدمون", recentAct: "آخر النشاطات", noAct: "لا توجد نشاطات بعد", coTable: "الشركات", open: "فتح", manage: "إدارة",
 coSearch: "بحث باسم الشركة أو الرمز", coAll: "كل الحالات", coActiveF: "نشطة", coInactiveF: "موقوفة", coMaint: "تحت الصيانة", coEmpty: "لا توجد شركات مطابقة", coNew: "شركة جديدة", back: "رجوع", next: "التالي", saveChanges: "حفظ التغييرات", unsaved: "تغييرات غير محفوظة",
 ctOverview: "نظرة عامة", ctIdentity: "الهوية", ctBranches: "الفروع", ctCards: "البطاقات", ctUsers: "المستخدمون", ctSettings: "الإعدادات", coStatusActive: "نشطة", coStatusOff: "موقوفة", coPaused: "الموقع متوقف", coBranchesN: "فروع", coCardsN: "بطاقات", coUsersN: "مستخدمون",
 idTitle: "الهوية البصرية", idPrimary: "اللون الأساسي", idAccent: "اللون الثانوي", idTagAr: "الوصف المختصر بالعربية", idTagEn: "الوصف المختصر بالإنجليزية", idSite: "الموقع الإلكتروني (https)", idLogo: "الشعار", idLogoPick: "اختيار شعار", idLogoRm: "إزالة الشعار", idLogoNote: "PNG أو JPG أو WebP أو SVG، يُصغَّر تلقائيًا", idPreview: "معاينة البطاقة", idPreviewNote: "معاينة تقريبية. الألوان والوصف والموقع والشعار تظهر فعلًا في صفحة بطاقة هذه الشركة (الصفحة المشتركة company-card). بطاقات سيمتا وفالكوم الحالية تحتفظ بتصميمها ولا تتغير.", idSaved: "تم حفظ الهوية", idLogoBad: "الملف ليس صورة صالحة", idSample: "اسم الموظف", idSampleT: "المسمى الوظيفي", idCall: "اتصال", idWa: "واتساب",
 brSub: "تظهر هذه الفروع في بطاقات الشركة. الحذف ينقل الفرع إلى المحذوفات ويمكن استعادته.", brDelRow: "حذف", brArch: "فروع محذوفة (يمكن استعادتها)", brRestore: "استعادة", brRestored: "تمت استعادة الفرع", brMax: "الحد الأقصى 30 فرعًا", brCount: "عدد الفروع", brNotConf: "لم تُضبط فروع لهذه الشركة بعد", brNeedAr: "اسم الفرع بالعربية مطلوب", brConfEmpty: "تم حفظ قائمة فارغة عن قصد: لن يظهر أي فرع", brArchNone: "لا توجد فروع محذوفة",
 cdTitle: "بطاقات الشركة", cdText: "إدارة بطاقات وموظفي هذه الشركة من قسم البطاقات. يتم الانتقال إلى الشركة المحددة.", cdManage: "فتح بطاقات الشركة", cdAdd: "إضافة بطاقة", cdLink: "عنوان البطاقة (قبل ?id=)", cdNone: "غير محدد بعد",
 stgTitle: "إعدادات الشركة", stgActive: "الشركة نشطة", stgActiveOff: "إيقاف الشركة يخفي بطاقاتها وإدارتها عن مستخدميها. البيانات تبقى محفوظة.", stgConfDeact: "إيقاف هذه الشركة؟ لن يتمكن مستخدموها من الدخول وستتوقف بطاقاتها. لا تُحذف أي بيانات.", stgSaved: "تم حفظ الإعدادات", stgTech: "الإعدادات التقنية", stgSlug: "المعرّف (لا يتغير)", stgPrefix: "بادئة الرقم الوظيفي (لا تتغير)", stgMtTitle: "إيقاف بطاقات الشركة مؤقتًا", stgMtPause: "إيقاف", stgMtResume: "إعادة تشغيل",
 wzTitle: "إضافة شركة جديدة", wz1: "البيانات الأساسية", wz2: "الشعار والهوية", wz3: "الفروع", wz4: "إعدادات البطاقات", wz5: "المسؤولون", wz6: "المعاينة", wz7: "الحفظ", wzSlug: "المعرّف بالإنجليزية (a-z و 0-9 و -)", wzPrefix: "بادئة الرقم الوظيفي (3 أحرف كبيرة)", wzBase: "عنوان صفحة البطاقة (https، يمكن تركه الآن)", wzOrigins: "النطاقات المسموحة (اختياري، تُستخرج من العنوان)", wzAdminOpt: "مسؤول الشركة (اختياري)", wzAdminNote: "ينشأ حساب بدور مدير لهذه الشركة فقط. كلمة المرور 12 حرفًا على الأقل.", wzSummary: "ملخص قبل الحفظ", wzCreate: "إنشاء الشركة", wzCreating: "جارٍ الإنشاء…", wzDone: "تم إنشاء الشركة", wzOpenCo: "فتح صفحة الشركة", wzPartial: "تم إنشاء الشركة لكن بعض الخطوات لم تكتمل. أكملها من صفحة الشركة.", wzStepCo: "إنشاء الشركة", wzStepId: "حفظ الهوية", wzStepBr: "حفظ الفروع", wzStepUser: "إنشاء المسؤول", wzNoBr: "بدون فروع", wzNone: "لا يوجد", wzReq: "هذا الحقل مطلوب", wzBadSlug: "2 إلى 30 حرفًا: a-z و 0-9 و - وتبدأ بحرف", wzBadPrefix: "3 أحرف كبيرة A-Z", wzBadUrl: "يجب أن يبدأ بـ https://", wzBadMail: "بريد غير صالح", wzBadPass: "12 حرفًا على الأقل", wzIsolation: "ستكون الشركة معزولة تمامًا: بياناتها وبطاقاتها ومستخدموها وإحصاءاتها منفصلة عن بقية الشركات.",
 usersAll: "كل مستخدمي المنصة", usersMember: "عضو في", usersNone: "بدون شركة",
 secTitle: "الأمان وسجل النشاط", sec2fa: "التحقق بخطوتين", sec2faOn: "مفعّل لحسابك", sec2faOff: "غير مفعّل", sec2faBtn: "إدارة التحقق بخطوتين", secScopeCo: "هذه الشركة", secScopeAll: "كل المنصة", secCompany: "الشركة",
 setTitle: "إعدادات المنصة", setLang: "لغة الواجهة", setAccount: "الحساب", setMt: "إيقاف الموقع مؤقتًا لهذه الشركة", setCo: "إعدادات الشركة الحالية", setGoCo: "فتح صفحة الشركة", setRole: "دورك", setVer: "الواجهة", setNoAdmin: "هذه الإعدادات لمديري الشركة فقط",
 vsTitle: "زيارات البطاقات", ctx: "الشركة الحالية", menu: "القائمة", yes: "نعم"
});
Object.assign(I.en, {
 nHome: "Dashboard", nCompanies: "Companies & branches", nCards: "Cards & employees", nAnalytics: "QR & analytics", nUsers: "Users & permissions", nSecurity: "Security & activity log", nSettings: "Platform settings",
 hPlatform: "Platform overview", hCompany: "Company overview", stCompanies: "Companies", stBranches: "Branches", stCards: "Cards", stActive: "Active", stInactive: "Inactive", stQrToday: "QR scans today", stQrTotal: "Total QR scans", stQr7: "QR scans, last 7 days", stUsers: "Users",
 alertsT: "Important alerts", noAlerts: "No alerts. Everything looks normal.", al_maintenance: "{c} is paused for maintenance", al_no_cards: "{c} has no cards yet", al_no_branches: "{c} has no branches set up yet", al_users_without_2fa: "{n} user(s) without two-factor sign-in",
 shortT: "Shortcuts", scAddCo: "Add company", scAddCard: "Add card", scQr: "QR analytics", scUsers: "Users", recentAct: "Recent activity", noAct: "No activity yet", coTable: "Companies", open: "Open", manage: "Manage",
 coSearch: "Search by company name or code", coAll: "All statuses", coActiveF: "Active", coInactiveF: "Inactive", coMaint: "In maintenance", coEmpty: "No matching companies", coNew: "New company", back: "Back", next: "Next", saveChanges: "Save changes", unsaved: "Unsaved changes",
 ctOverview: "Overview", ctIdentity: "Identity", ctBranches: "Branches", ctCards: "Cards", ctUsers: "Users", ctSettings: "Settings", coStatusActive: "Active", coStatusOff: "Inactive", coPaused: "Paused", coBranchesN: "branches", coCardsN: "cards", coUsersN: "users",
 idTitle: "Visual identity", idPrimary: "Primary colour", idAccent: "Accent colour", idTagAr: "Short tagline (Arabic)", idTagEn: "Short tagline (English)", idSite: "Website (https)", idLogo: "Logo", idLogoPick: "Choose logo", idLogoRm: "Remove logo", idLogoNote: "PNG, JPG, WebP or SVG, resized automatically", idPreview: "Card preview", idPreviewNote: "Approximate preview. Colours, tagline, website and logo are applied to this company's card page (the shared company-card page). The existing SIMTA and FALCOM cards keep their fixed design and do not change.", idSaved: "Identity saved", idLogoBad: "Not a valid image", idSample: "Employee name", idSampleT: "Job title", idCall: "Call", idWa: "WhatsApp",
 brSub: "These branches appear on the company's cards. Deleting moves a branch to the archive, where it can be restored.", brDelRow: "Delete", brArch: "Deleted branches (restorable)", brRestore: "Restore", brRestored: "Branch restored", brMax: "Maximum 30 branches", brCount: "Branches", brNotConf: "No branches have been set up for this company yet", brNeedAr: "Arabic branch name is required", brConfEmpty: "An empty list was saved on purpose: no branch will be shown", brArchNone: "No deleted branches",
 cdTitle: "Company cards", cdText: "Manage this company's cards and employees from the Cards section. It switches to the selected company.", cdManage: "Open company cards", cdAdd: "Add card", cdLink: "Card address (before ?id=)", cdNone: "Not set yet",
 stgTitle: "Company settings", stgActive: "Company is active", stgActiveOff: "Deactivating hides the company's cards and admin from its users. Data is kept.", stgConfDeact: "Deactivate this company? Its users cannot sign in and its cards stop. No data is deleted.", stgSaved: "Settings saved", stgTech: "Technical settings", stgSlug: "Identifier (cannot change)", stgPrefix: "Employee ID prefix (cannot change)", stgMtTitle: "Pause company cards", stgMtPause: "Pause", stgMtResume: "Resume",
 wzTitle: "Add a new company", wz1: "Basics", wz2: "Logo & identity", wz3: "Branches", wz4: "Card settings", wz5: "Administrators", wz6: "Preview", wz7: "Save", wzSlug: "English identifier (a-z, 0-9, -)", wzPrefix: "Employee ID prefix (3 capital letters)", wzBase: "Card page address (https, can be left empty for now)", wzOrigins: "Allowed origins (optional, taken from the address)", wzAdminOpt: "Company administrator (optional)", wzAdminNote: "Creates an account with the admin role for this company only. Password at least 12 characters.", wzSummary: "Summary before saving", wzCreate: "Create company", wzCreating: "Creating…", wzDone: "Company created", wzOpenCo: "Open company page", wzPartial: "The company was created but some steps did not finish. Complete them from the company page.", wzStepCo: "Create company", wzStepId: "Save identity", wzStepBr: "Save branches", wzStepUser: "Create administrator", wzNoBr: "No branches", wzNone: "None", wzReq: "This field is required", wzBadSlug: "2 to 30 characters: a-z, 0-9, - and starts with a letter", wzBadPrefix: "3 capital letters A-Z", wzBadUrl: "Must start with https://", wzBadMail: "Invalid e-mail", wzBadPass: "At least 12 characters", wzIsolation: "The company will be fully isolated: its data, cards, users and statistics are separate from every other company.",
 usersAll: "All platform users", usersMember: "Member of", usersNone: "No company",
 secTitle: "Security & activity log", sec2fa: "Two-factor sign-in", sec2faOn: "On for your account", sec2faOff: "Off", sec2faBtn: "Manage two-factor", secScopeCo: "This company", secScopeAll: "Whole platform", secCompany: "Company",
 setTitle: "Platform settings", setLang: "Interface language", setAccount: "Account", setMt: "Pause the site for this company", setCo: "Current company settings", setGoCo: "Open company page", setRole: "Your role", setVer: "Interface", setNoAdmin: "These settings are for company admins only",
 vsTitle: "Card visits", ctx: "Current company", menu: "Menu", yes: "Yes"
});

const ICONS = {
 home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
 building: '<path d="M4 21V5l8-3v19"/><path d="M12 9l8 3v9"/><path d="M8 8h1M8 12h1M8 16h1M16 15h1M16 18h1"/>',
 id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.6 5.4-1.6 6 0M14 10h4M14 14h3"/>',
 qr: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/>',
 users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-4 3.4-5.5 6.5-5.5s5.700 1.500 6.500 5.500"/><path d="M16 5a3.500 3.500 0 010 7M18 14.800c1.800.8 3 2.500 3.500 5.200"/>',
 shield: '<path d="M12 3l8 3v6c0 4.500-3.300 8-8 9-4.700-1-8-4.500-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
 gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.200l2-1.500-2-3.400-2.400 1a7 7 0 00-2-1.200L14 3h-4l-.5 2.700a7 7 0 00-2 1.200l-2.400-1-2 3.400 2 1.500A7 7 0 005 12c0 .400 0 .800.100 1.200l-2 1.500 2 3.400 2.400-1a7 7 0 002 1.200L10 21h4l.5-2.700a7 7 0 002-1.200l2.400 1 2-3.400-2-1.500c.1-.400.100-.800.100-1.200z"/>'
};
const NAV = [
 { id: "dash", ic: "home", k: "nHome" }, { id: "companies", ic: "building", k: "nCompanies", sup: true }, { id: "emps", ic: "id", k: "nCards" }, { id: "qr", ic: "qr", k: "nAnalytics" },
 { id: "users", ic: "users", k: "nUsers", adm: true }, { id: "audit", ic: "shield", k: "nSecurity", adm: true }, { id: "settings", ic: "gear", k: "nSettings", adm: true }
];
const svg = (name) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.innerHTML = ICONS[name]; return s; };
const isSuper = () => !!(me && me.platform_admin);
const isAdm = () => !!(me && me.role === "admin");
const nm2 = (x) => (lang === "ar" ? (x.name_ar || x.name_en) : (x.name_en || x.name_ar)) || "";
const sf = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o[k]);
const errBox = (box, e) => { if (!e.auth) box.replaceChildren(el("div", { class: "err" }, e.message)); };
const fieldErr = (e) => e && e.details ? Object.values(e.details).join(" · ") : "";
const failMsg = (e) => (e.message || "") + (fieldErr(e) ? ": " + fieldErr(e) : "");
const stat = (n, l, s) => el("div", { class: "card stat" }, el("b", {}, String(n)), el("span", {}, l), s ? el("small", {}, s) : null);
const initials = (c) => ((c.name_en || c.slug || "?").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
function logoBox(c, big) {
  const b = el("div", { class: "logo-b" + (big ? " lg" : ""), style: `background:linear-gradient(135deg,${c.primary || "#2f6bff"},${c.accent || "#19b8ff"})` });
  if (c.logo) b.append(el("img", { src: c.logo, alt: "" })); else b.append(initials(c));
  return b;
}
const goCompanyScope = (slug, tab) => { setCompany(slug, true); showTab(tab); };

// ---------- shell ----------
function buildNav() {
  const nav = $("#nav"); if (!nav || !me) return;
  nav.replaceChildren(...NAV.filter((n) => (!n.sup || isSuper()) && (!n.adm || isAdm())).map((n) => {
    const b = el("button", { class: "tab", role: "tab", "data-tab": n.id, type: "button", "aria-selected": String(n.id === currentTab) }, svg(n.ic), el("span", {}, t(n.k)));
    b.addEventListener("click", () => { if (n.id === "companies") coState.view = "list"; showTab(n.id); }); return b;
  }));
  $("#sideFoot").textContent = "EANOVA Cards · © 2026";
}
function closeDrawer() { $("#side").classList.remove("open"); $("#scrim").classList.remove("on"); $("#menuBtn").setAttribute("aria-expanded", "false"); }
function toggleDrawer() { const o = $("#side").classList.toggle("open"); $("#scrim").classList.toggle("on", o); $("#menuBtn").setAttribute("aria-expanded", String(o)); }

async function enter() {
  const r = await api("GET", "/api/auth/me"); me = r.user;
  if (!me.companies.length) { signedOut(t("noCompany")); return; }
  const want = sessionStorage.getItem(CUR_KEY);
  setCompany((me.companies.find((c) => c.slug === want) || me.companies.find((c) => c.slug === "simta") || me.companies[0]).slug, true);
  $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden");
  $("#coSwitch").onchange = (e) => setCompany(e.target.value);
  $("#menuBtn").onclick = toggleDrawer; $("#scrim").onclick = closeDrawer;
  currentTab = "dash"; applyLang();
}
function setCompany(slug, silent) {
  cur = me.companies.find((c) => c.slug === slug); sessionStorage.setItem(CUR_KEY, slug);
  me.role = me.platform_admin ? "admin" : cur.role;
  const sw = $("#coSwitch"); sw.replaceChildren(...me.companies.map((c) => el("option", { value: c.slug, selected: c.slug === slug }, cname(c))));
  sw.classList.toggle("hidden", me.companies.length < 2); sw.title = t("ctx");
  document.title = t("title") + " · " + cname(cur);
  buildNav();
  if (!silent) showTab(currentTab, true);
}
const SECTIONS = ["home", "dash", "companies", "emps", "qr", "users", "audit", "settings"];
function showTab(name, keep) {
  if (name === "platform") name = "companies";
  if (name === "companies" && !isSuper()) name = "dash";
  if ((name === "users" || name === "audit" || name === "settings") && !isAdm()) name = "dash";
  currentTab = name; closeDrawer();
  $$("#nav .tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  const show = name === "dash" && isSuper() ? "home" : name;
  SECTIONS.forEach((s) => $("#" + s).classList.toggle("hidden", s !== show));
  if (!keep) window.scrollTo(0, 0);
  if (name === "dash") (isSuper() ? renderHome() : renderCompanyHome());
  else if (name === "companies") renderCompanies(); else if (name === "emps") renderEmps(); else if (name === "qr") renderAnalytics();
  else if (name === "users") renderUsers(); else if (name === "audit") renderSecurity(); else if (name === "settings") renderSettings();
}
const _applyLang = applyLang;
applyLang = function () { _applyLang(); buildNav(); const mb = $("#menuBtn"); if (mb) mb.setAttribute("aria-label", t("menu")); };

// ---------- dashboards ----------
const shortcut = (label, fn) => el("button", { class: "btn alt", type: "button", onclick: fn }, label);
async function renderHome() {
  const box = $("#home"); box.replaceChildren(el("p", { class: "muted" }, t("loading")));
  try {
    const o = await api("GET", "/api/admin/platform/overview"); const T = o.totals;
    const alertRow = (a) => {
      const co = a.company ? o.companies.find((c) => c.slug === a.company) : null;
      const txt = sf(t("al_" + a.type), { c: co ? nm2(co) : "", n: a.count || 0 });
      const act = a.type === "users_without_2fa" ? () => { showTab("users"); } : () => { coState = { ...coState, view: "detail", id: co.id, tab: a.type === "maintenance" ? "settings" : a.type === "no_cards" ? "cards" : "branches" }; showTab("companies"); };
      return el("div", { class: "alertrow" }, el("i", { class: "dot" }), el("span", { class: "t" }, txt), el("button", { class: "btn sm alt", type: "button", onclick: act }, t("open")));
    };
    box.replaceChildren(
      el("div", { class: "page-h" }, el("h2", {}, t("hPlatform"))),
      el("div", { class: "grid stats3", id: "platStats" }, stat(T.active_companies, t("stCompanies"), T.companies !== T.active_companies ? `${T.companies - T.active_companies} ${t("coInactiveF")}` : ""), stat(T.branches, t("stBranches")), stat(T.cards, t("stCards"), `${T.active_cards} ${t("stActive")} · ${T.inactive_cards} ${t("stInactive")}`), stat(T.qr_today, t("stQrToday")), stat(T.qr_last7, t("stQr7")), stat(T.qr_total, t("stQrTotal"))),
      el("div", { class: "card", style: "margin-top:14px" }, el("h2", {}, t("shortT")), el("div", { class: "shortcuts" }, shortcut("+ " + t("scAddCo"), () => { coState = { ...coState, view: "new" }; wz = null; showTab("companies"); }), shortcut("+ " + t("scAddCard"), () => showTab("emps")), shortcut(t("scQr"), () => showTab("qr")), shortcut(t("scUsers"), () => showTab("users")))),
      el("div", { class: "grid two", style: "margin-top:14px" },
        el("div", { class: "card", id: "alertsBox" }, el("h2", {}, t("alertsT")), o.alerts.length ? o.alerts.map(alertRow) : el("p", { class: "muted" }, t("noAlerts"))),
        el("div", { class: "card" }, el("h2", {}, t("recentAct")), o.recent.length ? o.recent.map((e) => el("div", { class: "alertrow" }, el("span", { class: "mono muted" }, e.ts.replace("T", " ").slice(5, 16)), el("span", { class: "t" }, e.action + (e.company ? " · " + e.company : "")), el("span", { class: "muted mono" }, e.user_email || ""))) : el("p", { class: "muted" }, t("noAct")))),
      el("div", { class: "card", style: "margin-top:14px" }, el("h2", {}, t("coTable")), el("div", { class: "cogrid" }, o.companies.map((c) => companyCard(c)))));
  } catch (e) { errBox(box, e); }
}
async function renderCompanyHome() {
  const box = $("#dash"); await renderDash();
  if (!$("#dash > .page-h")) box.prepend(el("div", { class: "page-h" }, el("h2", {}, t("hCompany") + " · " + cname(cur))), el("div", { class: "card", style: "margin-bottom:14px" }, el("div", { class: "shortcuts" }, canEdit() ? shortcut("+ " + t("scAddCard"), () => showTab("emps")) : null, shortcut(t("scQr"), () => showTab("qr")), isAdm() ? shortcut(t("scUsers"), () => showTab("users")) : null)));
}
async function renderAnalytics() {
  await renderQr();
  const box = $("#qr");
  try {
    const s = await api("GET", "/api/admin/stats"); if (!s.visits) return;
    const v = s.visits.views;
    box.append(el("div", { class: "card", style: "margin-top:14px", id: "visitsBox" }, el("h2", {}, t("vsTitle") + " · " + cname(cur)), el("div", { class: "grid stats" }, stat(v.today, t("vToday")), stat(v.last7, t("v7")), stat(v.last30, t("v30")), stat(v.total, t("vTotal"))), el("div", { class: "muted", style: "margin-top:8px;font-size:12px" }, t("vNote"))));
  } catch (e) { if (e.auth) return; }
}

// ---------- companies ----------
let coState = { view: "list", id: null, tab: "overview", q: "", status: "all" };
let coCache = null; let wz = null;
function companyCard(c) {
  const chips = el("div", { class: "chips" }, el("span", { class: "badge " + (c.active ? "on" : "off") }, c.active ? t("coStatusActive") : t("coStatusOff")), c.maintenance ? el("span", { class: "badge warn" }, t("coPaused")) : null);
  const b = el("button", { class: "card co", type: "button", "data-slug": c.slug, onclick: () => { coState = { ...coState, view: "detail", id: c.id, tab: "overview" }; showTab("companies"); } },
    el("div", { class: "top" }, logoBox(c), el("div", { style: "flex:1;min-width:0" }, el("strong", {}, nm2(c)), el("div", { class: "sub mono" }, `${c.slug} · ${c.prefix}`))), chips,
    el("div", { class: "mini" }, el("span", {}, el("b", {}, c.branches), " " + t("coBranchesN")), el("span", {}, el("b", {}, c.employees), " " + t("coCardsN")), el("span", {}, el("b", {}, c.users), " " + t("coUsersN"))));
  return b;
}
async function loadCompanies() { coCache = await api("GET", "/api/admin/platform/overview"); return coCache; }
async function renderCompanies() {
  const box = $("#companies");
  if (coState.view === "new") return renderWizard();
  box.replaceChildren(el("p", { class: "muted" }, t("loading")));
  try {
    const o = await loadCompanies();
    if (coState.view === "detail") { const c = o.companies.find((x) => x.id === coState.id); if (c) return renderCompanyPage(c); coState.view = "list"; }
    const q = el("input", { type: "search", id: "coQ", placeholder: t("coSearch"), "aria-label": t("coSearch"), value: coState.q });
    const st = el("select", { id: "coSt", "aria-label": t("status") }, [["all", "coAll"], ["active", "coActiveF"], ["inactive", "coInactiveF"], ["maint", "coMaint"]].map(([v, k]) => el("option", { value: v, selected: coState.status === v }, t(k))));
    const grid = el("div", { class: "cogrid", id: "coGrid" });
    const draw = () => {
      const s = q.value.trim().toLowerCase(), f = st.value; coState.q = q.value; coState.status = f;
      const rows = o.companies.filter((c) => (!s || [c.name_ar, c.name_en, c.slug, c.prefix].join(" ").toLowerCase().includes(s)) && (f === "all" || (f === "active" && c.active) || (f === "inactive" && !c.active) || (f === "maint" && c.maintenance)));
      grid.replaceChildren(...(rows.length ? rows.map(companyCard) : [el("div", { class: "empty" }, t("coEmpty"))]));
    };
    q.addEventListener("input", draw); st.addEventListener("change", draw);
    box.replaceChildren(el("div", { class: "page-h" }, el("h2", {}, t("nCompanies")), el("button", { class: "btn", id: "newCoBtn", type: "button", onclick: () => { wz = null; coState.view = "new"; renderCompanies(); } }, "+ " + t("coNew"))), el("div", { class: "bar" }, q, st), grid);
    draw();
  } catch (e) { errBox(box, e); }
}
function backBtn(fn) { return el("button", { class: "btn alt sm", type: "button", onclick: fn }, (lang === "ar" ? "→ " : "← ") + t("back")); }
async function renderCompanyPage(c) {
  const box = $("#companies");
  const tabs = [["overview", "ctOverview"], ["identity", "ctIdentity"], ["branches", "ctBranches"], ["cards", "ctCards"], ["users", "ctUsers"], ["settings", "ctSettings"]];
  const body = el("div", { id: "coBody" });
  const bar = el("div", { class: "subtabs", role: "tablist" }, tabs.map(([id, k]) => el("button", { class: "subtab", role: "tab", type: "button", "data-ct": id, "aria-selected": String(coState.tab === id), onclick: () => { coState.tab = id; renderCompanyPage(c); } }, t(k))));
  box.replaceChildren(
    el("div", { class: "page-h" }, backBtn(() => { coState.view = "list"; renderCompanies(); }), logoBox(c, true), el("div", { style: "flex:1;min-width:180px" }, el("h2", { style: "min-width:0" }, nm2(c)), el("div", { class: "sub mono" }, `${c.slug} · ${c.prefix}`)), el("span", { class: "badge " + (c.active ? "on" : "off") }, c.active ? t("coStatusActive") : t("coStatusOff")), c.maintenance ? el("span", { class: "badge warn" }, t("coPaused")) : null),
    bar, body);
  const fn = { overview: coOverview, identity: coIdentity, branches: coBranches, cards: coCards, users: coUsers, settings: coSettings }[coState.tab];
  try { await fn(c, body); } catch (e) { errBox(body, e); }
}
const cbase = (c) => c.card_base_url || "";
async function coOverview(c, body) {
  body.replaceChildren(
    el("div", { class: "grid stats3" }, stat(c.employees, t("stCards"), `${c.active_employees} ${t("stActive")} · ${c.inactive_employees} ${t("stInactive")}`), stat(c.branches, t("stBranches")), stat(c.users, t("stUsers")), stat(c.qr_today, t("stQrToday")), stat(c.qr_scans, t("stQrTotal"))),
    el("div", { class: "card", style: "margin-top:14px;display:grid;gap:8px" }, el("strong", {}, t("cdLink")), el("div", { class: "mono", style: "word-break:break-all" }, cbase(c) || t("cdNone")), el("div", { class: "muted" }, t("wzIsolation"))),
    el("div", { class: "card", style: "margin-top:14px" }, el("div", { class: "shortcuts" }, shortcut(t("ctIdentity"), () => { coState.tab = "identity"; renderCompanyPage(c); }), shortcut(t("ctBranches"), () => { coState.tab = "branches"; renderCompanyPage(c); }), shortcut(t("cdManage"), () => goCompanyScope(c.slug, "emps")), shortcut(t("ctUsers"), () => { coState.tab = "users"; renderCompanyPage(c); }))));
}
function cardPreview(p, c) {
  const nameTxt = lang === "ar" ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar), tag = lang === "ar" ? p.tagline_ar : p.tagline_en;
  const lg = el("div", { class: "lg" }); if (p.logo) lg.append(el("img", { src: p.logo, alt: "" })); else lg.append(initials(c));
  return el("div", { class: "pv", dir: lang === "ar" ? "rtl" : "ltr", id: "cardPv" },
    el("div", { class: "hd", style: `background:linear-gradient(135deg,${p.primary},${p.accent})` }, lg, el("b", {}, nameTxt || "—"), tag ? el("div", { style: "font-size:12px;opacity:.9;margin-top:2px" }, tag) : null),
    el("div", { class: "bd" }, el("div", { class: "em" }, el("b", {}, t("idSample")), el("span", {}, t("idSampleT")), el("a", { class: "bt", style: `background:${p.primary}` }, t("idCall")), el("a", { class: "bt", style: `background:${p.accent}` }, t("idWa"))),
      (c._branches && c._branches.length) ? el("div", { class: "brs" }, c._branches.map((b) => lang === "ar" ? (b.name_ar || b.name_en) : (b.name_en || b.name_ar)).join(" · ")) : null));
}
function shrinkLogo(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(u);
      let side = 256, q = 0.9;
      for (let i = 0; i < 8; i++) {
        const sc = Math.min(1, side / Math.max(im.width || side, im.height || side)), w = Math.max(1, Math.round((im.width || side) * sc)), h = Math.max(1, Math.round((im.height || side) * sc));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(im, 0, 0, w, h);
        let d = cv.toDataURL("image/webp", q); if (!d.startsWith("data:image/webp")) d = cv.toDataURL("image/png");
        if (d.length <= 60000) return res(d);
        side = Math.round(side * 0.8); q = Math.max(0.5, q - 0.1);
      }
      rej(new Error(t("photoBig")));
    };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error(t("idLogoBad"))); };
    im.src = u;
  });
}
// Shared identity form: used by the company page and by the new-company wizard. get/set go through `st` (an object holding the draft).
function identityForm(st, onChange) {
  const ch = () => { onChange && onChange(); };
  const inp = (k, o = {}) => { const i = el("input", { value: st[k] || "", ...o }); i.addEventListener("input", () => { st[k] = i.value; ch(); }); return i; };
  const color = (k) => { const c = el("input", { type: "color", value: st[k] }), tx = el("input", { value: st[k], dir: "ltr", maxlength: 7, "aria-label": k }); c.addEventListener("input", () => { st[k] = c.value; tx.value = c.value; ch(); }); tx.addEventListener("input", () => { if (/^#[0-9a-fA-F]{6}$/.test(tx.value)) { st[k] = tx.value.toLowerCase(); c.value = st[k]; ch(); } }); return el("div", { class: "colorrow" }, c, tx); };
  const file = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/svg+xml", class: "hidden", id: "logoFile" });
  const thumb = el("div", { class: "logo-b lg", style: "background:#0d2150" }); const drawThumb = () => { thumb.replaceChildren(); if (st.logo) thumb.append(el("img", { src: st.logo, alt: "" })); else thumb.append("—"); };
  drawThumb();
  file.addEventListener("change", async () => { const f = file.files[0]; if (!f) return; try { st.logo = await shrinkLogo(f); drawThumb(); ch(); } catch (e) { toast(e.message); } file.value = ""; });
  return el("div", { class: "fgrid2" },
    field(t("idPrimary"), color("primary")), field(t("idAccent"), color("accent")),
    field(t("idTagAr"), inp("tagline_ar", { dir: "rtl", maxlength: 120 })), field(t("idTagEn"), inp("tagline_en", { dir: "ltr", maxlength: 120 })),
    field(t("idSite"), inp("website", { dir: "ltr", placeholder: "https://" })),
    field(t("idLogo"), el("div", { style: "display:flex;gap:12px;align-items:center;flex-wrap:wrap" }, thumb, el("div", { style: "display:grid;gap:6px" }, file, el("button", { class: "btn alt sm", type: "button", onclick: () => file.click() }, t("idLogoPick")), el("button", { class: "btn alt sm", type: "button", onclick: () => { st.logo = ""; drawThumb(); ch(); } }, t("idLogoRm")), el("span", { class: "sub" }, t("idLogoNote"))))));
}
async function coIdentity(c, body) {
  const pr = (await api("GET", `/api/admin/companies/${c.id}/profile`)).profile; const br = await api("GET", `/api/admin/companies/${c.id}/branches`);
  const st = { ...pr, name_ar: c.name_ar, name_en: c.name_en }; const prev = el("div", {});
  const draw = () => { prev.replaceChildren(el("h3", { style: "margin:0 0 10px;color:#fff" }, t("idPreview")), cardPreview(st, { name_ar: st.name_ar, name_en: st.name_en, _branches: br.branches, slug: c.slug }), el("p", { class: "sub", style: "text-align:center" }, t("idPreviewNote"))); };
  const nameAr = el("input", { value: st.name_ar, dir: "rtl", maxlength: 120 }), nameEn = el("input", { value: st.name_en, dir: "ltr", maxlength: 120 });
  nameAr.addEventListener("input", () => { st.name_ar = nameAr.value; draw(); }); nameEn.addEventListener("input", () => { st.name_en = nameEn.value; draw(); });
  const save = el("button", { class: "btn", type: "button", id: "idSave", onclick: async () => {
    save.disabled = true;
    try {
      await api("PUT", `/api/admin/companies/${c.id}`, { name_ar: st.name_ar, name_en: st.name_en });
      await api("PUT", `/api/admin/companies/${c.id}/profile`, { primary: st.primary, accent: st.accent, tagline_ar: st.tagline_ar, tagline_en: st.tagline_en, website: st.website, logo: st.logo });
      toast(t("idSaved")); await refreshMe(); renderCompanies();
    } catch (e) { if (!e.auth) toast(failMsg(e)); }
    save.disabled = false;
  } }, t("saveChanges"));
  body.replaceChildren(el("div", { class: "grid two" }, el("div", { class: "card" }, el("h2", {}, t("idTitle")), el("div", { class: "fgrid2" }, field(t("coNameAr"), nameAr), field(t("coNameEn"), nameEn)), identityForm(st, draw), save), el("div", { class: "card" }, prev)));
  draw();
}
async function refreshMe() { const m = await api("GET", "/api/auth/me"); me.companies = m.user.companies; if (!me.companies.find((x) => x.slug === cur.slug)) setCompany(me.companies[0].slug, true); else setCompany(cur.slug, true); }
function branchEditor(host, cid, data, onDone) {
  let list = data.branches.map((b) => ({ ...b })), dirty = false;
  const rows = el("div", { id: "brRows" }), note = el("div", { class: "sub" }), archBox = el("div", { id: "brArchive" });
  const mark = (d) => { dirty = d; saveBtn.disabled = !dirty; dirtyTag.textContent = dirty ? t("unsaved") : ""; };
  const dirtyTag = el("span", { class: "badge warn", style: "min-width:0" });
  const draw = () => {
    rows.replaceChildren(...list.map((b, i) => {
      const ar = el("input", { value: b.name_ar, dir: "rtl", placeholder: t("brNameAr"), maxlength: 120, "aria-label": t("brNameAr") }), en = el("input", { value: b.name_en, dir: "ltr", placeholder: t("brNameEn"), maxlength: 120, "aria-label": t("brNameEn") });
      ar.addEventListener("input", () => { b.name_ar = ar.value; mark(true); }); en.addEventListener("input", () => { b.name_en = en.value; mark(true); });
      return el("div", { class: "brrow", "data-i": String(i) }, ar, en, el("button", { class: "btn danger sm", type: "button", title: t("brDelRow"), "aria-label": t("brDelRow"), onclick: () => { list.splice(i, 1); mark(true); draw(); } }, "✕"));
    }));
    note.textContent = list.length ? `${t("brCount")}: ${list.length} / 30` : (data.configured || dirty ? t("brConfEmpty") : t("brNotConf"));
    addBtn.disabled = list.length >= 30;
  };
  const drawArch = () => {
    archBox.replaceChildren(el("h3", { style: "margin:16px 0 4px;color:#fff" }, t("brArch")), data.archived && data.archived.length ? el("ul", { class: "arch" }, data.archived.map((a, i) => el("li", {}, el("span", { style: "flex:1" }, nm2(a)), el("span", { class: "sub mono" }, (a.deleted_at || "").slice(0, 10)), el("button", { class: "btn alt sm", type: "button", "data-restore": String(i), disabled: dirty, onclick: async () => { try { const r = await api("POST", `/api/admin/companies/${cid}/branches/restore`, { index: i }); data = r; list = r.branches.map((b) => ({ ...b })); mark(false); draw(); drawArch(); toast(t("brRestored")); onDone && onDone(r); } catch (e) { if (!e.auth) toast(failMsg(e)); } } }, t("brRestore"))))) : el("p", { class: "sub" }, t("brArchNone")));
  };
  const addBtn = el("button", { class: "btn alt", type: "button", id: "brAdd", onclick: () => { list.push({ name_ar: "", name_en: "" }); mark(true); draw(); const l = $$("#brRows .brrow input"); if (l.length) l[l.length - 2].focus(); } }, "+ " + t("brAdd"));
  const saveBtn = el("button", { class: "btn", type: "button", id: "brSave", disabled: true, onclick: async () => {
    if (list.some((b) => !b.name_ar.trim())) { toast(t("brNeedAr")); return; }
    saveBtn.disabled = true;
    try { const r = await api("PUT", `/api/admin/companies/${cid}/branches`, { branches: list }); data = r; list = r.branches.map((b) => ({ ...b })); mark(false); draw(); drawArch(); toast(t("brDone")); onDone && onDone(r); } catch (e) { if (!e.auth) toast(failMsg(e)); mark(true); }
  } }, t("brSave"));
  host.replaceChildren(el("p", { class: "muted" }, t("brSub")), rows, note, el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px" }, addBtn, saveBtn, dirtyTag), archBox);
  draw(); drawArch();
}
async function coBranches(c, body) {
  const data = await api("GET", `/api/admin/companies/${c.id}/branches`); const host = el("div", {});
  branchEditor(host, c.id, data, null);
  body.replaceChildren(el("div", { class: "card" }, el("h2", {}, t("brTitle") + " · " + nm2(c)), host));
}
async function coCards(c, body) {
  body.replaceChildren(el("div", { class: "card", style: "display:grid;gap:12px" }, el("h2", {}, t("cdTitle")), el("p", { class: "muted" }, t("cdText")),
    el("div", { class: "grid stats3" }, stat(c.employees, t("stCards")), stat(c.active_employees, t("stActive")), stat(c.inactive_employees, t("stInactive"))),
    el("div", { class: "mono", style: "word-break:break-all" }, cbase(c) || t("cdNone")),
    el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, el("button", { class: "btn", id: "openCards", type: "button", onclick: () => goCompanyScope(c.slug, "emps") }, t("cdManage")))));
}
async function usersPanel(slug, title) {
  const r = await api("GET", `/api/c/${slug}/admin/users`);
  const rows = r.users.map((u) => {
    const sel = roleSel(u.role), act = el("input", { type: "checkbox", checked: !!u.active, style: "width:auto;min-height:0" }), pw = el("input", { type: "password", placeholder: t("uNewPass"), autocomplete: "new-password" });
    const save = el("button", { class: "btn sm", type: "button", onclick: async () => { try { const b = { role: sel.value, active: act.checked }; if (pw.value) b.password = pw.value; await api("PUT", `/api/c/${slug}/admin/users/${u.id}`, b); toast(t("uDone")); pw.value = ""; } catch (e) { if (!e.auth) toast(failMsg(e)); } } }, t("uSave"));
    return el("div", { class: "card", style: "display:grid;gap:8px" }, el("strong", { dir: "ltr" }, u.email), el("span", { class: "muted" }, u.name || ""), field(t("uRole"), sel), el("label", {}, act, " ", t("uActive")), field(t("uReset"), pw), save);
  });
  const em = el("input", { type: "email", dir: "ltr", autocomplete: "off", id: "nuEmail" }), nm = el("input", { type: "text", id: "nuName" }), pw = el("input", { type: "password", autocomplete: "new-password", id: "nuPass" }), rs = roleSel("viewer");
  const add = el("button", { class: "btn", type: "button", id: "nuAdd", onclick: async () => { try { await api("POST", `/api/c/${slug}/admin/users`, { email: em.value.trim(), name: nm.value.trim(), password: pw.value, role: rs.value }); toast(t("uDone")); host.replaceWith(await usersPanel(slug, title)); } catch (e) { if (!e.auth) toast(failMsg(e)); } } }, t("uAdd"));
  const host = el("div", { style: "display:grid;gap:12px" }, title ? el("h2", { style: "margin:0" }, title) : null, el("div", { class: "card", style: "display:grid;gap:8px" }, field(t("uEmail"), em), field(t("uName"), nm), field(t("uPass"), pw), field(t("uRole"), rs), add), ...rows);
  return host;
}
async function coUsers(c, body) { body.replaceChildren(await usersPanel(c.slug, t("tabUsers") + " · " + nm2(c))); }
async function maintenanceCard(slug, canSet, title) {
  const r = await api("GET", `/api/c/${slug}/admin/maintenance`); let mt = r.maintenance;
  const btn = el("button", { class: "btn", type: "button", id: "mtBtn", disabled: !canSet }, mt ? t("mtEnable") : t("mtDisable"));
  const badge = el("span", { class: "badge " + (mt ? "off" : "on") }, mt ? t("mtBadge") : t("mtBadgeOk")), desc = el("p", { class: "muted" }, mt ? t("mtOnDesc") : t("mtOffDesc"));
  btn.addEventListener("click", async () => {
    if (!confirm(mt ? t("mtConfEn") : t("mtConfDis"))) return; btn.disabled = true;
    try { await api("PUT", `/api/c/${slug}/admin/maintenance`, { enabled: !mt }); mt = !mt; btn.textContent = mt ? t("mtEnable") : t("mtDisable"); badge.className = "badge " + (mt ? "off" : "on"); badge.textContent = mt ? t("mtBadge") : t("mtBadgeOk"); desc.textContent = mt ? t("mtOnDesc") : t("mtOffDesc"); toast(mt ? t("mtDoneOn") : t("mtDoneOff")); } catch (e) { if (!e.auth) toast(failMsg(e)); }
    btn.disabled = false;
  });
  return el("div", { class: "card", style: "display:grid;gap:10px" }, el("h2", { style: "margin:0" }, title, " ", badge), desc, canSet ? btn : null);
}
async function coSettings(c, body) {
  const f = { card_base_url: el("input", { value: c.card_base_url || "", dir: "ltr", placeholder: "https://…/card.html" }), allowed_origins: el("input", { value: c.allowed_origins || "", dir: "ltr" }) };
  const act = el("input", { type: "checkbox", checked: !!c.active, style: "width:auto;min-height:0", id: "coActive" });
  const save = el("button", { class: "btn", type: "button", id: "stSave", onclick: async () => {
    if (c.active && !act.checked && !confirm(t("stgConfDeact"))) return; save.disabled = true;
    try { await api("PUT", `/api/admin/companies/${c.id}`, { card_base_url: f.card_base_url.value.trim(), allowed_origins: f.allowed_origins.value, active: act.checked }); toast(t("stgSaved")); await refreshMe(); renderCompanies(); } catch (e) { if (!e.auth) toast(failMsg(e)); }
    save.disabled = false;
  } }, t("saveChanges"));
  body.replaceChildren(el("div", { class: "grid two" },
    el("div", { class: "card", style: "display:grid;gap:8px" }, el("h2", { style: "margin:0" }, t("stgTitle")), el("label", {}, act, " ", t("stgActive")), el("p", { class: "sub" }, t("stgActiveOff")), el("h3", { style: "margin:8px 0 0;color:#fff" }, t("stgTech")), field(t("coBase"), f.card_base_url), field(t("coOrigins"), f.allowed_origins), field(t("stgSlug"), el("input", { value: c.slug, disabled: true, dir: "ltr" })), field(t("stgPrefix"), el("input", { value: c.prefix, disabled: true, dir: "ltr" })), save),
    await maintenanceCard(c.slug, true, t("stgMtTitle"))));
}

// ---------- new company wizard ----------
const WZ_STEPS = ["wz1", "wz2", "wz3", "wz4", "wz5", "wz6", "wz7"];
const SLUG_OK = /^[a-z][a-z0-9-]{1,29}$/, EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function renderWizard() {
  const box = $("#companies");
  if (!wz) wz = { step: 0, d: { slug: "", prefix: "", name_ar: "", name_en: "", primary: "#2f6bff", accent: "#19b8ff", tagline_ar: "", tagline_en: "", website: "", logo: "", branches: [], card_base_url: "", allowed_origins: "", a_email: "", a_name: "", a_pass: "" }, err: {}, touchedSlug: false, touchedPrefix: false, result: null, busy: false };
  const d = wz.d, e = wz.err;
  const bar = el("div", { class: "steps", id: "wzSteps" }, WZ_STEPS.map((k, i) => el("div", { class: "step" + (i === wz.step ? " on" : i < wz.step ? " done" : ""), "aria-current": i === wz.step ? "step" : null }, `${i + 1}. ${t(k)}`)));
  const inp = (k, o = {}) => { const i = el("input", { value: d[k], ...o }); i.addEventListener("input", () => { d[k] = i.value; if (k === "slug") wz.touchedSlug = true; if (k === "prefix") { wz.touchedPrefix = true; } }); return i; };
  const fe = (k, label, input) => el("div", { class: "f" }, el("label", {}, label), input, e[k] ? el("div", { class: "fe" }, e[k]) : null);
  let content;
  if (wz.step === 0) {
    const en = inp("name_en", { dir: "ltr", maxlength: 120, id: "wzNameEn" }), slug = inp("slug", { dir: "ltr", maxlength: 30, id: "wzSlug" }), prefix = inp("prefix", { dir: "ltr", maxlength: 3, id: "wzPrefix" });
    en.addEventListener("input", () => { if (!wz.touchedSlug) { d.slug = en.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^[^a-z]+|-+$/g, "").slice(0, 30); slug.value = d.slug; } if (!wz.touchedPrefix) { d.prefix = (d.slug.replace(/[^a-z]/g, "").slice(0, 3)).toUpperCase(); prefix.value = d.prefix; } });
    prefix.addEventListener("input", () => { prefix.value = d.prefix = prefix.value.toUpperCase().replace(/[^A-Z]/g, ""); });
    content = el("div", { class: "fgrid2" }, fe("name_ar", t("coNameAr"), inp("name_ar", { dir: "rtl", maxlength: 120, id: "wzNameAr" })), fe("name_en", t("coNameEn"), en), fe("slug", t("wzSlug"), slug), fe("prefix", t("wzPrefix"), prefix));
  } else if (wz.step === 1) {
    const prev = el("div", {}); const draw = () => { prev.replaceChildren(el("h3", { style: "margin:0 0 10px;color:#fff" }, t("idPreview")), cardPreview(d, { ...d, _branches: d.branches })); }; draw();
    content = el("div", { class: "grid two" }, el("div", {}, identityForm(d, draw)), prev);
  } else if (wz.step === 2) {
    const host = el("div", {}); const draw = () => {
      host.replaceChildren(...d.branches.map((b, i) => { const ar = el("input", { value: b.name_ar, dir: "rtl", placeholder: t("brNameAr"), maxlength: 120 }), en2 = el("input", { value: b.name_en, dir: "ltr", placeholder: t("brNameEn"), maxlength: 120 }); ar.addEventListener("input", () => b.name_ar = ar.value); en2.addEventListener("input", () => b.name_en = en2.value); return el("div", { class: "brrow" }, ar, en2, el("button", { class: "btn danger sm", type: "button", onclick: () => { d.branches.splice(i, 1); draw(); }, "aria-label": t("brDelRow") }, "✕")); }),
        el("div", { style: "margin-top:8px" }, el("button", { class: "btn alt", type: "button", id: "wzAddBr", disabled: d.branches.length >= 30, onclick: () => { d.branches.push({ name_ar: "", name_en: "" }); draw(); } }, "+ " + t("brAdd")), " ", el("span", { class: "sub" }, t("brMax"))));
    }; draw(); content = el("div", {}, e.branches ? el("div", { class: "err" }, e.branches) : null, host);
  } else if (wz.step === 3) {
    content = el("div", { class: "fgrid2" }, fe("card_base_url", t("wzBase"), inp("card_base_url", { dir: "ltr", placeholder: "https://…/card.html", id: "wzBase" })), fe("allowed_origins", t("wzOrigins"), inp("allowed_origins", { dir: "ltr" })));
  } else if (wz.step === 4) {
    const pw = inp("a_pass", { type: "password", autocomplete: "new-password", id: "wzAPass" });
    content = el("div", {}, el("h3", { style: "margin:0 0 6px;color:#fff" }, t("wzAdminOpt")), el("p", { class: "sub" }, t("wzAdminNote")), el("div", { class: "fgrid2" }, fe("a_email", t("uEmail"), inp("a_email", { type: "email", dir: "ltr", autocomplete: "off", id: "wzAEmail" })), fe("a_name", t("uName"), inp("a_name", { id: "wzAName" })), fe("a_pass", t("uPass"), pw)));
  } else {
    const rowS = (l, v) => el("div", { class: "alertrow" }, el("span", { class: "muted", style: "min-width:140px" }, l), el("span", { class: "t mono", style: "direction:auto;word-break:break-all" }, v || t("wzNone")));
    const steps = wz.result;
    content = el("div", { class: "grid two" }, el("div", { class: "card" }, el("h3", { style: "margin:0 0 8px;color:#fff" }, t("wzSummary")),
      rowS(t("coNameAr"), d.name_ar), rowS(t("coNameEn"), d.name_en), rowS(t("stgSlug"), d.slug), rowS(t("stgPrefix"), d.prefix), rowS(t("wz3"), d.branches.length ? d.branches.map((b) => b.name_ar).join(" · ") : t("wzNoBr")), rowS(t("wzBase"), d.card_base_url), rowS(t("wz5"), d.a_email), el("p", { class: "sub" }, t("wzIsolation")),
      steps ? el("ul", { class: "progress", id: "wzProgress" }, steps.map((s) => el("li", {}, el("span", { class: s.ok === true ? "ok" : s.ok === false ? "bad" : "muted" }, s.ok === true ? "✓" : s.ok === false ? "✗" : "…"), el("span", {}, t(s.k) + (s.msg ? ": " + s.msg : ""))))) : null,
      steps && steps.every((s) => s.ok !== null) ? el("p", { class: steps.every((s) => s.ok !== false) ? "ok" : "bad", id: "wzFinal" }, steps.every((s) => s.ok !== false) ? t("wzDone") : t("wzPartial")) : null),
      el("div", { class: "card" }, cardPreview(d, { ...d, _branches: d.branches })));
  }
  const created = wz.created;
  const nextBtn = el("button", { class: "btn", type: "button", id: "wzNext", disabled: wz.busy, onclick: () => wzNext() }, wz.step === 5 ? (wz.busy ? t("wzCreating") : t("wzCreate")) : t("next"));
  const nav = el("div", { style: "display:flex;gap:8px;justify-content:space-between;margin-top:16px;flex-wrap:wrap" }, el("button", { class: "btn alt", type: "button", id: "wzBack", disabled: wz.busy || !!created, onclick: () => { if (wz.step === 0) { wz = null; coState.view = "list"; renderCompanies(); } else { wz.step--; wz.err = {}; renderWizard(); } } }, (lang === "ar" ? "→ " : "← ") + t("back")),
    created ? el("button", { class: "btn", type: "button", id: "wzOpen", onclick: () => { coState = { ...coState, view: "detail", id: created, tab: "overview" }; wz = null; renderCompanies(); } }, t("wzOpenCo")) : nextBtn);
  box.replaceChildren(el("div", { class: "page-h" }, el("h2", {}, t("wzTitle"))), bar, el("div", { class: "card" }, content), nav);
}
function wzValidate() {
  const d = wz.d, e = {}; const s = wz.step;
  if (s === 0) { if (!d.name_ar.trim()) e.name_ar = t("wzReq"); if (!d.name_en.trim()) e.name_en = t("wzReq"); if (!SLUG_OK.test(d.slug)) e.slug = t("wzBadSlug"); if (!/^[A-Z]{3}$/.test(d.prefix)) e.prefix = t("wzBadPrefix"); }
  if (s === 2) { if (d.branches.some((b) => !b.name_ar.trim())) e.branches = t("brNeedAr"); }
  if (s === 3) { if (d.card_base_url && !/^https:\/\//.test(d.card_base_url.trim())) e.card_base_url = t("wzBadUrl"); }
  if (s === 4 && (d.a_email || d.a_name || d.a_pass)) { if (!EMAIL_OK.test(d.a_email.trim())) e.a_email = t("wzBadMail"); if (d.a_pass.length < 12) e.a_pass = t("wzBadPass"); }
  wz.err = e; return !Object.keys(e).length;
}
async function wzNext() {
  if (wz.step < 5) { if (!wzValidate()) { renderWizard(); return; } wz.step++; renderWizard(); return; }
  const d = wz.d; wz.busy = true;
  const steps = [{ k: "wzStepCo", ok: null }, { k: "wzStepId", ok: null }, { k: "wzStepBr", ok: null }, { k: "wzStepUser", ok: null }]; wz.result = steps; renderWizard();
  let id = null;
  try {
    let origins = d.allowed_origins.trim(); if (!origins && /^https:\/\//.test(d.card_base_url.trim())) { try { origins = new URL(d.card_base_url.trim()).origin; } catch { /* ignore */ } }
    const r = await api("POST", "/api/admin/companies", { slug: d.slug, prefix: d.prefix, name_ar: d.name_ar.trim(), name_en: d.name_en.trim(), card_base_url: d.card_base_url.trim(), allowed_origins: origins });
    id = r.company.id; wz.created = id; steps[0].ok = true;
  } catch (e) { steps[0].ok = false; steps[0].msg = failMsg(e); steps.slice(1).forEach((s) => { s.ok = false; s.msg = "—"; }); wz.busy = false; renderWizard(); return; }
  renderWizard();
  try { await api("PUT", `/api/admin/companies/${id}/profile`, { primary: d.primary, accent: d.accent, tagline_ar: d.tagline_ar, tagline_en: d.tagline_en, website: d.website, logo: d.logo }); steps[1].ok = true; } catch (e) { steps[1].ok = false; steps[1].msg = failMsg(e); }
  renderWizard();
  if (d.branches.length) { try { await api("PUT", `/api/admin/companies/${id}/branches`, { branches: d.branches.map((b) => ({ name_ar: b.name_ar.trim(), name_en: b.name_en.trim() })) }); steps[2].ok = true; } catch (e) { steps[2].ok = false; steps[2].msg = failMsg(e); } } else { steps[2].ok = true; steps[2].msg = t("wzNoBr"); }
  renderWizard();
  if (d.a_email) { try { await api("POST", "/api/admin/platform/users", { email: d.a_email.trim(), name: d.a_name.trim(), password: d.a_pass, memberships: [{ company: d.slug, role: "admin" }] }); steps[3].ok = true; } catch (e) { steps[3].ok = false; steps[3].msg = failMsg(e); } } else { steps[3].ok = true; steps[3].msg = t("wzNone"); }
  wz.busy = false; d.a_pass = ""; try { await refreshMe(); } catch { /* ignore */ }
  renderWizard();
}

// ---------- users, security, settings ----------
async function renderUsers() {
  const box = $("#users"); box.replaceChildren(el("p", { class: "muted" }, t("loading")));
  try {
    const parts = [el("div", { class: "page-h" }, el("h2", {}, t("nUsers") + " · " + cname(cur))), await usersPanel(cur.slug, null)];
    if (isSuper()) {
      const ur = await api("GET", "/api/admin/platform/users");
      parts.push(el("h2", { style: "margin-top:24px" }, t("usersAll")), ...ur.users.map((u) => el("div", { class: "card", style: "margin-bottom:8px" }, el("strong", { dir: "ltr" }, u.email), u.is_super ? el("span", { class: "badge on", style: "margin-inline-start:8px" }, t("uSuper")) : null, u.active ? null : el("span", { class: "badge off", style: "margin-inline-start:8px" }, t("uOff")), u.two_factor ? el("span", { class: "badge mute", style: "margin-inline-start:8px" }, "2FA") : null,
        el("div", { class: "muted", dir: "ltr" }, (u.memberships || []).map((m) => `${m.company}:${m.role}${m.active ? "" : " (off)"}`).join("  ") || t("usersNone")))));
    }
    box.replaceChildren(...parts);
  } catch (e) { errBox(box, e); }
}
let secScope = "company";
async function renderSecurity() {
  const box = $("#audit"); box.replaceChildren(el("p", { class: "muted" }, t("loading")));
  try {
    const all = isSuper() && secScope === "all";
    const r = await api("GET", all ? "/api/admin/platform/audit?limit=100" : "/api/admin/audit?limit=100");
    const scope = isSuper() ? el("select", { id: "secScope", "aria-label": t("secCompany"), onchange: (ev) => { secScope = ev.target.value; renderSecurity(); } }, el("option", { value: "company", selected: !all }, t("secScopeCo") + " · " + cname(cur)), el("option", { value: "all", selected: all }, t("secScopeAll"))) : null;
    const tfa = el("div", { class: "card", style: "display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px" }, el("strong", {}, t("sec2fa")), el("span", { class: "badge " + (me.two_factor ? "on" : "off") }, me.two_factor ? t("sec2faOn") : t("sec2faOff")), el("span", { style: "flex:1" }), el("button", { class: "btn alt", id: "secTfa", type: "button", onclick: () => $("#twoFaBtn").click() }, t("sec2faBtn")));
    box.replaceChildren(el("div", { class: "page-h" }, el("h2", {}, t("secTitle")), scope), tfa, el("div", { class: "tablewrap" }, el("table", { class: "audit" },
      el("thead", {}, el("tr", {}, ...(all ? ["time", "secCompany", "user", "action", "entity", "details"] : ["time", "user", "action", "entity", "details"]).map((k) => el("th", {}, t(k))))),
      el("tbody", {}, r.entries.map((e) => el("tr", {}, el("td", { class: "mono" }, e.ts.replace("T", " ").slice(0, 19)), all ? el("td", { class: "mono" }, e.company || "—") : null, el("td", { class: "mono" }, e.user_email || "—"), el("td", {}, e.action), el("td", { class: "mono" }, `${e.entity} ${e.entity_id || ""}`), el("td", { class: "mono", style: "max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, (() => { const c = typeof e.changes === "string" ? e.changes : JSON.stringify(e.changes || ""); return c && c !== '""' && c !== "null" ? c : "—"; })())))))));
  } catch (e) { errBox(box, e); }
}
async function renderSettings() {
  const box = $("#settings"); box.replaceChildren(el("p", { class: "muted" }, t("loading")));
  try {
    const langSel = el("select", { id: "setLang", "aria-label": t("setLang"), onchange: (ev) => { lang = ev.target.value; localStorage.setItem(LANG_KEY, lang); applyLang(); } }, el("option", { value: "ar", selected: lang === "ar" }, "العربية"), el("option", { value: "en", selected: lang === "en" }, "English"));
    box.replaceChildren(el("div", { class: "page-h" }, el("h2", {}, t("setTitle"))),
      el("div", { class: "grid two" }, await maintenanceCard(cur.slug, isAdm(), t("setMt") + " · " + cname(cur)),
        el("div", { class: "card", style: "display:grid;gap:10px" }, el("h2", { style: "margin:0" }, t("setAccount")), el("div", { class: "mono" }, me.email), el("div", {}, t("setRole") + ": ", el("b", {}, roleLbl(me.role))), field(t("setLang"), langSel),
          isSuper() ? el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, el("button", { class: "btn alt", type: "button", id: "setGoCo", onclick: async () => { try { const o = await loadCompanies(); const c = o.companies.find((x) => x.slug === cur.slug); coState = { ...coState, view: "detail", id: c.id, tab: "settings" }; showTab("companies"); } catch (e) { if (!e.auth) toast(e.message); } } }, t("setGoCo"))) : null)));
  } catch (e) { errBox(box, e); }
}

// ---------- start ----------
applyLang();
const start = () => enter().catch((e) => { if (!e.auth) signedOut(e.message); });
if (token) start();
else if (readRem()) refreshSession().then((ok) => (ok ? start() : signedOut("")));
else signedOut("");
