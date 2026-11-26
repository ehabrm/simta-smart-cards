// Remembered-device tests. Run: node --no-warnings test/remember.test.mjs   (MODE=workerd for the real runtime)
import { makeRuntime } from "./harness.mjs";
const rt = await makeRuntime({ ALLOWED_ORIGINS: "https://a.example.test", CARD_BASE_URL: "https://s.example.test/card.html", SETUP_TOKEN: "setup-token-for-tests", ENVIRONMENT: "staging", TOTP_KEY: "test-totp-key-0123456789abcdef", VIEWS_FLUSH_SECONDS: "0", RATE_API_PER_MIN: "100000", RATE_AUTH_PER_MIN: "100000", RATE_CARD_PER_MIN: "100000" });
let pass = 0, fail = 0; const t = (n, ok, x = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + n + (ok ? "" : "  " + x)); };
async function call(method, p, { body, token } = {}) {
  const headers = {}; if (token) headers.Authorization = "Bearer " + token; let b; if (body !== undefined) { headers["Content-Type"] = "application/json"; b = JSON.stringify(body); }
  const r = await rt.fetch(new Request("https://api.test" + p, { method, headers, body: b })); const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {} return { status: r.status, j };
}
const PW = "correct horse battery"; const iso = (ms) => new Date(ms).toISOString();
let r = await call("POST", "/api/setup", { body: { setup_token: "setup-token-for-tests", email: "owner@example.com", name: "Owner", password: PW } }); t("setup", r.status === 201);
const owner = (await call("POST", "/api/auth/login", { body: { email: "owner@example.com", password: PW } })).j.token;
await call("POST", "/api/admin/platform/users", { token: owner, body: { email: "ed@example.com", name: "ed", password: PW, memberships: [{ company: "simta", role: "editor" }] } });
// 1. login without remember: no remember token, nothing stored
r = await call("POST", "/api/auth/login", { body: { email: "ed@example.com", password: PW } }); t("login without remember returns no remember_token", r.status === 200 && !r.j.remember_token);
t("no remember row without opt-in", (await rt.q("SELECT COUNT(*) n FROM remember_tokens"))[0].n === 0);
r = await call("POST", "/api/auth/login", { body: { email: "ed@example.com", password: PW, remember: "yes" } }); t("truthy non-boolean does not opt in", !r.j.remember_token);
// 2. login with remember
r = await call("POST", "/api/auth/login", { body: { email: "ed@example.com", password: PW, remember: true } }); const L = r.j;
t("login with remember returns a 64-hex remember_token", /^[0-9a-f]{64}$/.test(L.remember_token || ""));
const days = (Date.parse(L.remember_expires_at) - Date.now()) / 86400e3; t("remember expiry about 30 days", days > 29.9 && days <= 30.01, days);
t("session token still expires in 8 hours", Math.abs((Date.parse(L.expires_at) - Date.now()) / 3600e3 - 8) < 0.1);
let row = (await rt.q("SELECT * FROM remember_tokens"))[0]; t("token stored hashed only", row && row.token_hash !== L.remember_token && !JSON.stringify(row).includes(L.remember_token));
const absDays = (Date.parse(row.abs_expires_at) - Date.now()) / 86400e3; t("absolute cap about 90 days", absDays > 89.9 && absDays <= 90.01);
t("login audit records remember opt-in", (await rt.q("SELECT changes FROM audit_log WHERE action='login' ORDER BY id DESC LIMIT 1"))[0].changes.includes("remember"));
// 3. refresh gives a fresh session and a rotated token, user keeps same access
r = await call("POST", "/api/auth/refresh", { body: { remember_token: L.remember_token } }); const R1 = r.j;
t("refresh succeeds with new session + new remember token", r.status === 200 && R1.token && R1.token !== L.token && R1.remember_token && R1.remember_token !== L.remember_token, JSON.stringify(r.j));
r = await call("GET", "/api/auth/me", { token: R1.token }); t("new session works and is the same user", r.status === 200 && r.j.user.email === "ed@example.com" && r.j.user.companies.length === 1);
t("refresh keeps the 90-day cap of the family (does not extend it)", (await rt.q("SELECT COUNT(DISTINCT abs_expires_at) n FROM remember_tokens"))[0].n === 1);
// 4. concurrent use of the rotated token within grace: 409, family not revoked
r = await call("POST", "/api/auth/refresh", { body: { remember_token: L.remember_token } }); t("old token within grace -> 409 rotated, no revoke", r.status === 409 && r.j.code === "rotated", JSON.stringify(r.j));
r = await call("POST", "/api/auth/refresh", { body: { remember_token: R1.remember_token } }); t("current token still works after the concurrent attempt", r.status === 200); const R2 = r.j;
// 5. reuse after grace revokes the family
await rt.x1("UPDATE remember_tokens SET rotated_at=? WHERE rotated_at IS NOT NULL", iso(Date.now() - 120000));
r = await call("POST", "/api/auth/refresh", { body: { remember_token: L.remember_token } }); t("rotated token reused after grace -> 401", r.status === 401);
t("reuse revokes the whole family", (await rt.q("SELECT COUNT(*) n FROM remember_tokens"))[0].n === 0);
r = await call("POST", "/api/auth/refresh", { body: { remember_token: R2.remember_token } }); t("the newest token of a revoked family no longer works", r.status === 401);
t("reuse is audited", (await rt.q("SELECT COUNT(*) n FROM audit_log WHERE action='remember_reuse_revoked'"))[0].n === 1);
// 6. malformed / unknown
for (const bad of ["", "abc", "g".repeat(64), "0".repeat(64)]) { r = await call("POST", "/api/auth/refresh", { body: { remember_token: bad } }); t("invalid token rejected: " + bad.slice(0, 6), r.status === 401); }
r = await call("POST", "/api/auth/refresh", { body: {} }); t("missing token -> 401", r.status === 401);
// 7. sliding expiry and absolute cap
r = await call("POST", "/api/auth/login", { body: { email: "ed@example.com", password: PW, remember: true } }); let C = r.j;
await rt.x1("UPDATE remember_tokens SET expires_at=?", iso(Date.now() - 1000));
r = await call("POST", "/api/auth/refresh", { body: { remember_token: C.remember_token } }); t("token past its 30-day window -> 401", r.status === 401);
r = await call("POST", "/api/auth/login", { body: { email: "ed@example.com", password: PW, remember: true } }); C = r.j;
await rt.x1("UPDATE remember_tokens SET abs_expires_at=?", iso(Date.now() + 5 * 86400e3));
r = await call("POST", "/api/auth/refresh", { body: { remember_token: C.remember_token } }); t("near the cap: refresh works", r.status === 200); const near = r.j;
t("new expiry never passes the 90-day cap", Date.parse(near.remember_expires_at) <= Date.now() + 5 * 86400e3 + 1000);
await rt.x1("UPDATE remember_tokens SET abs_expires_at=?", iso(Date.now() - 1000));
r = await call("POST", "/api/auth/refresh", { body: { remember_token: near.remember_token } }); t("past the 90-day cap -> 401 (password again)", r.status === 401);
// 8. logout revokes this device's family
r = await call("POST", "/api/auth/login", { body: { email: "ed@example.com", password: PW, remember: true } }); C = r.j;
const other = (await call("POST", "/api/auth/login", { body: { email: "ed@example.com", password: PW, remember: true } })).j;
r = await call("POST", "/api/auth/logout", { token: C.token, body: { remember_token: C.remember_token } }); t("logout ok", r.status === 200);
r = await call("POST", "/api/auth/refresh", { body: { remember_token: C.remember_token } }); t("logout ends this device's remembered sign-in", r.status === 401);
r = await call("POST", "/api/auth/refresh", { body: { remember_token: other.remember_token } }); t("another device of the same user is unaffected by that logout", r.status === 200); const OD = r.j;
// 9. logout without a body still works
r = await call("POST", "/api/auth/logout", { token: OD.token }); t("logout without body works", r.status === 200);
// 10. password change / access change / deactivation / 2FA reset revoke remembered devices
const mkRem = async () => (await call("POST", "/api/auth/login", { body: { email: "ed@example.com", password: PW, remember: true } })).j;
const edId = (await rt.q("SELECT id FROM users WHERE email='ed@example.com'"))[0].id;
let X = await mkRem();
r = await call("PUT", "/api/admin/platform/users/" + edId, { token: owner, body: { active: false } }); t("owner deactivates user", r.status === 200, JSON.stringify(r.j));
r = await call("POST", "/api/auth/refresh", { body: { remember_token: X.remember_token } }); t("deactivation revokes remembered device", r.status === 401);
r = await call("PUT", "/api/admin/platform/users/" + edId, { token: owner, body: { active: true } });
X = await mkRem();
r = await call("PUT", "/api/c/simta/admin/users/" + edId, { token: owner, body: { password: "another long password 1" } }); t("password change", r.status === 200, JSON.stringify(r.j));
r = await call("POST", "/api/auth/refresh", { body: { remember_token: X.remember_token } }); t("password change revokes remembered device", r.status === 401);
// 11. user without any company access cannot refresh
X = (await call("POST", "/api/auth/login", { body: { email: "ed@example.com", password: "another long password 1", remember: true } })).j;
await rt.x1("UPDATE user_companies SET active=0 WHERE user_id=" + edId);
r = await call("POST", "/api/auth/refresh", { body: { remember_token: X.remember_token } }); t("no company access left -> 401 and family revoked", r.status === 401 && (await rt.q("SELECT COUNT(*) n FROM remember_tokens WHERE user_id=" + edId))[0].n === 0);
r = await call("POST", "/api/auth/login", { body: { email: "owner@example.com", password: PW, remember: true } }); t("owner platform login remember ok", r.status === 200 && r.j.remember_token);
// 12. the remember token is not a bearer session token
r = await call("GET", "/api/auth/me", { token: r.j.remember_token }); t("remember token cannot be used as a session token", r.status === 401);
// 13. cleanup of expired rows
await rt.x1("UPDATE remember_tokens SET expires_at=?", iso(Date.now() - 1000)); const keep = (await call("POST", "/api/auth/login", { body: { email: "owner@example.com", password: PW, remember: true } })).j;
r = await call("POST", "/api/auth/refresh", { body: { remember_token: keep.remember_token } }); t("refresh cleans expired/rotated rows", r.status === 200 && (await rt.q("SELECT COUNT(*) n FROM remember_tokens WHERE expires_at<'" + iso(Date.now()) + "'"))[0].n === 0);
console.log(`\n${rt.mode}: ${pass} passed, ${fail} failed`); if (rt.mf) await rt.mf.dispose(); process.exit(fail ? 1 : 0);
