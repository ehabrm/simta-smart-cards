// Company-config test (needs `npm run dev:local` on :8799). FICTIONAL company only.
// 1) The shipped company.js keeps the SIMTA identity exactly. 2) A different company.js changes
// title, vCard, quote text and colours with no change to card.js or quote.js.
import { chromium } from "playwright"; import fs from "node:fs";
const B = "http://localhost:8799";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
let pass = 0, fail = 0; const t = (n, ok, x = "") => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (ok ? "" : "  " + x)); };
const FAKE = `window.COMPANY={nameAr:"أكمي",nameEn:"ACME",titleName:"ACME",vcardOrg:"ACME Test Works",vcardFilePrefix:"ACME-",descAr:"وصف أكمي",descEn:"Acme test description",brand:{pageTitle:"ACME | Card",metaDesc:"Acme test card",logo:"acme-logo.png",logoAlt:"ACME أكمي",emblem:"acme-emblem.png",icon:"acme-emblem.png",touchIcon:"acme-emblem.png",panelTitle:"أكمي | ACME",footer:"ACME TEST WORKS"},quote:{ink:"#102030",accent:"#0a7a3c",btnBg:"#123456",btnBorder:"#654321",btnSoft:"#eef7ee",fields:[{k:"qty",t:"number",req:1,lAr:"العدد",lEn:"Units",mAr:"العدد",mEn:"Units"}]}};`;
async function run(company) {
  const c = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } }); const p = await c.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  if (company) await p.route("**/company.js", (r) => r.fulfill({ contentType: "text/javascript", body: company }));
  await p.goto(B + "/card.html?id=SMT-001&lang=en"); await p.waitForSelector(".v1 #name:not(:empty)", { state: "attached" });
  const o = { title: await p.title(), desc: await p.locator("#companyDesc").first().innerText() };
  await p.locator(".qr-btn").locator("visible=true").first().click(); await p.waitForSelector(".qr-sheet");
  o.sheetTitle = await p.innerText(".qr-ttl"); o.fields = await p.locator(".qr-in").count();
  o.send = await p.evaluate(() => getComputedStyle(document.querySelector(".qr-send")).backgroundColor);
  await p.fill("#qr-qty", "7"); await p.click(".qr-send"); await p.waitForTimeout(200);
  o.msg = await p.innerText(".qr-sheet"); await p.click(".qr-x"); await p.waitForSelector(".qr-sheet", { state: "detached" });
  const [dl] = await Promise.all([p.waitForEvent("download"), p.locator("#save").locator("visible=true").first().click()]);
  o.file = dl.suggestedFilename(); o.vcf = fs.readFileSync(await dl.path(), "utf8"); o.brand = await p.evaluate(() => ({ meta: document.querySelector("meta[name=description]").content, icon: document.querySelector("link[rel=icon]").getAttribute("href"), imgs: [...document.querySelectorAll("img")].map((i) => i.getAttribute("src")), foot: [...document.querySelectorAll(".footer")].map((e) => e.textContent), panel: [...document.querySelectorAll("#sideTitle,#companyTitle")].map((e) => e.textContent), html: document.documentElement.outerHTML.includes("SIMTA") ? document.documentElement.outerHTML.match(/.{0,40}SIMTA.{0,20}/g) : [] })); o.errs = errs; await c.close(); return o;
}
const s = await run(null);
t("SIMTA title kept", s.title === "SIMTA | Sara Sample", s.title);
t("SIMTA quote title kept", s.sheetTitle === "Quote request — SIMTA", s.sheetTitle);
t("SIMTA quote has its 5 fields", s.fields === 5, String(s.fields));
t("SIMTA quote button colour kept", s.send === "rgb(75, 47, 24)", s.send);
t("SIMTA vCard file and org kept", s.file === "SIMTA-SMT-001.vcf" && s.vcf.includes("ORG;CHARSET=utf-8:SIMTA Ready Mix Concrete"));
t("SIMTA description kept", /^SIMTA is a ready-mix concrete company/.test(s.desc), s.desc);
t("no JS errors (SIMTA)", s.errs.length === 0);
const a = await run(FAKE);
t("other company: title", a.title === "ACME | Sara Sample", a.title);
t("other company: quote title and fields", a.sheetTitle === "Quote request — ACME" && a.fields === 1, a.sheetTitle + " " + a.fields);
t("other company: quote colour", a.send === "rgb(18, 52, 86)", a.send);
t("other company: quote message", a.msg.includes("Units: 7") && !/SIMTA/.test(a.msg), a.msg);
t("other company: vCard file and org", a.file === "ACME-SMT-001.vcf" && a.vcf.includes("ORG;CHARSET=utf-8:ACME Test Works") && !/SIMTA/.test(a.vcf));
t("other company: description", a.desc === "Acme test description", a.desc);
t("other company: head, logos, footer, panel title", a.brand.meta === "Acme test card" && a.brand.icon === "acme-emblem.png" && a.brand.imgs.every((x) => /^acme-/.test(x)) && a.brand.foot.every((x) => x === "ACME TEST WORKS") && a.brand.panel.every((x) => x === "أكمي | ACME"), JSON.stringify(a.brand));
t("other company: no SIMTA text left in the page after load", a.title === "ACME | Sara Sample" && a.brand.html.length === 0, JSON.stringify(a.brand.html));
t("SIMTA brand kept: logos, footer, panel title", s.brand.imgs.every((x) => /^(2-logo\.jpg|3-emblem\.webp)$/.test(x)) && s.brand.foot.every((x) => x === "SIMTA · READY MIX CONCRETE") && s.brand.panel.every((x) => x === "سيمتا | SIMTA"), JSON.stringify(s.brand));
t("no JS errors (other)", a.errs.length === 0);
await browser.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
