// Runtime branding for the shared company card page (company-card.html?c=<slug>&id=<ID>).
// Everything comes from THIS company's own public profile endpoint: /api/c/<slug>/profile. Nothing is taken from another company.
(function () {
  var CFG = window.SIMTA_CONFIG || {}, API = (CFG.API_BASE || "").replace(/\/$/, "");
  var q = new URLSearchParams(location.search), slug = (q.get("c") || "").trim().toLowerCase();
  var HEX = /^#[0-9a-f]{6}$/i;
  function load(src) { var s = document.createElement("script"); s.src = src; document.body.appendChild(s); }
  function fail() {
    // Unknown or missing company: use the card page's own "not found" state; no data is shown.
    window.COMPANY = { nameAr: "", nameEn: "", titleName: "Card", idPrefix: "XXX", defaultId: "XXX-000", apiPath: "/api/c/none-0", vcardOrg: "", vcardFilePrefix: "", descAr: "", descEn: "", brand: { pageTitle: "Card", metaDesc: "", logo: "", logoAlt: "", emblem: "", icon: "", touchIcon: "", panelTitle: "", footer: "" }, quote: {} };
    load("company-card.js");
  }
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return fail();
  var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 8000);
  fetch(API + "/api/c/" + slug + "/profile", { cache: "no-store", signal: ctl.signal }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (p) {
    clearTimeout(tm);
    var prim = HEX.test(p.primary || "") ? p.primary : "#2f6bff", acc = HEX.test(p.accent || "") ? p.accent : "#19b8ff";
    var root = document.documentElement.style; root.setProperty("--p", prim); root.setProperty("--a", acc);
    var tm2 = document.querySelector("meta[name=theme-color]"); if (tm2) tm2.setAttribute("content", prim);
    var nameEn = p.name_en || p.name_ar || slug, nameAr = p.name_ar || p.name_en || slug;
    var mono = (nameEn.replace(/[^A-Za-z0-9\u0600-\u06FF]/g, "").slice(0, 2) || "?").toUpperCase().replace(/[<>&"']/g, "");
    var svg = function (w, h) { return "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '"><rect width="100%" height="100%" fill="' + prim + '"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="' + Math.round(h * 0.42) + '" fill="#fff">' + mono + "</text></svg>"); };
    var logo = p.logo && /^data:image\/(png|jpeg|webp);base64,/.test(p.logo) ? p.logo : "";
    var emblem = logo || svg(320, 320);
    var descAr = p.tagline_ar || nameAr, descEn = p.tagline_en || nameEn;
    window.COMPANY = {
      nameAr: nameAr, nameEn: nameEn, titleName: nameEn, idPrefix: String(p.prefix || "").toUpperCase(), defaultId: String(p.prefix || "").toUpperCase() + "-001",
      apiPath: "/api/c/" + slug, vcardOrg: nameEn, vcardFilePrefix: String(p.prefix || "").toUpperCase() + "-", descAr: descAr, descEn: descEn,
      urlJoin: "?c=" + slug + "&id=",
      brand: { pageTitle: nameEn + " | Employee card", metaDesc: nameEn + " digital business card", logo: logo || svg(720, 288), logoAlt: nameEn, emblem: emblem, icon: emblem, touchIcon: emblem, panelTitle: nameAr + " | " + nameEn, footer: nameEn.toUpperCase() },
      quote: {}
    };
    if (!/^[A-Z]{3}$/.test(window.COMPANY.idPrefix)) return fail();
    window.__companyWebsite = /^https:\/\//.test(p.website || "") ? p.website : "";
    load("company-card.js");
    // Per-company branches (this company's own public list; hidden when never configured or empty).
    fetch(API + "/api/c/" + slug + "/branches", { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (b) {
      var list = (b && b.configured && Array.isArray(b.branches)) ? b.branches.filter(function (x) { return x && (x.name_ar || x.name_en); }).slice(0, 30) : [];
      if (!list.length) return;
      var hosts = []; document.querySelectorAll(".company, .about").forEach(function (n) { hosts.push(n); });
      var boxes = [];
      hosts.forEach(function (n) {
        var side = n.classList.contains("side"), box = document.createElement("div"); box.className = "cobranches";
        box.style.cssText = side ? "margin-top:14px;font-size:13px;color:#fff" : "margin:10px 0 0;font-size:13px;color:inherit";
        var h = document.createElement("div"); h.className = "cob-h"; h.style.cssText = "font-weight:700;margin-bottom:6px;opacity:.9"; box.appendChild(h);
        var ul = document.createElement("div"); ul.style.cssText = "display:flex;flex-wrap:wrap;gap:6px"; box.appendChild(ul);
        list.forEach(function (x) { var c = document.createElement("span"); c.className = "cob-i"; c.style.cssText = "padding:4px 10px;border-radius:999px;border:1px solid " + (side ? "rgba(255,255,255,.45)" : "color-mix(in srgb,var(--p) 30%,#fff)") + ";background:" + (side ? "rgba(255,255,255,.12)" : "#fff"); c.dataset.ar = x.name_ar || x.name_en; c.dataset.en = x.name_en || x.name_ar; ul.appendChild(c); });
        if (side) n.appendChild(box); else if (n.parentNode) n.parentNode.insertBefore(box, n.nextSibling);
        boxes.push(box);
      });
      function paint() { var en = document.documentElement.lang === "en"; boxes.forEach(function (bx) { bx.querySelector(".cob-h").textContent = en ? "Branches" : "الفروع"; bx.querySelectorAll(".cob-i").forEach(function (c) { c.textContent = en ? c.dataset.en : c.dataset.ar; }); }); }
      paint(); new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    }).catch(function () {});
    var w = window.__companyWebsite;
    if (w) { var host = ""; try { host = new URL(w).hostname; } catch (e) {} document.querySelectorAll("#companyDesc, #sideDesc").forEach(function (n) { var a = document.createElement("a"); a.href = w; a.target = "_blank"; a.rel = "noopener"; a.textContent = host; a.style.cssText = "display:block;color:inherit;opacity:.85;margin-top:4px;font-size:13px"; n.parentNode.appendChild(a); }); }
  }).catch(function () { clearTimeout(tm); fail(); });
})();
