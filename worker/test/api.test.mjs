import worker from "../src/index.js";
import { makeDB } from "./mock-d1.mjs";
const ORIGIN = "https://admin.example.test";
const env = { DB: makeDB(), ALLOWED_ORIGINS: ORIGIN, CARD_BASE_URL: "https://cards.example.test/card.html", SETUP_TOKEN: "setup-token-for-tests", ENVIRONMENT: "staging" };
import { DatabaseSync } from "node:sqlite"; import fs from "node:fs";
let pass = 0, fail = 0;
{ // migration must fail loudly on a pre-existing incompatible table
  const d = new DatabaseSync(":memory:"); d.exec("CREATE TABLE employees (id TEXT, name TEXT)");
  let threw = false; try { d.exec(fs.readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8")); } catch (e) { threw = /already exists/.test(String(e.message)); }
  console.log((threw ? "PASS" : "FAIL") + " migration fails loudly when an incompatible employees table exists"); threw ? pass++ : fail++;
  const d2 = new DatabaseSync(":memory:"); let ok = true; try { d2.exec(fs.readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8")); } catch { ok = false; }
  console.log((ok ? "PASS" : "FAIL") + " migration applies cleanly on an empty database"); ok ? pass++ : fail++;
}
const t = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : "  " + extra)); };
async function call(method, path, { body, token, raw, ct, origin, headers: xh } = {}) {
  const headers = { ...(xh || {}) };
  if (token) headers.Authorization = "Bearer " + token;
  if (origin) headers.Origin = origin;
  let b;
  if (raw !== undefined) { headers["Content-Type"] = ct; b = raw; } else if (body !== undefined) { headers["Content-Type"] = "application/json"; b = JSON.stringify(body); }
  const r = await worker.fetch(new Request("https://api.test" + path, { method, headers, body: b }), env);
  const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: r.status, j, headers: r.headers, text };
}
const emp = (id, o = {}) => ({ id, name_ar: "سارة نموذج", name_en: "Sara Sample", title_ar: "مندوب خرسانة", title_en: "Concrete Sales Representative", department: "sales", dept_ar: "المبيعات", dept_en: "Sales", phone: "+1 202 555 0101", whatsapp: "12025550101", email: "sara.demo@example.com", location_ar: "المدينة التجريبية", location_en: "Demo City", ...o });

let r = await call("GET", "/api/health"); t("health", r.j.ok && r.j.database === "bound");
r = await call("GET", "/api/employees"); t("directory list without session -> 401", r.status === 401);
r = await call("POST", "/api/admin/employees", { body: emp("SMT-001") }); t("unauth create -> 401", r.status === 401);
r = await call("GET", "/api/admin/employees"); t("unauth admin list -> 401", r.status === 401);
r = await call("POST", "/api/admin/employees", { body: emp("SMT-001"), token: "a".repeat(64) }); t("forged token -> 401", r.status === 401);
r = await call("POST", "/api/setup", { body: { setup_token: "wrong", email: "a@b.co", password: "correct horse battery" } }); t("setup wrong token -> 403", r.status === 403);
r = await call("POST", "/api/setup", { body: { setup_token: env.SETUP_TOKEN, email: "admin@example.com", password: "short" } }); t("setup weak pw -> 400", r.status === 400);
r = await call("POST", "/api/setup", { body: { setup_token: env.SETUP_TOKEN, email: "admin@example.com", name: "Admin", password: "correct horse battery" } }); t("setup ok", r.status === 201);
r = await call("POST", "/api/setup", { body: { setup_token: env.SETUP_TOKEN, email: "x@example.com", password: "correct horse battery" } }); t("setup only once -> 409", r.status === 409);
r = await call("POST", "/api/auth/login", { body: { email: "admin@example.com", password: "nope" } }); t("bad login -> 401", r.status === 401);
r = await call("POST", "/api/auth/login", { body: { email: "admin@example.com", password: "correct horse battery" } }); t("login ok", r.status === 200 && /^[0-9a-f]{64}$/.test(r.j.token));
const admin = r.j.token;
t("db stores hash of token, not token", !JSON.stringify(env.DB._raw.prepare("SELECT * FROM sessions").all()).includes(admin));
t("password not stored in plain", !JSON.stringify(env.DB._raw.prepare("SELECT * FROM users").all()).includes("correct horse"));

// employees
r = await call("POST", "/api/admin/employees", { token: admin, body: emp("smt-001") }); t("create (id normalised)", r.status === 201 && r.j.employee.id === "SMT-001" && r.j.employee.phone === "+12025550101", JSON.stringify(r.j));
r = await call("POST", "/api/admin/employees", { token: admin, body: emp("SMT-001") }); t("duplicate id -> 409", r.status === 409);
for (const bad of ["SMT-1", "X-001", "SMT-001;DROP", "", "../etc"]) { r = await call("POST", "/api/admin/employees", { token: admin, body: emp(bad) }); t("bad id rejected: " + JSON.stringify(bad), r.status === 422, r.status); }
r = await call("POST", "/api/admin/employees", { token: admin, body: emp("SMT-002", { phone: "abc", email: "nope", name_ar: "" }) }); t("validation errors", r.status === 422 && r.j.details.phone && r.j.details.email && r.j.details.name_ar);
r = await call("POST", "/api/admin/employees", { token: admin, body: emp("SMT-002", { name_en: "<script>alert(1)</script>Evil" }) }); t("angle brackets stripped", r.status === 201 && !r.j.employee.name_en.includes("<"));
r = await call("POST", "/api/admin/employees", { token: admin, body: emp("SMT-003", { extra: { badge: "A1" } }) }); t("extra fields stored", r.j.employee.extra.badge === "A1");
r = await call("POST", "/api/admin/employees", { token: admin, raw: "{}", ct: "text/plain" }); t("wrong content-type -> 415", r.status === 415);
r = await call("POST", "/api/admin/employees", { token: admin, raw: "{bad", ct: "application/json" }); t("bad json -> 400", r.status === 400);
r = await call("PUT", "/api/admin/employees/SMT-001", { token: admin, body: { title_en: "Senior Rep", id: "SMT-009" } }); t("id change rejected", r.status === 422);
r = await call("PUT", "/api/admin/employees/SMT-001", { token: admin, body: { title_en: "Senior Rep", active: false } }); t("active via PUT rejected", r.status === 422);
r = await call("PUT", "/api/admin/employees/SMT-001", { token: admin, body: { title_en: "Senior Rep" } }); t("edit", r.status === 200 && r.j.employee.title_en === "Senior Rep" && r.j.employee.name_en === "Sara Sample");
r = await call("GET", "/api/employees/SMT-001"); t("public get has no internal fields", r.status === 200 && !("created_by" in r.j) && !("active" in r.j) && !("extra" in r.j) && !("department" in r.j) && !("updated_by" in r.j) && r.j.card_url.endsWith("?id=SMT-001"));
t("public get exposes only allowlisted keys", Object.keys(r.j).sort().join() === "card_url,dept_ar,dept_en,email,id,location_ar,location_en,name_ar,name_en,phone,photo_url,title_ar,title_en,whatsapp");
r = await call("GET", "/api/employees/smt-001"); t("public get case-insens", r.status === 200);
r = await call("GET", "/api/employees/SMT-404"); t("unknown -> 404", r.status === 404 && typeof r.j.error === "string");
r = await call("GET", "/api/employees/bad%20id"); t("bad id -> 400", r.status === 400);
// search
for (const [q, n] of [["SMT-003", 1], ["sara", 2], ["سارة", 3], ["مندوب", 3], ["Senior", 1], ["Sales", 3], ["المبيعات", 3], ["zzz", 0], ["100%", 0], ["_", 0]]) { r = await call("GET", "/api/admin/employees?q=" + encodeURIComponent(q), { token: admin }); t(`search "${q}" -> ${n}`, r.j.employees.length === n, r.j.employees?.length); }
// sorting
r = await call("GET", "/api/admin/employees?sort=name_en&dir=asc", { token: admin }); { const n = r.j.employees.map((e) => e.name_en); t("sort name_en asc", r.status === 200 && JSON.stringify(n) === JSON.stringify([...n].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)), n.join()); }
r = await call("GET", "/api/admin/employees?sort=id&dir=desc", { token: admin }); t("sort id desc", r.j.employees.map((e) => e.id).join() === "SMT-003,SMT-002,SMT-001", r.j.employees.map((e) => e.id).join());
r = await call("GET", "/api/admin/employees?sort=updated&dir=desc", { token: admin }); t("sort updated desc", r.status === 200);
r = await call("GET", "/api/admin/employees?sort=id;DROP%20TABLE%20employees", { token: admin }); t("sort injection rejected", r.status === 400);
r = await call("GET", "/api/admin/employees?sort=id&dir=sideways", { token: admin }); t("bad dir rejected", r.status === 400);
r = await call("GET", "/api/admin/employees?sort=password", { token: admin }); t("unknown sort column rejected", r.status === 400);
// photo
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0]);
r = await call("PUT", "/api/admin/employees/SMT-001/photo", { token: admin, raw: png, ct: "image/png" }); t("photo upload", r.status === 200 && r.j.employee.photo_url.includes("v=1"));
r = await call("PUT", "/api/admin/employees/SMT-001/photo", { token: admin, raw: new TextEncoder().encode("<svg onload=alert(1)>"), ct: "image/png" }); t("fake image rejected", r.status === 415);
r = await call("PUT", "/api/admin/employees/SMT-001/photo", { token: admin, raw: new TextEncoder().encode("<svg/>"), ct: "image/svg+xml" }); t("svg rejected", r.status === 415);
r = await call("PUT", "/api/admin/employees/SMT-001/photo", { token: admin, raw: new Uint8Array(400 * 1024).fill(0xff), ct: "image/jpeg" }); t("oversize rejected", r.status === 413);
r = await call("PUT", "/api/admin/employees/SMT-001/photo", { token: admin, raw: new Uint8Array(400 * 1024).fill(0x89), ct: "image/png", headers: { "Content-Length": String(400 * 1024) } }); t("oversize photo with a declared Content-Length rejected 413", r.status === 413);
r = await call("GET", "/api/photos/SMT-001"); t("photo served with image type", r.status === 200 && r.headers.get("content-type") === "image/png");
// roles
r = await call("POST", "/api/admin/users", { token: admin, body: { email: "viewer@example.com", role: "viewer", password: "viewer password 123" } }); t("create viewer", r.status === 201);
r = await call("POST", "/api/admin/users", { token: admin, body: { email: "editor@example.com", role: "editor", password: "editor password 123" } }); t("create editor", r.status === 201);
const viewer = (await call("POST", "/api/auth/login", { body: { email: "viewer@example.com", password: "viewer password 123" } })).j.token;
const editor = (await call("POST", "/api/auth/login", { body: { email: "editor@example.com", password: "editor password 123" } })).j.token;
// maintenance switch
r = await call("GET", "/api/status"); t("maintenance: status off by default", r.status === 200 && r.j.maintenance === false);
r = await call("PUT", "/api/admin/maintenance", { body: { enabled: true } }); t("maintenance: unauth PUT -> 401", r.status === 401);
r = await call("PUT", "/api/admin/maintenance", { token: editor, body: { enabled: true } }); t("maintenance: editor PUT -> 403", r.status === 403);
r = await call("PUT", "/api/admin/maintenance", { token: viewer, body: { enabled: true } }); t("maintenance: viewer PUT -> 403", r.status === 403);
r = await call("PUT", "/api/admin/maintenance", { token: admin, body: { enabled: "yes" } }); t("maintenance: bad body -> 422", r.status === 422);
r = await call("GET", "/api/employees/SMT-001"); t("maintenance: card up before", r.status === 200);
r = await call("PUT", "/api/admin/maintenance", { token: admin, body: { enabled: true } }); t("maintenance: admin enables", r.status === 200 && r.j.maintenance === true);
r = await call("GET", "/api/employees/SMT-001"); t("maintenance: card 503 + code + no-store", r.status === 503 && r.j.code === "maintenance" && r.headers.get("cache-control") === "no-store");
r = await call("GET", "/api/employees/SMT-404"); t("maintenance: unknown id also 503", r.status === 503);
r = await call("GET", "/api/photos/SMT-001"); t("maintenance: photo 503", r.status === 503);
r = await call("GET", "/api/status"); t("maintenance: status on", r.j.maintenance === true);
r = await call("GET", "/api/admin/maintenance", { token: viewer }); t("maintenance: admin API still readable", r.status === 200 && r.j.maintenance === true);
r = await call("GET", "/api/admin/employees", { token: admin }); t("maintenance: admin employees still works", r.status === 200);
r = await call("POST", "/api/auth/login", { body: { email: "admin@example.com", password: "correct horse battery" } }); t("maintenance: login still works", r.status === 200);
r = await call("PUT", "/api/admin/maintenance", { token: admin, body: { enabled: false } }); t("maintenance: admin disables", r.status === 200 && r.j.maintenance === false);
r = await call("GET", "/api/employees/SMT-001"); t("maintenance: card back up", r.status === 200 && r.j.id === "SMT-001");
t("maintenance: audited", env.DB._raw.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='maintenance'").get().n === 2);
r = await call("GET", "/api/admin/employees", { token: viewer }); t("viewer can read", r.status === 200);
for (const [m, p, b] of [["POST", "/api/admin/employees", emp("SMT-010")], ["PUT", "/api/admin/employees/SMT-001", { title_en: "x" }], ["POST", "/api/admin/employees/SMT-001/deactivate"], ["GET", "/api/admin/users"], ["GET", "/api/admin/audit"]]) { r = await call(m, p, { token: viewer, body: b }); t(`viewer forbidden ${m} ${p}`, r.status === 403, r.status); }
r = await call("GET", "/api/admin/users", { token: editor }); t("editor cannot manage users", r.status === 403);
r = await call("POST", "/api/admin/employees", { token: editor, body: emp("SMT-010") }); t("editor can create", r.status === 201);
// deactivate
r = await call("POST", "/api/admin/employees/SMT-001/deactivate", { token: editor }); t("deactivate", r.status === 200 && r.j.employee.active === false);
t("record kept after deactivate", !!env.DB._raw.prepare("SELECT 1 FROM employees WHERE id='SMT-001'").get());
r = await call("GET", "/api/employees/SMT-001"); t("deactivated card -> 503 maintenance code (not 404)", r.status === 503 && r.j.code === "card_maintenance");
// permanent delete: admin only + typed-ID confirmation + audit
r = await call("POST", "/api/admin/employees", { token: admin, body: emp("SMT-777") }); t("create SMT-777 for delete test", r.status === 201, r.status);
r = await call("DELETE", "/api/admin/employees/SMT-777", { token: editor, body: { confirm: "SMT-777" } }); t("delete: editor forbidden", r.status === 403, r.status);
r = await call("DELETE", "/api/admin/employees/SMT-777", { token: viewer, body: { confirm: "SMT-777" } }); t("delete: viewer forbidden", r.status === 403, r.status);
r = await call("DELETE", "/api/admin/employees/SMT-777", { token: admin }); t("delete: no confirmation -> 422", r.status === 422 && r.j.code === "confirmation_required", r.status);
r = await call("DELETE", "/api/admin/employees/SMT-777", { token: admin, body: { confirm: "SMT-001" } }); t("delete: wrong confirmation -> 422", r.status === 422, r.status);
r = await call("DELETE", "/api/admin/employees/SMT-777"); t("delete: unauthenticated -> 401", r.status === 401, r.status);
t("delete: record still there after refused attempts", !!env.DB._raw.prepare("SELECT 1 FROM employees WHERE id='SMT-777'").get());
r = await call("DELETE", "/api/admin/employees/SMT-777", { token: admin, body: { confirm: "smt-777" } }); t("delete: typed ID (case-insensitive) -> 200", r.status === 200 && r.j.deleted === true, r.status);
t("delete: row and photo gone", !env.DB._raw.prepare("SELECT 1 FROM employees WHERE id='SMT-777'").get() && !env.DB._raw.prepare("SELECT 1 FROM employee_photos WHERE employee_id='SMT-777'").get());
r = await call("GET", "/api/employees/SMT-777"); t("delete: public get -> 404", r.status === 404, r.status);
r = await call("DELETE", "/api/admin/employees/SMT-777", { token: admin, body: { confirm: "SMT-777" } }); t("delete: second delete -> 404", r.status === 404, r.status);
t("delete: audit row written", !!env.DB._raw.prepare("SELECT 1 FROM audit_log WHERE action='delete' AND entity_id='SMT-777'").get());
t("delete: other employees untouched", !!env.DB._raw.prepare("SELECT 1 FROM employees WHERE id='SMT-001'").get());
// visit counters: views + approximate browsers, aggregate only, never breaks the card
env.VIEWS_FLUSH_SECONDS = "0";
r = await call("POST", "/api/admin/employees", { token: admin, body: emp("SMT-778") }); t("create SMT-778 for visit test", r.status === 201, r.status);
const view = (path, ua) => worker.fetch(new Request("https://api.test" + path, { headers: { "User-Agent": ua || "Mozilla/5.0 (iPhone) Safari" } }), env);
await view("/api/employees/SMT-778"); // flushes anything buffered by earlier tests
r = await call("GET", "/api/admin/stats", { token: admin }); const base = { v: r.j.visits.views.today, b: r.j.visits.browsers_approx.today, c: (r.j.visits.top_30d.find((x) => x.id === "SMT-778") || { views: 0 }).views };
let v = await view("/api/employees/SMT-778"); t("visit: card still 200", v.status === 200);
v = await view("/api/employees/SMT-778?f=1"); t("visit: first-of-day open 200", v.status === 200);
await view("/api/employees/SMT-778?preview=1"); await view("/api/employees/SMT-778", "Googlebot/2.1"); await view("/api/employees/SMT-998"); await view("/api/employees/SMT-001");
r = await call("GET", "/api/admin/stats", { token: admin });
t("visit: views counted (2; preview, bot, missing and inactive excluded)", r.j.visits && r.j.visits.views.today - base.v === 2, JSON.stringify(r.j.visits && r.j.visits.views));
t("visit: approx browsers today +1 (self-reported first-of-day flag)", r.j.visits.browsers_approx.today - base.b === 1);
t("visit: top card listed", (r.j.visits.top_30d.find((x) => x.id === "SMT-778") || { views: 0 }).views - base.c === 2);
t("visit: no visitor identifiers stored", JSON.stringify(env.DB._raw.prepare("PRAGMA table_info(card_views)").all().map((c) => c.name)) === '["day","employee_id","views","browsers","company_id"]');
{ const bad = { ...env, DB: { ...env.DB, batch: async () => { throw new Error("db down"); } } }; const rr = await worker.fetch(new Request("https://api.test/api/employees/SMT-778", { headers: { "User-Agent": "Mozilla/5.0" } }), bad); t("visit: counting failure never breaks the card", rr.status === 200, rr.status); }
env.VIEWS_FLUSH_SECONDS = "3600"; await view("/api/employees/SMT-778"); await view("/api/employees/SMT-778");
r = await call("GET", "/api/admin/stats", { token: admin }); t("visit: batching limits writes (no new flush within the interval)", r.j.visits.views.today - base.v === 2, r.j.visits.views.today);
env.VIEWS_FLUSH_SECONDS = "0";
r = await call("GET", "/api/employees", { token: admin }); t("directory list (with session) hides deactivated", Array.isArray(r.j) && !r.j.some((e) => e.id === "SMT-001") && r.j.length >= 1);
t("directory list has no internal fields", r.j.every((e) => !("extra" in e) && !("department" in e) && !("active" in e) && !("created_by" in e)));
r = await call("GET", "/api/employees", { token: "b".repeat(64) }); t("directory list with forged token -> 401", r.status === 401);
r = await call("GET", "/api/photos/SMT-001"); t("deactivated photo hidden", r.status === 404);
r = await call("GET", "/api/admin/employees?status=inactive", { token: admin }); t("admin sees inactive", r.j.total === 1);
r = await call("DELETE", "/api/admin/employees/SMT-001", { token: admin }); t("delete without typed confirmation is refused (422)", r.status === 422);
r = await call("POST", "/api/admin/employees/SMT-001/reactivate", { token: editor }); t("reactivate", r.j.employee.active === true);
r = await call("GET", "/api/admin/stats", { token: admin }); t("stats", r.j.total === 5 && r.j.active === 5, JSON.stringify(r.j));
// audit
r = await call("GET", "/api/admin/audit?limit=200", { token: admin }); const acts = r.j.entries.map((e) => e.action);
t("audit has create/update/deactivate/photo/login_failed", ["create", "update", "deactivate", "reactivate", "photo_set", "login_failed", "login"].every((a) => acts.includes(a)), acts.join());
t("audit never contains passwords", !JSON.stringify(r.j).includes("correct horse"));
// logout, session
r = await call("POST", "/api/auth/logout", { token: viewer }); r = await call("GET", "/api/admin/employees", { token: viewer }); t("logout invalidates token", r.status === 401);
env.DB._raw.exec("UPDATE sessions SET expires_at='2000-01-01T00:00:00Z' WHERE user_id=1");
r = await call("GET", "/api/admin/employees", { token: admin }); t("expired session -> 401", r.status === 401);
// rate limit
let last; for (let i = 0; i < 6; i++) last = await call("POST", "/api/auth/login", { body: { email: "editor@example.com", password: "wrong" + i } }); t("login rate limit -> 429", last.status === 429);
r = await call("POST", "/api/auth/login", { body: { email: "editor@example.com", password: "editor password 123" } }); t("correct password also blocked during lockout", r.status === 429);
// CORS
r = await call("OPTIONS", "/api/employees", { origin: ORIGIN }); t("CORS preflight allowed origin", r.status === 204 && r.headers.get("access-control-allow-origin") === ORIGIN);
r = await call("OPTIONS", "/api/employees", { origin: "https://evil.example" }); t("CORS preflight blocked origin", r.status === 403 && !r.headers.get("access-control-allow-origin"));
r = await call("GET", "/api/employees", { origin: "https://evil.example" }); t("no ACAO for unknown origin", !r.headers.get("access-control-allow-origin"));
r = await call("GET", "/api/nope"); t("unknown route 404 json", r.status === 404 && r.j.error);
const noDb = await worker.fetch(new Request("https://api.test/api/employees"), {}); t("missing DB -> 503", noDb.status === 503);
const SQLX = async (s) => env.DB._raw.exec(s), SQLQ = async (s) => env.DB._raw.prepare(s).all();
// ---- regression tests added by the code audit (shared by both runners) ----
{
  const tok = async (email, password) => (await call("POST", "/api/auth/login", { body: { email, password } })).j.token;
  const adminT = await tok("admin@example.com", "correct horse battery");
  let rr = await call("GET", "/api/employees/%E0%A4%A"); t("[audit] malformed %-encoding in employee id -> 400, not 500", rr.status === 400, rr.status);
  rr = await call("GET", "/api/photos/%E0%A4%A"); t("[audit] malformed %-encoding in photo id -> 400, not 500", rr.status === 400, rr.status);
  rr = await call("GET", "/api/admin/employees/%E0%A4%A", { token: adminT }); t("[audit] malformed %-encoding in admin id -> 400, not 500", rr.status === 400, rr.status);
  // strict boolean for user "active": 0 / "" / "false" must not slip past the self-disable guard
  const me = (await call("GET", "/api/auth/me", { token: adminT })).j.user;
  for (const v of [0, "", "false", null]) { rr = await call("PUT", "/api/admin/users/" + me.id, { token: adminT, body: { active: v } }); t("[audit] admin cannot disable self via active=" + JSON.stringify(v), rr.status === 422, rr.status); }
  rr = await call("GET", "/api/auth/me", { token: adminT }); t("[audit] admin session still valid after those attempts", rr.status === 200);
  // role change revokes the user's existing sessions
  await call("POST", "/api/admin/users", { token: adminT, body: { email: "demote@example.com", role: "editor", password: "demote me please 123" } });
  const dT = await tok("demote@example.com", "demote me please 123");
  rr = await call("POST", "/api/admin/employees", { token: dT, body: emp("SMT-020") }); t("[audit] editor can create before demotion", rr.status === 201);
  const uid = (await call("GET", "/api/admin/users", { token: adminT })).j.users.find((u) => u.email === "demote@example.com").id;
  await call("PUT", "/api/admin/users/" + uid, { token: adminT, body: { role: "viewer" } });
  rr = await call("POST", "/api/admin/employees", { token: dT, body: emp("SMT-021") }); t("[audit] old editor session is revoked after demotion", rr.status === 401, rr.status);
  // data change and its audit row are atomic
  await SQLX("ALT" + "ER TABLE audit_log RENAME TO audit_log_x");
  rr = await call("POST", "/api/admin/employees", { token: adminT, body: emp("SMT-022") });
  const gone = (await SQLQ("SELECT id FROM employees WHERE id='SMT-022'")).length === 0;
  await SQLX("ALT" + "ER TABLE audit_log_x RENAME TO audit_log");
  t("[audit] if the audit write fails the employee change is rolled back", rr.status === 500 && gone, rr.status + " rolledBack=" + gone);
  // denied writes are audited (bounded, no body), photo cache is revalidated, directory pages
  await call("POST", "/api/admin/users", { token: adminT, body: { email: "viewer2@example.com", role: "viewer", password: "viewer two password 1" } });
  const v2 = await tok("viewer2@example.com", "viewer two password 1");
  for (let i = 0; i < 25; i++) { rr = await call("POST", "/api/admin/employees", { token: v2, body: { ...emp("SMT-03" + (i % 10)), note: "SECRET-BODY-MARKER" } }); if (i === 0) t("[audit] viewer write denied with 403", rr.status === 403, rr.status); }
  const den = await SQLQ("SELECT changes, entity_id FROM audit_log WHERE action='denied' AND user_email='viewer2@example.com'");
  t("[audit] denied attempts are audited but capped (<=20 per user per window)", den.length >= 1 && den.length <= 20, "rows=" + den.length);
  t("[audit] denied audit row stores method+path only, no request body", den.every((d) => !/SECRET-BODY-MARKER/.test(d.changes || "")) && /POST/.test(den[0].changes || ""));
  rr = await call("POST", "/api/setup", { body: { setup_token: "wrong", email: "z@example.com", password: "correct horse battery" } });
  t("[audit] setup attempts with a bad token are NOT written to the audit log", (await SQLQ("SELECT COUNT(*) AS n FROM audit_log WHERE action='denied' AND entity_id LIKE '%setup%'"))[0].n === 0);
  await call("POST", "/api/admin/employees", { token: adminT, body: emp("SMT-040") });
  const pr = await call("GET", "/api/employees?limit=1&offset=0", { token: adminT });
  t("[audit] directory supports limit/offset and reports total in X-Total-Count", Array.isArray(pr.j) && pr.j.length === 1 && Number(pr.headers.get("X-Total-Count")) >= 2, JSON.stringify([pr.status, pr.j && pr.j.length, pr.headers.get("X-Total-Count")]));
  rr = await call("GET", "/api/employees?limit=1&offset=1", { token: adminT }); t("[audit] directory page 2 returns a different row", rr.j.length === 1 && rr.j[0].id !== pr.j[0].id);
  { // concurrent first-run setup on a fresh database: exactly one admin is created
    const env2 = { ...env, DB: makeDB() };
    const mk = (e) => worker.fetch(new Request("https://api.test/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setup_token: env.SETUP_TOKEN, email: e, password: "correct horse battery" }) }), env2);
    const rs = await Promise.all([mk("a1@example.com"), mk("a2@example.com"), mk("a3@example.com")]);
    const codes = rs.map((x) => x.status).sort().join();
    const n = (await env2.DB.prepare("SELECT COUNT(*) AS n FROM users").first()).n;
    t("[audit] concurrent setup creates exactly one admin", n === 1 && codes === "201,409,409", codes + " users=" + n);
  }
  // per-IP login limit: rotating e-mail names cannot bypass lockout or flood the audit log
  let blocked = 0; for (let i = 0; i < 40; i++) { rr = await call("POST", "/api/auth/login", { body: { email: `nobody${i}@example.com`, password: "wrong password" } }); if (rr.status === 429) blocked++; }
  t("[audit] per-IP limit blocks rotating-email guessing (429 after 30)", blocked >= 8, "blocked=" + blocked);
  const fails = (await SQLQ("SELECT COUNT(*) AS n FROM audit_log WHERE action='login_failed'"))[0].n;
  t("[audit] failed-login audit rows are bounded under flooding", fails <= 45, "rows=" + fails);
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
