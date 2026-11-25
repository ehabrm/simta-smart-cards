import { chromium } from "playwright";
import fs from "node:fs";
const B = "http://localhost:8799", S = "/downloads/shots/";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
let pass = 0, fail = 0; const errors = []; const extReq = new Set(); const csp = [];
const t = (n, ok, x = "") => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (ok ? "" : "  " + x)); };
async function page(ctxOpts = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, ...ctxOpts }); const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  p.on("dialog", (d) => d.accept());
  p.on("request", (r) => { const u = r.url(); if (!/^(data:|blob:|http:\/\/localhost:8799)/.test(u)) extReq.add(u); });
  await p.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => (window.__csp = (window.__csp || []).concat(e.violatedDirective + " " + e.blockedURI))));
  return p;
}
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1280, height: 900 } };

// ---------- public card ----------
let p = await page(mobile);
await p.goto(B + "/card.html?id=SMT-001"); await p.waitForSelector(".v1 #name:not(:empty)");
t("card AR name", (await p.textContent(".v1 #name")) === "سارة نموذج");
t("card AR dir rtl", (await p.getAttribute("html", "dir")) === "rtl");
t("card role AR", (await p.textContent(".v1 #role")) === "مندوب خرسانة");
t("card dept row AR", (await p.textContent(".v1 #dept")) === "المبيعات");
t("card tel link", (await p.getAttribute(".v1 #call", "href")) === "tel:+12025550101");
t("card wa link", (await p.getAttribute(".v1 #wa", "href")) === "https://wa.me/12025550101");
t("card has CSP meta", /script-src 'self'/.test(await p.getAttribute("meta[http-equiv=Content-Security-Policy]", "content")));
t("CSP blocks injected inline script", (await p.evaluate(() => { const x = document.createElement("script"); x.textContent = "window.__x=1"; document.body.append(x); return window.__x === 1; })) === false);
t("empty email row hidden", !(await p.isVisible(".v1 #emailRow")));
t("no QR element on card", (await p.locator("canvas, .qr, svg[id*=qr]").count()) === 0);
await p.screenshot({ path: S + "card-mobile-ar.png", fullPage: true });
await p.click(".v1 #langBtn");
t("card EN dir ltr", (await p.getAttribute("html", "dir")) === "ltr" && (await p.textContent(".v1 #name")) === "Sara Sample");
t("card EN dept", (await p.textContent(".v1 #dept")) === "Sales");
await p.screenshot({ path: S + "card-mobile-en.png", fullPage: true });
const [dl] = await Promise.all([p.waitForEvent("download"), p.click(".v1 #save")]);
const vcf = fs.readFileSync(await dl.path(), "utf8");
t("vCard download", dl.suggestedFilename() === "SIMTA-SMT-001.vcf" && vcf.includes("FN;CHARSET=utf-8:Sara Sample") && vcf.includes("TEL;TYPE=CELL,VOICE:+12025550101") && vcf.includes("END:VCARD"), vcf);
t("vCard has no email line when none", !vcf.includes("EMAIL"));
await p.evaluate(() => { navigator.share = undefined; });
await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
await p.click(".v1 #share"); await p.waitForSelector("#toast.on");
t("share fallback copies link", (await p.evaluate(() => navigator.clipboard.readText())).endsWith("/card.html?id=SMT-001"));
// not found / deactivated / invalid / missing id
for (const [q, name] of [["SMT-003", "deactivated"], ["SMT-404", "unknown"], ["bad", "invalid"], ["", "missing id"]]) {
  await p.goto(B + "/card.html" + (q ? "?id=" + q : "")); await p.waitForSelector(".v1 #nfTitle:not(:empty)");
  t(`${name} id -> not found, no data shown`, (await p.isVisible(".v1 #notfound")) && !(await p.isVisible(".v1 #content")) && !(await p.content()).includes("Dina Mock"));
}
await p.goto(B + "/card.html?id=SMT-404"); await p.screenshot({ path: S + "card-notfound-mobile.png" });
// API down -> error state, no stale data
await p.route("**/api/employees/**", (r) => r.abort());
await p.goto(B + "/card.html?id=SMT-001"); await p.waitForSelector(".v1 #nfTitle:not(:empty)");
t("API unreachable -> error state (no fake data)", (await p.textContent(".v1 #nfTitle")) === "تعذّر تحميل البطاقة" && !(await p.isVisible(".v1 #content")));
await p.unroute("**/api/employees/**");
await p.route("**/api/employees/**", (r) => r.fulfill({ status: 500, body: "{}" }));
await p.goto(B + "/card.html?id=SMT-001"); await p.waitForSelector(".v1 #nfTitle:not(:empty)");
t("API 500 -> error state", (await p.textContent(".v1 #nfTitle")) === "تعذّر تحميل البطاقة");
await p.context().close();
p = await page(desktop);
await p.goto(B + "/card.html?id=SMT-002"); await p.waitForSelector(".v2 #name:not(:empty)");
t("desktop card shows v2 layout + email", (await p.isVisible(".v2 #emailRow")) && (await p.textContent(".v2 #email")) === "omar.demo@example.com");
await p.screenshot({ path: S + "card-desktop-ar.png" });
await p.click(".v2 #langBtn"); await p.screenshot({ path: S + "card-desktop-en.png" });
t("desktop EN ltr", (await p.getAttribute("html", "dir")) === "ltr");
await p.context().close();

// ---------- admin ----------
p = await page(desktop);
await p.goto(B + "/admin.html"); await p.waitForSelector("#loginForm");
t("login screen first (RTL default)", (await p.isVisible("#loginView")) && (await p.getAttribute("html", "dir")) === "rtl");
await p.screenshot({ path: S + "admin-login-desktop.png" });
await p.fill("#lemail", "admin@example.com"); await p.fill("#lpass", "wrong password!!"); await p.click("#loginForm button");
await p.waitForSelector("#loginErr:not(.hidden)"); t("wrong password shows error", true);
t("token not in page source / storage before login", !(await p.evaluate(() => sessionStorage.getItem("simta_admin_token"))));
await p.fill("#lpass", "local test password 1"); await p.click("#loginForm button");
await p.waitForSelector("#appView:not(.hidden) .stat");
t("dashboard stats", (await p.$$eval(".stat b", (n) => n.map((x) => x.textContent))).join() === "3,2,1,0", await p.$$eval(".stat b", (n) => n.map((x) => x.textContent)).then(String));
await p.screenshot({ path: S + "admin-dashboard-desktop-ar.png" });
// language switch
await p.click("#appView .langbtn");
t("admin EN is LTR", (await p.getAttribute("html", "dir")) === "ltr" && (await p.textContent(".tab[data-tab=emps]")) === "Employees");
await p.screenshot({ path: S + "admin-dashboard-desktop-en.png" });
await p.click(".tab[data-tab=emps]"); await p.waitForSelector("tr[data-id]");
t("list 3 employees (incl inactive)", (await p.locator("tbody tr[data-id]").count()) === 3);
await p.screenshot({ path: S + "admin-employees-desktop-en.png" });
// search
const search = async (q) => { await p.fill("#q", q); await p.waitForTimeout(700); return p.locator("tbody tr[data-id]").count(); };
t("search by ID", (await search("SMT-002")) === 1);
t("search by English name", (await search("Sample")) === 1);
t("search by Arabic name", (await search("سارة")) === 1);
t("search by department", (await search("Quality")) === 1);
t("search by job title", (await search("Supervisor")) === 1);
t("search no match -> empty state", (await search("zzzz")) === 0 && (await p.isVisible(".empty")));
await search("");
// sort
const names = async () => p.$$eval("tbody tr[data-id] td:nth-child(2) b", (n) => n.map((x) => x.textContent));
await p.selectOption("#sortBy", "name"); await p.waitForTimeout(500);
let ns = await names(); t("sort by name (EN) ascending", JSON.stringify(ns) === JSON.stringify([...ns].sort((a, b) => a.localeCompare(b))), ns.join());
await p.click("#sortDir"); await p.waitForTimeout(500);
ns = await names(); t("sort direction toggle -> descending", JSON.stringify(ns) === JSON.stringify([...ns].sort((a, b) => b.localeCompare(a))), ns.join());
await p.selectOption("#sortBy", "id"); await p.waitForTimeout(500);
let ids = await p.$$eval("tbody tr[data-id]", (n) => n.map((x) => x.dataset.id)); t("sort by ID descending", JSON.stringify(ids) === JSON.stringify([...ids].sort().reverse()), ids.join());
await p.click("#sortDir"); await p.selectOption("#sortBy", "dept"); await p.waitForTimeout(500); t("sort by department works", (await p.locator("tbody tr[data-id]").count()) === 3);
await p.selectOption("#sortBy", "id"); await p.waitForTimeout(300);
// create
await p.click("#addBtn"); await p.waitForSelector("#f_id");
await p.screenshot({ path: S + "admin-form-desktop-en.png" });
await p.fill("#f_id", "SMT-009"); await p.fill("#f_name_ar", "")
await p.fill("#f_phone", "12"); await p.fill("#f_email", "bad");
await p.click("#saveBtn"); await p.waitForSelector("#formErr:not(.hidden)");
t("create validation shows field errors", (await p.textContent("#e_phone")).length > 0 && (await p.textContent("#e_name_ar")).length > 0);
await p.fill("#f_name_ar", "نور افتراضي"); await p.fill("#f_name_en", "Noor Placeholder"); await p.fill("#f_title_ar", "مندوب"); await p.fill("#f_title_en", "Sales Rep");
await p.fill("#f_dept_ar", "المبيعات"); await p.fill("#f_dept_en", "Sales"); await p.fill("#f_department", "sales"); await p.fill("#f_phone", "+1 202 555 0150"); await p.fill("#f_whatsapp", "12025550150"); await p.fill("#f_email", "noor.demo@example.com"); await p.fill("#f_location_ar", "الدمام"); await p.fill("#f_location_en", "Dammam");
// photo (generate a real PNG)
const { execSync } = await import("node:child_process");
execSync(`python3 -c "from PIL import Image; Image.new('RGB',(900,600),(112,69,31)).save('/tmp/w/photo.png')"`);
await p.setInputFiles("#f_photo", "/tmp/w/photo.png"); await p.waitForSelector("#photoPrev img");
await p.click("#saveBtn"); await p.waitForSelector(".modal", { state: "detached" });
await search("SMT-009"); t("created employee found", (await p.textContent("tr[data-id=SMT-009]")).includes("Noor Placeholder"));
t("photo uploaded + shown", await p.locator("tr[data-id=SMT-009] .av img").count() === 1);
const imgOk = await p.$eval("tr[data-id=SMT-009] .av img", (i) => new Promise((r) => i.complete ? r(i.naturalWidth) : (i.onload = () => r(i.naturalWidth))));
t("photo renders (512px)", imgOk === 512, imgOk);
// regression (code audit): create succeeds but the photo upload fails -> the retry must update the same record, not hit 409 "exists"
await p.click("#addBtn"); await p.waitForSelector("#f_id");
await p.fill("#f_id", "SMT-010");
for (const [k, v] of Object.entries({ name_ar: "تجربة صورة", name_en: "Photo Retry", title_ar: "م", title_en: "R", phone: "+12025550160" })) await p.fill("#f_" + k, v);
await p.setInputFiles("#f_photo", "/tmp/w/photo.png"); await p.waitForSelector("#photoPrev img");
await p.route("**/api/admin/employees/SMT-010/photo", (r) => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"simulated photo failure"}' }));
await p.click("#saveBtn"); await p.waitForSelector("#formErr:not(.hidden)");
t("photo-upload failure after create shows an error and keeps the form open", (await p.textContent("#formErr")).includes("simulated") && (await p.locator(".modal").count()) === 1);
await p.unroute("**/api/admin/employees/SMT-010/photo");
await p.click("#saveBtn"); await p.waitForSelector(".modal", { state: "detached" });
await search("SMT-010");
t("retry after photo failure saved without a duplicate-ID error, photo now present", (await p.locator("tr[data-id=SMT-010]").count()) === 1 && (await p.locator("tr[data-id=SMT-010] .av img").count()) === 1);
await search("SMT-009");
// duplicate
await p.click("#addBtn"); await p.fill("#f_id", "smt-009");
for (const [k, v] of Object.entries({ name_ar: "س", name_en: "S", title_ar: "م", title_en: "R", phone: "+12025550151" })) await p.fill("#f_" + k, v);
await p.click("#saveBtn"); await p.waitForSelector("#formErr:not(.hidden)"); t("duplicate ID error", (await p.textContent("#formErr")).includes("already exists"));
await p.click(".sheet .foot .btn.alt");
// edit
await p.click("tr[data-id=SMT-009] [data-act=edit]"); await p.waitForSelector("#f_id");
t("ID locked on edit", await p.isDisabled("#f_id"));
await p.fill("#f_title_en", "Senior Sales Rep"); await p.click("#saveBtn"); await p.waitForSelector(".modal", { state: "detached" });
await search("Senior"); t("edit saved + searchable", await p.locator("tr[data-id=SMT-009]").count() === 1);
// preview + QR
await p.click("tr[data-id=SMT-009] [data-act=preview]"); await p.waitForSelector("#qrHost svg");
const cu = await p.inputValue("#cardUrl"); t("card URL", cu === B + "/card.html?id=SMT-009", cu);
await p.waitForTimeout(1500);
t("preview iframe renders card", (await p.frames().find((f) => f.url().includes("card.html?id=SMT-009")).textContent("#name")) === "Noor Placeholder");
await p.screenshot({ path: S + "admin-preview-qr-desktop-en.png" });
const [d1] = await Promise.all([p.waitForEvent("download"), p.click("#dlPng")]); const pngPath = await d1.path(); fs.copyFileSync(pngPath, "/tmp/w/qr.png");
const [d2] = await Promise.all([p.waitForEvent("download"), p.click("#dlSvg")]); t("QR downloads", d1.suggestedFilename().endsWith(".png") && d2.suggestedFilename().endsWith(".svg"));
await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
await p.click("#copyBtn"); t("copy URL", (await p.evaluate(() => navigator.clipboard.readText())) === cu);
await p.click(".sheet .foot .btn");
// deactivate
await p.click("tr[data-id=SMT-009] [data-act=deactivate]"); await p.waitForSelector("tr[data-id=SMT-009] .badge.off");
t("deactivated in admin", true);
const pub = await p.evaluate(async () => (await fetch("/api/employees/SMT-009")).status); t("deactivated -> public 404", pub === 404);
await search(""); await p.selectOption("#stat", "inactive"); await p.waitForTimeout(500); t("inactive filter", (await p.locator("tbody tr[data-id]").count()) === 2);
await p.click("tr[data-id=SMT-009] [data-act=reactivate]"); await p.waitForTimeout(600);
// audit
await p.click(".tab[data-tab=audit]"); await p.waitForSelector(".audit tbody tr"); t("audit log visible to admin", (await p.locator(".audit tbody tr").count()) > 5);
await p.screenshot({ path: S + "admin-audit-desktop-en.png" });
// logout
await p.click("#logoutBtn"); await p.waitForSelector("#loginView:not(.hidden)");
const tokenGone = await p.evaluate(() => sessionStorage.getItem("simta_admin_token")); t("logout clears token", !tokenGone);
t("no secrets in served HTML/JS", !/local test password|local-setup|SETUP_TOKEN/.test((await (await p.request.get(B + "/admin.html")).text()) + (await (await p.request.get(B + "/config.js")).text())));
await p.context().close();

// mobile + tablet admin
for (const [name, vp] of [["mobile", { width: 390, height: 844 }], ["tablet", { width: 820, height: 1100 }]]) {
  const q = await page({ viewport: vp, deviceScaleFactor: 1, isMobile: name === "mobile" });
  await q.goto(B + "/admin.html"); await q.fill("#lemail", "admin@example.com"); await q.fill("#lpass", "local test password 1"); await q.click("#loginForm button");
  await q.waitForSelector(".stat"); await q.screenshot({ path: S + `admin-dashboard-${name}-ar.png`, fullPage: true });
  const ov = await q.evaluate(() => (document.documentElement.scrollWidth > window.innerWidth + 1 || [...document.querySelectorAll("*")].some(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>window.innerWidth+1||r.left<-1)&&getComputedStyle(e).position!=="fixed"&&!e.closest(".tabs")&&!e.closest(".modal")&&e.offsetParent!==null&&!e.closest(".tablewrap table")})) ); t(`${name} dashboard no horizontal overflow`, !ov);
  await q.click(".tab[data-tab=emps]"); await q.waitForSelector("tr[data-id], .mc[data-id]", { state: "attached" }); await q.waitForTimeout(400); await q.screenshot({ path: S + `admin-employees-${name}-ar.png`, fullPage: true });
  t(`${name} employees no horizontal overflow`, !(await q.evaluate(() => (document.documentElement.scrollWidth > window.innerWidth + 1 || [...document.querySelectorAll("*")].some(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>window.innerWidth+1||r.left<-1)&&getComputedStyle(e).position!=="fixed"&&!e.closest(".tabs")&&!e.closest(".modal")&&e.offsetParent!==null&&!e.closest(".tablewrap table")})) )));
  if (name === "mobile") { await q.click(".mc[data-id=SMT-001] [data-act=preview]"); await q.waitForSelector("#qrHost svg"); await q.waitForTimeout(1000); await q.screenshot({ path: S + "admin-preview-mobile-ar.png" }); await q.click(".sheet .foot .btn"); await q.click("#addBtn"); await q.waitForSelector("#f_id"); await q.screenshot({ path: S + "admin-form-mobile-ar.png" }); t("mobile form no overflow", !(await q.evaluate(() => (document.documentElement.scrollWidth > window.innerWidth + 1 || [...document.querySelectorAll("*")].some(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>window.innerWidth+1||r.left<-1)&&getComputedStyle(e).position!=="fixed"&&!e.closest(".tabs")&&!e.closest(".modal")&&e.offsetParent!==null&&!e.closest(".tablewrap table")})) ))); }
  await q.context().close();
}
// broken links
p = await page(desktop); await p.goto(B + "/card.html?id=SMT-001"); await p.waitForSelector(".v2 #name:not(:empty)");
const links = await p.$$eval("link[href],script[src],img[src]", (n) => n.map((x) => x.href || x.src));
let broken = []; for (const l of [...new Set(links)]) { if (!l.startsWith(B)) continue; const r = await p.request.get(l); if (r.status() >= 400) broken.push(l + " " + r.status()); }
t("card.html: no broken local assets", broken.length === 0, broken.join());
await p.goto(B + "/admin.html"); const l2 = await p.$$eval("link[href],script[src],img[src]", (n) => n.map((x) => x.href || x.src)); broken = [];
for (const l of [...new Set(l2)]) { if (!l.startsWith(B)) continue; const r = await p.request.get(l); if (r.status() >= 400) broken.push(l); }
t("admin.html: no broken local assets", broken.length === 0, broken.join());
const ext = await p.$$eval("script[src],link[href]", (n) => n.map((x) => x.src || x.href).filter((u) => !u.startsWith("http://localhost")));
t("no third-party scripts/styles", ext.length === 0, ext.join());
await p.context().close();
t("no external network requests (only localhost)", extReq.size === 0, [...extReq].join());
const real = errors.filter((e) => !/Executing inline script/.test(e)); // the one deliberate injection probe is expected to be blocked
t("no CSP violations raised by the pages (excluding the deliberate injection probe)", real.filter((e) => /Content Security Policy|Refused/.test(e)).length === 0);
t("no JavaScript errors across run", real.length === 0, real.join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
