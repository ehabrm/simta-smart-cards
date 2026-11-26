// Basic accessibility and small-screen checks in a real browser (local dev server on :8799, fictional data). Run: node test/dev-server.mjs & node test/a11y.browser.mjs
import { chromium } from "playwright";
const B = "http://localhost:8799";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
let pass = 0, fail = 0; const t = (n, ok, x = "") => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (ok ? "" : "  " + x)); };
const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
for (const [name, url] of [["card AR", "/card.html?id=SMT-001"], ["card EN", "/card.html?id=SMT-001&lang=en"], ["card not found", "/card.html?id=SMT-777"], ["admin login", "/admin.html"]]) {
  await p.goto(B + url); await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title,
    vp: !!document.querySelector("meta[name=viewport]"),
    unlabeled: [...document.querySelectorAll("input:not([type=hidden]):not([type=file]),select,textarea")].filter((i) => i.offsetParent && !(i.labels && i.labels.length) && !i.getAttribute("aria-label") && !i.getAttribute("aria-labelledby")).map((i) => i.id || i.name),
    noname: [...document.querySelectorAll("button,a[href]")].filter((b) => b.offsetParent && !(b.textContent || "").trim() && !b.getAttribute("aria-label") && !b.title).length,
    smallTargets: [...document.querySelectorAll("button,a[href],input,select")].filter((b) => { const r = b.getBoundingClientRect(); return b.offsetParent && r.width > 0 && (r.height < 28 || r.width < 28); }).length }));
  t(`${name}: no horizontal scroll at 320px`, r.sw <= r.cw, `${r.sw}>${r.cw}`);
  t(`${name}: html lang and dir set`, /^(ar|en)$/.test(r.lang) && /^(rtl|ltr)$/.test(r.dir), r.lang + r.dir);
  t(`${name}: viewport meta, page title`, r.vp && r.title.length > 0);
  t(`${name}: every visible field has a label`, r.unlabeled.length === 0, r.unlabeled.join());
  t(`${name}: every visible button/link has an accessible name`, r.noname === 0, String(r.noname));
  t(`${name}: touch targets at least 28px`, r.smallTargets === 0, String(r.smallTargets));
}
await p.goto(B + "/admin.html"); await p.waitForTimeout(400);
await p.keyboard.press("Tab"); const f = await p.evaluate(() => document.activeElement && document.activeElement.tagName);
t("admin login: keyboard Tab moves focus to a control", ["BUTTON", "INPUT", "A"].includes(f), f);
const fo = await p.evaluate(() => { const i = document.querySelector("input"); i.focus(); const s = getComputedStyle(i); return s.outlineStyle !== "none" || s.boxShadow !== "none"; });
t("admin login: focused input has a visible focus style", fo);
await browser.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
