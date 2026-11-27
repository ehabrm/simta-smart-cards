// Company-scope tests for /api/auth/me. FICTIONAL data only. Run: node --no-warnings test/scope.test.mjs   (MODE=workerd for the real runtime)
import { makeRuntime } from "./harness.mjs";
const rt = await makeRuntime({ ALLOWED_ORIGINS: "https://a.example.test", CARD_BASE_URL: "https://s.example.test/card.html", SETUP_TOKEN: "setup-token-for-tests", ENVIRONMENT: "staging", TOTP_KEY: "test-totp-key-0123456789abcdef", VIEWS_FLUSH_SECONDS: "0", RATE_API_PER_MIN: "100000", RATE_AUTH_PER_MIN: "100000", RATE_CARD_PER_MIN: "100000" });
let pass = 0, fail = 0; const t = (n, ok, x = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + n + (ok ? "" : "  " + x)); };
async function call(method, p, { body, token } = {}) {
  const headers = {}; if (token) headers.Authorization = "Bearer " + token; let b; if (body !== undefined) { headers["Content-Type"] = "application/json"; b = JSON.stringify(body); }
  const r = await rt.fetch(new Request("https://api.test" + p, { method, headers, body: b })); const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {} return { status: r.status, j };
}
const PW = "correct horse battery";
// Second fictional company, seeded before any request (the worker caches the company list for 30 s). allowed_origins is internal and must never be exposed.
await rt.x1("INSERT INTO companies (slug,prefix,name_ar,name_en,card_base_url,allowed_origins,created_at) VALUES ('acme','ACM','اكمي','ACME','https://acme.example.test/card.html','https://acme.example.test','2026-11-27T00:00:00.000Z')");
let r = await call("POST", "/api/setup", { body: { setup_token: "setup-token-for-tests", email: "owner@example.com", name: "Owner", password: PW } }); t("setup", r.status === 201);
const login = async (email) => (await call("POST", "/api/auth/login", { body: { email, password: PW } })).j.token;
const owner = await login("owner@example.com");
const mk = (email, memberships) => call("POST", "/api/admin/platform/users", { token: owner, body: { email, name: email.split("@")[0], password: PW, memberships } });
await mk("a@example.com", [{ company: "simta", role: "editor" }]);
await mk("b@example.com", [{ company: "acme", role: "viewer" }]);
await mk("both@example.com", [{ company: "simta", role: "admin" }, { company: "acme", role: "viewer" }]);
const me = async (tok) => (await call("GET", "/api/auth/me", { token: tok })).j.user;
const slugs = (u) => u.companies.map((c) => c.slug).sort().join();
let u = await me(await login("a@example.com"));
t("simta-only user sees only simta", slugs(u) === "simta" && u.platform_admin === false, slugs(u));
t("simta-only user gets the role of that membership", u.role === "editor" && u.companies[0].role === "editor");
u = await me(await login("b@example.com"));
t("acme-only user sees only acme, never simta", slugs(u) === "acme", slugs(u));
t("acme-only user role comes from the acme membership", u.role === "viewer" && u.companies[0].role === "viewer");
u = await me(await login("both@example.com"));
t("two-company user sees exactly both", slugs(u) === "acme,simta", slugs(u));
t("each company carries its own role", u.companies.find((c) => c.slug === "simta").role === "admin" && u.companies.find((c) => c.slug === "acme").role === "viewer");
u = await me(owner);
t("platform owner sees every active company as admin", slugs(u) === "acme,simta" && u.platform_admin === true && u.companies.every((c) => c.role === "admin"), slugs(u));
const keys = (c) => Object.keys(c).sort().join();
t("each company exposes only the safe fields", u.companies.every((c) => keys(c) === "card_base_url,id,name_ar,name_en,prefix,role,slug"), keys(u.companies[0]));
t("internal company fields (allowed_origins, active, created_at) never exposed", u.companies.every((c) => !("allowed_origins" in c) && !("active" in c) && !("created_at" in c)));
t("no secret-like fields anywhere in /me", !/hash|totp|secret|token|password/i.test(JSON.stringify(u)));
// Membership removed: access to that company disappears; with no membership left the session is refused.
const edB = (await rt.q("SELECT id FROM users WHERE email='both@example.com'"))[0].id; const tokBoth = await login("both@example.com");
await rt.x1("UPDATE user_companies SET active=0 WHERE user_id=" + edB + " AND company_id=(SELECT id FROM companies WHERE slug='acme')");
u = await me(tokBoth); t("deactivated membership removes that company immediately", slugs(u) === "simta", slugs(u));
await rt.x1("UPDATE user_companies SET active=0 WHERE user_id=" + edB);
r = await call("GET", "/api/auth/me", { token: tokBoth }); t("no active membership left -> 401", r.status === 401, r.status);
console.log(`\n${rt.mode}: ${pass} passed, ${fail} failed`); if (rt.mf) await rt.mf.dispose(); process.exit(fail ? 1 : 0);
