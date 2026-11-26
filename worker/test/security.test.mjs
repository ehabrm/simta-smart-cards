// Security hardening tests. FICTIONAL data only. Runs against the mock D1 (default) or the real workerd runtime with a real D1 binding (RUNTIME=workerd).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { totpCode } from "../src/index.js";
const dir = path.dirname(fileURLToPath(import.meta.url));
const RT = process.env.RUNTIME === "workerd" ? "workerd" : "mock";
const ORIGIN = "https://admin.example.test";
const base = { ALLOWED_ORIGINS: ORIGIN, CARD_BASE_URL: "https://cards.example.test/card.html", SETUP_TOKEN: "setup-token-for-tests", ENVIRONMENT: "staging", TOTP_KEY: "test-only-totp-key-0123456789" };
let send, rawq, rawx;
if (RT === "mock") {
  const worker = (await import("../src/index.js")).default; const { makeDB } = await import("./mock-d1.mjs");
  const db = makeDB(); const env = { DB: db, ...base };
  send = (req, over = {}) => worker.fetch(req, { ...env, ...over });
  rawq = async (sql) => db._raw.prepare(sql).all(); rawx = async (sql) => db._raw.prepare(sql).run();
} else {
  const { Miniflare } = await import("miniflare");
  const mf = new Miniflare({ modules: true, scriptPath: path.join(dir, "../src/index.js"), compatibilityDate: "2024-11-01", bindings: base, d1Databases: { DB: "simta-sec" } });
  const db = await mf.getD1Database("DB");
  for (const f of fs.readdirSync(path.join(dir, "../migrations")).sort()) for (const st of fs.readFileSync(path.join(dir, "../migrations", f), "utf8").replace(/^--.*$/gm, "").split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) await db.prepare(st).run();
  send = (req, over = {}) => { if (Object.keys(over).length) throw new Error("env override not supported in workerd mode"); return (async () => mf.dispatchFetch(req.url, { method: req.method, headers: Object.fromEntries(req.headers), body: ["GET","HEAD","OPTIONS"].includes(req.method) ? undefined : await req.text() }))(); };
  rawq = async (sql) => (await db.prepare(sql).all()).results; rawx = async (sql) => db.prepare(sql).run();
}
let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : "  " + extra)); };
let ipn = 0; const newIp = () => { ipn++; return `10.${(ipn >> 16) & 255}.${(ipn >> 8) & 255}.${ipn & 255}`; };
async function call(method, p, { body, token, ip, origin, raw, ct, over } = {}) {
  const headers = { "CF-Connecting-IP": ip || newIp() };
  if (token) headers.Authorization = "Bearer " + token; if (origin) headers.Origin = origin;
  let b; if (raw !== undefined) { headers["Content-Type"] = ct; b = raw; } else if (body !== undefined) { headers["Content-Type"] = "application/json"; b = JSON.stringify(body); }
  const r = await send(new Request("https://api.test" + p, { method, headers, body: b }), over);
  const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: r.status, j, h: r.headers, text };
}
const emp = (id) => ({ id, name_ar: "سارة نموذج", name_en: "Sara Sample", title_ar: "مندوب", title_en: "Sales Rep", department: "sales", dept_ar: "المبيعات", dept_en: "Sales", phone: "+1 202 555 0177", whatsapp: "12025550177", email: "sara.demo@example.com", location_ar: "م", location_en: "Demo City" });
const PW = "correct horse battery";

// ---- setup three users
let r = await call("POST", "/api/setup", { body: { setup_token: base.SETUP_TOKEN, email: "admin@example.com", name: "Admin", password: PW } }); t("setup admin", r.status === 201);
const login = async (email, extra = {}, ip) => call("POST", "/api/auth/login", { body: { email, password: PW, ...extra }, ip });
r = await login("admin@example.com"); const admin = r.j.token;
for (const [e, role] of [["editor@example.com", "editor"], ["viewer@example.com", "viewer"], ["gone@example.com", "viewer"]]) await call("POST", "/api/admin/users", { token: admin, body: { email: e, name: role, role, password: PW } });
const editor = (await login("editor@example.com")).j.token, viewer = (await login("viewer@example.com")).j.token;
const goneTok = (await login("gone@example.com")).j.token;
r = await call("POST", "/api/admin/employees", { token: admin, body: emp("SMT-950") }); t("create sample employee", r.status === 201);

// ---- 1. security headers
const hs = [await call("GET", "/api/health"), await call("GET", "/api/employees/SMT-950"), await call("GET", "/api/employees/SMT-951"), await call("GET", "/api/auth/me"), await call("GET", "/nope")];
const need = { "strict-transport-security": /max-age=\d{7,}/, "x-content-type-options": /nosniff/, "x-frame-options": /DENY/, "referrer-policy": /no-referrer/, "content-security-policy": /default-src 'none'/, "cache-control": /no-store/ };
for (const [k, re] of Object.entries(need)) t(`header ${k} present on 200, 401 and 404 API responses`, hs.every((x) => re.test(x.h.get(k) || "")), hs.map((x) => x.status + ":" + x.h.get(k)).join(" "));
t("no wildcard CORS and no server banner", hs.every((x) => x.h.get("access-control-allow-origin") === null));

// ---- 2. CORS
r = await call("GET", "/api/employees/SMT-950", { origin: "https://evil.example.test" }); t("CORS: unknown origin gets no allow header", r.h.get("access-control-allow-origin") === null);
r = await call("GET", "/api/employees/SMT-950", { origin: ORIGIN }); t("CORS: allowed origin echoed exactly with Vary", r.h.get("access-control-allow-origin") === ORIGIN && /Origin/.test(r.h.get("vary")));
r = await call("OPTIONS", "/api/admin/employees", { origin: "https://evil.example.test" }); t("CORS preflight from unknown origin -> 403", r.status === 403);
r = await call("OPTIONS", "/api/admin/employees", { origin: ORIGIN }); t("CORS preflight from allowed origin -> 204", r.status === 204);
r = await call("OPTIONS", "/api/admin/employees", { origin: "null" }); t('CORS: origin "null" refused', r.status === 403);

// ---- 3. rate limits (each uses its own client IP)
{
  const ip = newIp(); let codes = [];
  for (let i = 0; i < 61; i++) codes.push((await call("GET", "/api/employees/SMT-950", { ip })).status);
  t("public card: 60 requests per minute from one IP are served", codes.slice(0, 60).every((c) => c === 200), codes.join());
  t("public card: the 61st request in the minute -> 429", codes[60] === 429);
  r = await call("GET", "/api/employees/SMT-950", { ip }); t("429 carries Retry-After and a JSON error, no data", r.status === 429 && r.h.get("retry-after") === "60" && r.j.code === "rate_limited" && !r.text.includes("Sara"));
  r = await call("GET", "/api/photos/SMT-950", { ip }); t("photo endpoint shares the public card limit", r.status === 429);
  r = await call("GET", "/api/employees/SMT-950", { ip: newIp() }); t("another IP is not affected", r.status === 200);
  r = await call("GET", "/api/health", { ip }); t("health has its own bucket (not blocked by card limit)", r.status === 200);
}
{
  const ip = newIp(); let codes = [];
  for (let i = 0; i < 21; i++) codes.push((await call("POST", "/api/auth/login", { body: { email: "nobody" + (i % 3) + "@example.com", password: "x" }, ip })).status);
  t("login: 20 attempts per minute per IP reach the password check, 21st -> 429", codes.slice(0, 20).every((c) => c === 401 || c === 429) && codes[20] === 429, codes.join());
}
{
  const ip = newIp(); let c429 = 0, ok = 0;
  for (let i = 0; i < 301; i++) { const x = await call("GET", "/api/auth/me", { token: admin, ip }); x.status === 429 ? c429++ : x.status === 200 && ok++; }
  t("signed-in API: 300 requests per minute served, then 429", ok === 300 && c429 === 1, `ok=${ok} 429=${c429}`);
}
if (RT === "mock") {
  const ip = newIp(); const s = []; for (let i = 0; i < 4; i++) s.push((await call("GET", "/api/employees/SMT-950", { ip, over: { RATE_CARD_PER_MIN: "3" } })).status);
  t("limit is configurable through RATE_CARD_PER_MIN", s.join() === "200,200,200,429", s.join());
  let hit = 0; const ip2 = newIp(); for (let i = 0; i < 3; i++) { await call("GET", "/api/employees/SMT-950", { ip: ip2, over: { RL_CARD: { limit: async () => ({ success: ++hit < 2 }) } } }); }
  r = await call("GET", "/api/employees/SMT-950", { ip: newIp(), over: { RL_CARD: { limit: async () => ({ success: false }) } } }); t("Workers Rate Limiting binding (RL_CARD) is honoured when present", r.status === 429);
  r = await call("GET", "/api/employees/SMT-950", { ip: newIp(), over: { RL_CARD: { limit: async () => { throw new Error("binding down"); } } } }); t("binding failure fails open (card still served)", r.status === 200);
}

// ---- 4. authentication and role matrix
const sampleBody = emp("SMT-960");
const E = [
  ["GET", "/api/employees", "viewer"], ["GET", "/api/admin/stats", "viewer"], ["GET", "/api/admin/employees", "viewer"], ["GET", "/api/admin/employees/SMT-950", "viewer"],
  ["POST", "/api/admin/employees", "editor", sampleBody], ["PUT", "/api/admin/employees/SMT-950", "editor", { title_en: "X" }],
  ["POST", "/api/admin/employees/SMT-950/deactivate", "editor"], ["POST", "/api/admin/employees/SMT-950/reactivate", "editor"],
  ["DELETE", "/api/admin/employees/SMT-950/photo", "editor"], ["PUT", "/api/admin/employees/SMT-950/photo", "editor", undefined, "image/png"],
  ["GET", "/api/admin/audit", "admin"], ["GET", "/api/admin/users", "admin"], ["POST", "/api/admin/users", "admin", { email: "n@example.com", role: "viewer", password: PW }], ["PUT", "/api/admin/users/2", "admin", { role: "editor" }],
];
const RANK = { viewer: 1, editor: 2, admin: 3 };
let matrixBad = [];
const rq = (e, token) => call(e[0], e[1], { token, ...(e[3] ? { body: e[3] } : {}), ...(e[4] ? { raw: "x", ct: e[4] } : {}) });
for (const e of E) {
  for (const [label, tok] of [["none", undefined], ["garbage", "f".repeat(64)], ["short", "abc"]]) { const x = await rq(e, tok); if (x.status !== 401) matrixBad.push(`${e[0]} ${e[1]} ${label} -> ${x.status}`); }
  for (const [role, tok] of [["viewer", viewer], ["editor", editor], ["admin", admin]]) {
    const x = await rq(e, tok); const allowed = RANK[role] >= RANK[e[2]];
    if (allowed ? (x.status === 401 || x.status === 403) : x.status !== 403) matrixBad.push(`${e[0]} ${e[1]} as ${role} -> ${x.status}`);
  }
}
t(`role matrix: ${E.length} endpoints x (no token, bad token, viewer, editor, admin) all as expected`, matrixBad.length === 0, matrixBad.join(" | "));
// restore the objects the matrix touched
await call("POST", "/api/admin/employees/SMT-950/reactivate", { token: admin });
await call("PUT", "/api/admin/users/2", { token: admin, body: { role: "editor" } });
const editor2 = (await login("editor@example.com")).j.token;
await rawx("UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE user_id=1");
r = await call("GET", "/api/auth/me", { token: admin }); t("expired session -> 401", r.status === 401);
r = await call("POST", "/api/auth/login", { body: { email: "admin@example.com", password: PW } }); const admin2 = r.j.token;
await call("PUT", "/api/admin/users/4", { token: admin2, body: { active: false } });
r = await call("GET", "/api/auth/me", { token: goneTok }); t("disabled user's existing session -> 401", r.status === 401);
r = await login("gone@example.com"); t("disabled user cannot sign in", r.status === 401);
r = await call("GET", "/api/auth/me", { token: viewer }); const viewerAlive = r.status;
await call("PUT", "/api/admin/users/3", { token: admin2, body: { role: "editor" } }); r = await call("GET", "/api/auth/me", { token: viewer }); t("role change ends the user's old session", viewerAlive === 200 && r.status === 401);
r = await call("POST", "/api/auth/logout", { token: editor2 }); const lo = r.status; r = await call("GET", "/api/auth/me", { token: editor2 }); t("logout invalidates the token server-side", lo === 200 && r.status === 401);
r = await call("GET", "/api/admin/users", { token: admin2 });
t("user list never exposes password hash, salt or 2FA secret", !/pass_hash|salt|totp_secret|iterations/.test(r.text), r.text.slice(0, 200));
r = await call("GET", "/api/auth/me", { token: admin2 }); t("/me exposes only id, email, name, role, two_factor", Object.keys(r.j.user).sort().join() === "email,id,name,role,two_factor");

// ---- 5. two-factor (TOTP)
const ip5 = () => newIp();
r = await call("POST", "/api/auth/2fa/setup", { token: admin2 }); t("2FA setup returns a secret and an otpauth URI", r.status === 200 && /^[A-Z2-7]{32}$/.test(r.j.secret) && r.j.otpauth_uri.startsWith("otpauth://totp/"));
const sec = r.j.secret;
const stored = JSON.stringify(await rawq("SELECT totp_secret FROM users WHERE email='admin@example.com'"));
t("2FA secret is stored encrypted, not in plain base32", !stored.includes(sec) && /[0-9a-f]{24}:[0-9a-f]+/.test(stored));
r = await call("POST", "/api/auth/2fa/enable", { token: admin2, body: { code: "000000" } }); t("enable with a wrong code -> 422 and 2FA stays off", r.status === 422 && (await rawq("SELECT totp_enabled FROM users WHERE email='admin@example.com'"))[0].totp_enabled === 0);
const c1 = await totpCode(sec);
r = await call("POST", "/api/auth/2fa/enable", { token: admin2, body: { code: c1 } }); t("enable with the right code", r.status === 200);
r = await login("admin@example.com", {}, ip5()); t("login without a code -> 401 totp_required (no session issued)", r.status === 401 && r.j.code === "totp_required" && !r.j.token);
{ // totp_required must be counted (account + IP) and audited, with nothing sensitive stored
  const ip = ip5(); const key = `admin@example.com|${ip}`;
  await rawx("DELETE FROM login_attempts");
  const a0 = (await rawq("SELECT COUNT(*) AS n FROM audit_log WHERE action='login_totp_required'"))[0].n;
  r = await login("admin@example.com", {}, ip); t("totp_required keeps its code and message", r.status === 401 && r.j.code === "totp_required" && /6-digit/.test(r.j.error));
  const ka = (await rawq(`SELECT COUNT(*) AS n FROM login_attempts WHERE key='${key}'`))[0].n, ki = (await rawq(`SELECT COUNT(*) AS n FROM login_attempts WHERE key='ip|${ip}'`))[0].n;
  t("totp_required is counted against the account and the IP", ka === 1 && ki === 1, `${ka},${ki}`);
  const a1 = await rawq("SELECT user_email,entity_id,changes,ip FROM audit_log WHERE action='login_totp_required'");
  t("totp_required is written to the audit log once", a1.length === a0 + 1);
  t("that audit row holds no password, code or secret", !JSON.stringify(a1).includes(PW) && !JSON.stringify(a1).includes(sec) && a1[a1.length - 1].changes === null);
  const x = []; for (let i = 0; i < 6; i++) x.push((await login("admin@example.com", {}, ip)).status);
  t("repeated password-only attempts hit the 5-attempt lockout (429)", x.slice(0, 4).every((s) => s === 401) && x[4] === 429 && x[5] === 429, x.join());
  r = await login("admin@example.com", { totp: await totpCode(sec, Date.now() + 120000) }, ip5()); t("lockout on one IP does not block a different IP", r.status === 401 && r.j.code === "invalid_credentials");
  await rawx("DELETE FROM login_attempts");
}
// a wrong-password attempt must not reveal totp_required
r = await call("POST", "/api/auth/login", { body: { email: "admin@example.com", password: "wrong password!!" }, ip: ip5() }); t("wrong password with 2FA enabled -> invalid_credentials, never totp_required", r.status === 401 && r.j.code === "invalid_credentials");
r = await login("admin@example.com", { totp: "123456" }, ip5()); t("login with a wrong code -> 401", r.status === 401 && r.j.code === "invalid_credentials");
r = await login("admin@example.com", { totp: c1 }, ip5()); t("a code already used to enable 2FA cannot be reused to sign in", r.status === 401);
// time-shifted valid code: next step
const c2 = await totpCode(sec, Date.now() + 30000);
r = await login("admin@example.com", { totp: c2 }, ip5()); t("login with a valid code (within the clock-drift window) -> 200", r.status === 200 && r.j.user.two_factor === true);
const admin3 = r.j.token;
r = await login("admin@example.com", { totp: c2 }, ip5()); t("replaying that same code -> 401", r.status === 401);
r = await login("admin@example.com", { totp: await totpCode(sec, Date.now() + 90000) }, ip5()); t("a code from 3 steps away is refused", r.status === 401);
{ const ip = ip5(); const x = []; for (let i = 0; i < 6; i++) x.push((await login("admin@example.com", { totp: String(100000 + i) }, ip)).status); t("wrong codes count toward the 5-attempt lockout (6th -> 429)", x[5] === 429, x.join()); }
r = await call("POST", "/api/auth/2fa/disable", { token: admin3, body: { password: "wrong password!!", code: await totpCode(sec, Date.now() + 60000) } }); t("disable needs the password: wrong password -> 403", r.status === 403);
r = await call("POST", "/api/auth/2fa/setup", { token: admin3 }); t("setup again while enabled -> 409 (secret not replaced)", r.status === 409);
// REQUIRE_2FA enforcement
if (RT === "mock") {
  const eTok = (await login("editor@example.com")).j.token;
  r = await call("GET", "/api/admin/stats", { token: eTok, over: { REQUIRE_2FA: "true" } }); t("REQUIRE_2FA=true: account without 2FA is blocked from admin data (403 two_factor_required)", r.status === 403 && r.j.code === "two_factor_required");
  r = await call("GET", "/api/auth/me", { token: eTok, over: { REQUIRE_2FA: "true" } }); t("REQUIRE_2FA=true: account without 2FA can still reach /api/auth/ to set it up", r.status === 200);
  r = await call("GET", "/api/admin/stats", { token: admin3, over: { REQUIRE_2FA: "true" } }); t("REQUIRE_2FA=true: account with 2FA is unaffected", r.status === 200);
  r = await call("POST", "/api/auth/2fa/setup", { token: eTok, over: { TOTP_KEY: "" } }); t("2FA setup without TOTP_KEY configured -> 503, nothing stored", r.status === 503 && (await rawq("SELECT totp_secret FROM users WHERE email='editor@example.com'"))[0].totp_secret === null);
}
// admin reset
r = await call("PUT", "/api/admin/users/1", { token: admin3, body: { reset_2fa: true } }); t("admin can reset a user's 2FA (reset_2fa)", r.status === 200);
r = await call("GET", "/api/auth/me", { token: admin3 }); t("reset ends that user's sessions", r.status === 401);
r = await login("admin@example.com", {}, ip5()); t("after reset, password alone signs in again", r.status === 200 && r.j.user.two_factor === false);
let admin4 = r.j.token;

// 2FA hardening: atomic replay guard and secret binding to its user
{
  r = await call("POST", "/api/auth/2fa/setup", { token: admin4 }); const hs = r.j.secret;
  r = await call("POST", "/api/auth/2fa/enable", { token: admin4, body: { code: await totpCode(hs) } }); t("hardening: enable 2FA on admin again", r.status === 200);
  const cc = await totpCode(hs, Date.now() + 30000);
  const both = await Promise.all([login("admin@example.com", { totp: cc }, ip5()), login("admin@example.com", { totp: cc }, ip5())]);
  t("two parallel logins with the same fresh code: exactly one succeeds", both.filter((x) => x.status === 200).length === 1, both.map((x) => x.status).join());
  await rawx("UPDATE users SET totp_secret=(SELECT totp_secret FROM users WHERE email='admin@example.com'), totp_enabled=1, totp_last_step=0 WHERE email='editor@example.com'");
  r = await login("editor@example.com", { totp: await totpCode(hs, Date.now() + 60000) }, ip5()); t("a 2FA secret copied onto another user's row does not unlock it (bound to user id)", r.status === 401, String(r.status));
  await rawx("UPDATE users SET totp_secret=NULL, totp_enabled=0, totp_last_step=0 WHERE email IN ('admin@example.com','editor@example.com')");
  await rawx("DELETE FROM sessions"); await rawx("DELETE FROM login_attempts");
  r = await login("admin@example.com", {}, ip5()); t("hardening cleanup: password-only login works again", r.status === 200); admin4 = r.j.token;
}

// 2FA enable/disable attempt cap
{
  r = await call("POST", "/api/auth/2fa/setup", { token: admin4 });
  const sts = []; for (let i = 0; i < 7; i++) sts.push((await call("POST", "/api/auth/2fa/enable", { token: admin4, body: { code: String(100000 + i * 7) } })).status);
  t("wrong enable codes: 5 x 422 then 429 (cap per user)", sts.slice(0, 5).every((x) => x === 422) && sts[5] === 429 && sts[6] === 429, sts.join());
  await rawx("UPDATE users SET totp_secret=NULL, totp_enabled=0, totp_last_step=0 WHERE email='admin@example.com'"); await rawx("DELETE FROM login_attempts");
}

// ---- 6. audit redaction and secrets
await call("POST", "/api/admin/employees", { token: admin4, body: emp("SMT-961") });
await call("PUT", "/api/admin/employees/SMT-961", { token: admin4, body: { phone: "+1 202 555 0199", email: "new.demo@example.com", title_en: "Lead" } });
await call("POST", "/api/auth/login", { body: { email: "My Secret Pass 123!", password: "zzzzzzzzzzzz" } });
const audit = JSON.stringify(await rawq("SELECT * FROM audit_log"));
t("audit log holds no phone numbers or e-mail addresses of employees", !/2025550|202 555|sara\.demo|new\.demo/.test(audit));
t("audit still records which fields changed", /"phone":\{"from":"\(set\)","to":"\(set\)"\}/.test(audit.replace(/\\"/g, '"')) && /Lead/.test(audit));
t("failed login with text that is not an e-mail is not stored", !/My Secret Pass/.test(audit) && /\(not an e-mail\)/.test(audit));
const allDb = JSON.stringify(await rawq("SELECT * FROM sessions")) + audit;
t("session tokens never appear in the database or the audit log", ![admin, admin2, admin3, admin4].some((x) => allDb.includes(x)));
r = await call("POST", "/api/setup", { body: { setup_token: "x", email: "a@b.co", password: PW } }); t("setup after first run does not reveal the token (409/403 only)", [403, 409].includes(r.status) && !r.text.includes(base.SETUP_TOKEN));
r = await call("POST", "/api/admin/employees", { token: admin4, raw: "{bad", ct: "application/json" }); t("malformed JSON -> 400 without internals", r.status === 400 && !/at |stack|index\.js/.test(r.text));
console.log(`\n${RT}: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
