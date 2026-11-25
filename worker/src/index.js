// SIMTA Cards API (Cloudflare Worker + D1). STAGING code, not deployed.
// Auth: password (PBKDF2-SHA256) -> random bearer session token, stored only as a SHA-256 hash in D1.
// Roles: admin (everything + users), editor (employees), viewer (read-only admin).

const PBKDF2_ITER = 100000; // Workers cap
const SESSION_HOURS = 8;
const MAX_JSON = 16 * 1024;
const MAX_PHOTO = 300 * 1024;
const ID_RE = /^SMT-\d{3,6}$/;
const EMAIL_RE = /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[A-Za-z]{2,}$/;

const FIELDS = {
  // key: [max length, required]
  name_ar: [120, true], name_en: [120, true],
  title_ar: [120, true], title_en: [120, true],
  department: [60, false], dept_ar: [120, false], dept_en: [120, false],
  phone: [20, true], whatsapp: [20, false], email: [254, false],
  location_ar: [160, false], location_en: [160, false],
};
const PUBLIC_COLS = "id,name_ar,name_en,title_ar,title_en,dept_ar,dept_en,phone,whatsapp,email,location_ar,location_en,photo_version";

class HttpError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}

// ---------- helpers ----------
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));
const nowIso = () => new Date().toISOString();
async function sha256Hex(s) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
function timingSafeEqual(a, b) {
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}
async function hashPassword(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations }, key, 256);
  return hex(bits);
}
function randomHex(n) { return hex(crypto.getRandomValues(new Uint8Array(n))); }
function checkPassword(p) {
  if (typeof p !== "string" || p.length < 12 || p.length > 200) throw new HttpError(400, "weak_password", "Password must be 12 to 200 characters");
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const h = { "Vary": "Origin" };
  if (origin && allowed.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS";
    h["Access-Control-Allow-Headers"] = "Authorization,Content-Type";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra },
  });
}
async function readJson(request) {
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.toLowerCase().startsWith("application/json")) throw new HttpError(415, "unsupported_media_type", "Content-Type must be application/json");
  const text = await request.text();
  if (text.length > MAX_JSON) throw new HttpError(413, "too_large", "Request body too large");
  try { const v = JSON.parse(text); if (!v || typeof v !== "object" || Array.isArray(v)) throw 0; return v; }
  catch { throw new HttpError(400, "bad_json", "Body must be a JSON object"); }
}

// ---------- validation ----------
function cleanStr(v) { return String(v).normalize("NFC").replace(/[\u0000-\u001f\u007f<>]/g, "").trim(); }
function normalizeId(id) { return String(id || "").trim().toUpperCase(); }
export function validateEmployee(input, { partial = false } = {}) {
  const out = {}; const errors = {};
  for (const [k, [max, req]] of Object.entries(FIELDS)) {
    if (!(k in input)) { if (!partial && req) errors[k] = "required"; continue; }
    if (input[k] === null || input[k] === undefined) input[k] = "";
    if (typeof input[k] !== "string" && typeof input[k] !== "number") { errors[k] = "must be text"; continue; }
    let v = cleanStr(input[k]);
    if (k === "phone" || k === "whatsapp") v = v.replace(/[\s\-()]/g, "");
    if (req && !v) { errors[k] = "required"; continue; }
    if (v.length > max) { errors[k] = `max ${max} characters`; continue; }
    if (k === "phone" && v && !/^\+?\d{7,15}$/.test(v)) errors[k] = "invalid phone (digits, optional leading +, 7-15 digits)";
    if (k === "whatsapp" && v && !/^\d{7,15}$/.test(v.replace(/^\+/, ""))) errors[k] = "invalid WhatsApp number";
    if (k === "whatsapp" && v) v = v.replace(/^\+/, "");
    if (k === "email" && v && !EMAIL_RE.test(v)) errors[k] = "invalid email";
    if (k === "department" && v && !/^[a-z0-9_-]{1,60}$/i.test(v)) errors[k] = "letters, digits, - and _ only";
    out[k] = v;
  }
  if ("extra" in input) {
    const x = input.extra;
    if (!x || typeof x !== "object" || Array.isArray(x)) errors.extra = "must be an object";
    else {
      const clean = {};
      for (const [k, v] of Object.entries(x)) {
        if (!/^[a-z][a-z0-9_]{0,39}$/.test(k) || typeof v !== "string" || v.length > 300) { errors.extra = "keys: a-z0-9_, values: text up to 300 chars"; break; }
        clean[k] = cleanStr(v);
      }
      if (Object.keys(clean).length > 20) errors.extra = "max 20 keys";
      out.extra = JSON.stringify(clean);
    }
  }
  if (Object.keys(errors).length) throw new HttpError(422, "validation_failed", "Validation failed", errors);
  return out;
}

// ---------- shapes ----------
function publicEmployee(r, env) {
  const base = String(env.CARD_BASE_URL || "").replace(/\/$/, "");
  // Public card shape: an explicit allowlist. Internal fields (department code, extra, audit/user data, active flag) never appear here.
  return {
    id: r.id, name_ar: r.name_ar, name_en: r.name_en, title_ar: r.title_ar, title_en: r.title_en,
    dept_ar: r.dept_ar, dept_en: r.dept_en,
    phone: r.phone, whatsapp: r.whatsapp, email: r.email, location_ar: r.location_ar, location_en: r.location_en,
    photo_url: r.photo_version ? `/api/photos/${r.id}?v=${r.photo_version}` : null,
    card_url: base ? `${base}?id=${r.id}` : null,
  };
}
function adminOnly(r) {
  let extra = {}; try { extra = JSON.parse(r.extra || "{}"); } catch { /* ignore */ }
  return { department: r.department, extra };
}
function adminEmployee(r, env) {
  return { ...publicEmployee(r, env), ...adminOnly(r), active: !!r.active, created_at: r.created_at, updated_at: r.updated_at, deactivated_at: r.deactivated_at, created_by: r.created_by, updated_by: r.updated_by };
}

// ---------- auth ----------
async function currentUser(request, env) {
  const h = request.headers.get("Authorization") || "";
  const m = /^Bearer ([0-9a-f]{64})$/.exec(h);
  if (!m) throw new HttpError(401, "unauthenticated", "Sign in required");
  const th = await sha256Hex(m[1]);
  const row = await env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role,u.active,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?"
  ).bind(th).first();
  if (!row || !row.active || row.expires_at < nowIso()) throw new HttpError(401, "unauthenticated", "Session expired or invalid");
  return { id: row.id, email: row.email, name: row.name, role: row.role, token_hash: th };
}
const RANK = { viewer: 1, editor: 2, admin: 3 };
function requireRole(user, role) {
  if (RANK[user.role] < RANK[role]) throw new HttpError(403, "forbidden", "Your role does not allow this action");
}
function auditStmt(env, user, request, action, entity, entityId, changes) {
  return env.DB.prepare("INSERT INTO audit_log (ts,user_id,user_email,action,entity,entity_id,changes,ip) VALUES (?,?,?,?,?,?,?,?)")
    .bind(nowIso(), user ? user.id : null, user ? user.email : null, action, entity, entityId || null,
      changes ? JSON.stringify(changes).slice(0, 4000) : null, request.headers.get("CF-Connecting-IP") || null);
}
async function audit(...a) { await auditStmt(...a).run(); }
// Run the data change and its audit row in ONE D1 batch (a transaction): either both are stored or neither.
async function commit(env, ...stmts) { return env.DB.batch(stmts); }
async function createUser(env, { email, name, role, password, onlyIfEmpty }) {
  checkPassword(password);
  email = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(422, "validation_failed", "Validation failed", { email: "invalid email" });
  if (!RANK[role]) throw new HttpError(422, "validation_failed", "Validation failed", { role: "admin, editor or viewer" });
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt, PBKDF2_ITER);
  try {
    // onlyIfEmpty (first-run setup): one atomic statement, so two concurrent setups cannot both create an admin.
    const r = await env.DB.prepare(`INSERT INTO users (email,name,role,salt,pass_hash,iterations,active,created_at) ${onlyIfEmpty ? "SELECT ?,?,?,?,?,?,1,? WHERE NOT EXISTS (SELECT 1 FROM users)" : "VALUES (?,?,?,?,?,?,1,?)"}`)
      .bind(email, cleanStr(name || "").slice(0, 100), role, salt, hash, PBKDF2_ITER, nowIso()).run();
    if (onlyIfEmpty && !r.meta.changes) throw new HttpError(409, "already_setup", "Setup already completed");
    return { id: r.meta.last_row_id, email, role };
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) throw new HttpError(409, "exists", "A user with this email already exists");
    throw e;
  }
}
async function login(request, env) {
  const body = await readJson(request);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `${email.slice(0, 254)}|${ip}`;
  const ipKey = `ip|${ip}`; // per-IP cap too, so rotating e-mail names cannot bypass the limit or flood the audit log
  const since = Date.now() - 15 * 60 * 1000;
  const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE key=? AND ts>?").bind(key, since).first();
  const ci = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE key=? AND ts>?").bind(ipKey, since).first();
  if (c.n >= 5 || ci.n >= 30) throw new HttpError(429, "too_many_attempts", "Too many failed attempts. Try again in 15 minutes.");
  const u = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  // Always run the hash so response time does not reveal whether the user exists.
  const salt = u ? u.salt : "00".repeat(16);
  const h = await hashPassword(password, salt, u ? u.iterations : PBKDF2_ITER);
  if (!u || !u.active || !timingSafeEqual(h, u.pass_hash)) {
    await commit(env, env.DB.prepare("INSERT INTO login_attempts (key,ts) VALUES (?,?)").bind(key, Date.now()), env.DB.prepare("INSERT INTO login_attempts (key,ts) VALUES (?,?)").bind(ipKey, Date.now()),
      auditStmt(env, null, request, "login_failed", "user", email.slice(0, 100), null));
    await env.DB.prepare("DELETE FROM login_attempts WHERE ts<?").bind(since).run(); // keep the table small
    throw new HttpError(401, "invalid_credentials", "Invalid email or password");
  }
  await env.DB.prepare("DELETE FROM login_attempts WHERE key=?").bind(key).run();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(nowIso()).run();
  const token = randomHex(32);
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)").bind(await sha256Hex(token), u.id, nowIso(), expires).run();
  await audit(env, { id: u.id, email: u.email }, request, "login", "user", String(u.id), null);
  return { token, expires_at: expires, user: { id: u.id, email: u.email, name: u.name, role: u.role } };
}

// ---------- routes ----------
async function getEmployee(env, id) {
  return env.DB.prepare(`SELECT * FROM employees WHERE id=?`).bind(id).first();
}
function diff(before, after) {
  const c = {};
  for (const k of Object.keys(after)) if (String(before[k] ?? "") !== String(after[k] ?? "")) c[k] = { from: before[k] ?? null, to: after[k] };
  return c;
}
function safeDecode(s) { try { return decodeURIComponent(s); } catch { throw new HttpError(400, "bad_id", "Invalid employee ID"); } }
function esc(s) { return s.replace(/[\\%_]/g, (m) => "\\" + m); }

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;
  let m;

  if ((path === "/health" || path === "/api/health") && method === "GET") {
    let db = "unbound";
    if (env.DB) { try { await env.DB.prepare("SELECT 1").first(); db = "bound"; } catch { db = "error"; } }
    return json({ ok: true, service: "SIMTA Cards API", mode: env.ENVIRONMENT || "staging", database: db });
  }

  // ---- public ----
  if (path === "/api/employees" && method === "GET") {
    await currentUser(request, env); // directory/search needs a session (viewer or above); single cards below stay public by ID
    const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
    let sql = `SELECT ${PUBLIC_COLS} FROM employees WHERE active=1`; const binds = [];
    if (q) {
      const like = `%${esc(q)}%`;
      sql += " AND (id LIKE ? ESCAPE '\\' OR name_ar LIKE ? ESCAPE '\\' OR name_en LIKE ? ESCAPE '\\' OR title_ar LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\' OR dept_ar LIKE ? ESCAPE '\\' OR dept_en LIKE ? ESCAPE '\\' OR department LIKE ? ESCAPE '\\')";
      binds.push(like, like, like, like, like, like, like, like);
    }
    const lim = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1), 200);
    const off = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
    const tot = await env.DB.prepare(sql.replace(`SELECT ${PUBLIC_COLS} FROM`, "SELECT COUNT(*) AS n FROM")).bind(...binds).first();
    const { results } = await env.DB.prepare(sql + " ORDER BY id LIMIT ? OFFSET ?").bind(...binds, lim, off).all();
    return json(results.map((r) => publicEmployee(r, env)), 200, { "X-Total-Count": String(tot.n) }); // bare array; total in header
  }
  if ((m = path.match(/^\/api\/employees\/([^/]+)$/)) && method === "GET") {
    const id = normalizeId(safeDecode(m[1]));
    if (!ID_RE.test(id)) throw new HttpError(400, "bad_id", "Invalid employee ID");
    const r = await env.DB.prepare(`SELECT ${PUBLIC_COLS} FROM employees WHERE id=? AND active=1`).bind(id).first();
    if (!r) throw new HttpError(404, "not_found", "Employee not found"); // inactive looks the same as missing
    return json(publicEmployee(r, env), 200); // bare object
  }
  if ((m = path.match(/^\/api\/photos\/([^/]+)$/)) && method === "GET") {
    const id = normalizeId(safeDecode(m[1]));
    if (!ID_RE.test(id)) throw new HttpError(400, "bad_id", "Invalid employee ID");
    const p = await env.DB.prepare("SELECT p.mime,p.data_b64 FROM employee_photos p JOIN employees e ON e.id=p.employee_id WHERE p.employee_id=? AND e.active=1").bind(id).first();
    if (!p) throw new HttpError(404, "not_found", "No photo");
    const bin = Uint8Array.from(atob(p.data_b64), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { "Content-Type": p.mime, "Cache-Control": "private, no-cache, must-revalidate", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Cross-Origin-Resource-Policy": "cross-origin" } });
  }

  // ---- first-run setup ----
  if (path === "/api/setup" && method === "POST") {
    if (!env.SETUP_TOKEN) throw new HttpError(404, "not_found", "Not found");
    const body = await readJson(request);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
    if (n.n > 0) throw new HttpError(409, "already_setup", "Setup already completed");
    if (!timingSafeEqual(String(body.setup_token || ""), env.SETUP_TOKEN)) throw new HttpError(403, "forbidden", "Invalid setup token");
    const u = await createUser(env, { email: body.email, name: body.name, role: "admin", password: body.password, onlyIfEmpty: true });
    await audit(env, { id: u.id, email: u.email }, request, "setup_admin", "user", String(u.id), null);
    return json({ ok: true, user: u }, 201);
  }
  if (path === "/api/auth/login" && method === "POST") return json(await login(request, env));

  // ---- authenticated ----
  if (path.startsWith("/api/auth/") || path.startsWith("/api/admin/")) {
    const user = await currentUser(request, env);
    request._u = user; // lets the top-level handler audit a role denial

    if (path === "/api/auth/me" && method === "GET") return json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    if (path === "/api/auth/logout" && method === "POST") {
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(user.token_hash).run();
      await audit(env, user, request, "logout", "user", String(user.id), null);
      return json({ ok: true });
    }

    if (path === "/api/admin/stats" && method === "GET") {
      const t = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(active) AS active, SUM(CASE WHEN photo_version>0 THEN 1 ELSE 0 END) AS with_photo FROM employees").first();
      const { results: depts } = await env.DB.prepare("SELECT department, dept_ar, dept_en, COUNT(*) AS n FROM employees WHERE active=1 GROUP BY department, dept_ar, dept_en ORDER BY n DESC").all();
      const { results: recent } = await env.DB.prepare("SELECT id,name_ar,name_en,updated_at,active FROM employees ORDER BY updated_at DESC LIMIT 5").all();
      return json({ total: t.total || 0, active: t.active || 0, inactive: (t.total || 0) - (t.active || 0), with_photo: t.with_photo || 0, departments: depts, recent });
    }

    if (path === "/api/admin/employees" && method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
      const status = url.searchParams.get("status") || "all";
      const dept = (url.searchParams.get("department") || "").slice(0, 60);
      const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 200);
      const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
      const SORTS = { id: "id", name_ar: "name_ar", name_en: "name_en", title_ar: "title_ar", title_en: "title_en", dept_ar: "dept_ar", dept_en: "dept_en", updated: "updated_at", created: "created_at" };
      const sortKey = url.searchParams.get("sort") || "id";
      if (!SORTS[sortKey]) throw new HttpError(400, "bad_sort", "sort must be one of: " + Object.keys(SORTS).join(", "));
      const dirParam = (url.searchParams.get("dir") || "asc").toLowerCase();
      if (dirParam !== "asc" && dirParam !== "desc") throw new HttpError(400, "bad_dir", "dir must be asc or desc");
      const orderBy = `${SORTS[sortKey]} COLLATE NOCASE ${dirParam.toUpperCase()}, id ASC`; // allowlisted column names only, never user text
      const where = []; const binds = [];
      if (status === "active") where.push("active=1"); else if (status === "inactive") where.push("active=0");
      else if (status !== "all") throw new HttpError(400, "bad_status", "status must be all, active or inactive");
      if (dept) { where.push("department=?"); binds.push(dept); }
      if (q) {
        const like = `%${esc(q)}%`;
        where.push("(id LIKE ? ESCAPE '\\' OR name_ar LIKE ? ESCAPE '\\' OR name_en LIKE ? ESCAPE '\\' OR title_ar LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\' OR dept_ar LIKE ? ESCAPE '\\' OR dept_en LIKE ? ESCAPE '\\' OR department LIKE ? ESCAPE '\\')");
        binds.push(like, like, like, like, like, like, like, like);
      }
      const w = where.length ? " WHERE " + where.join(" AND ") : "";
      const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM employees" + w).bind(...binds).first();
      const { results } = await env.DB.prepare(`SELECT * FROM employees${w} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(...binds, limit, offset).all();
      return json({ total: total.n, employees: results.map((r) => adminEmployee(r, env)) });
    }
    if (path === "/api/admin/employees" && method === "POST") {
      requireRole(user, "editor");
      const body = await readJson(request);
      const id = normalizeId(body.id);
      if (!ID_RE.test(id)) throw new HttpError(422, "validation_failed", "Validation failed", { id: "format SMT-001 (SMT- followed by 3 to 6 digits)" });
      const v = validateEmployee(body);
      const ts = nowIso();
      try {
        await commit(env, env.DB.prepare(`INSERT INTO employees (id,name_ar,name_en,title_ar,title_en,department,dept_ar,dept_en,phone,whatsapp,email,location_ar,location_en,photo_version,active,extra,created_at,updated_at,created_by,updated_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?,?,?,?,?)`)
          .bind(id, v.name_ar, v.name_en, v.title_ar, v.title_en, v.department || "", v.dept_ar || "", v.dept_en || "", v.phone, v.whatsapp || "", v.email || "", v.location_ar || "", v.location_en || "", v.extra || "{}", ts, ts, user.email, user.email),
          auditStmt(env, user, request, "create", "employee", id, v));
      } catch (e) {
        if (/UNIQUE|PRIMARY/i.test(String(e.message))) throw new HttpError(409, "exists", "An employee with this ID already exists");
        throw e;
      }
      return json({ employee: adminEmployee(await getEmployee(env, id), env) }, 201);
    }
    if ((m = path.match(/^\/api\/admin\/employees\/([^/]+)(\/(deactivate|reactivate|photo))?$/))) {
      const id = normalizeId(safeDecode(m[1]));
      if (!ID_RE.test(id)) throw new HttpError(400, "bad_id", "Invalid employee ID");
      const sub = m[3];
      const cur = await getEmployee(env, id);
      if (!cur) throw new HttpError(404, "not_found", "Employee not found");

      if (!sub && method === "GET") return json({ employee: adminEmployee(cur, env) });
      if (!sub && method === "PUT") {
        requireRole(user, "editor");
        const body = await readJson(request);
        if ("id" in body && normalizeId(body.id) !== id) throw new HttpError(422, "validation_failed", "Validation failed", { id: "ID cannot be changed" });
        if ("active" in body) throw new HttpError(422, "validation_failed", "Validation failed", { active: "use the deactivate/reactivate endpoints" });
        const v = validateEmployee(body, { partial: true });
        const c = diff(cur, v);
        if (!Object.keys(c).length) return json({ employee: adminEmployee(cur, env) });
        const keys = Object.keys(v);
        await commit(env, env.DB.prepare(`UPDATE employees SET ${keys.map((k) => k + "=?").join(",")}, updated_at=?, updated_by=? WHERE id=?`)
          .bind(...keys.map((k) => v[k]), nowIso(), user.email, id), auditStmt(env, user, request, "update", "employee", id, c));
        return json({ employee: adminEmployee(await getEmployee(env, id), env) });
      }
      if ((sub === "deactivate" || sub === "reactivate") && method === "POST") {
        requireRole(user, "editor");
        const on = sub === "reactivate" ? 1 : 0;
        if (cur.active !== on) {
          await commit(env, env.DB.prepare("UPDATE employees SET active=?, deactivated_at=?, updated_at=?, updated_by=? WHERE id=?").bind(on, on ? null : nowIso(), nowIso(), user.email, id),
            auditStmt(env, user, request, sub, "employee", id, null));
        }
        return json({ employee: adminEmployee(await getEmployee(env, id), env) });
      }
      if (sub === "photo" && method === "PUT") {
        requireRole(user, "editor");
        const mime = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
        if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new HttpError(415, "unsupported_media_type", "Photo must be JPEG, PNG or WebP");
        const buf = new Uint8Array(await request.arrayBuffer());
        if (!buf.length || buf.length > MAX_PHOTO) throw new HttpError(413, "too_large", `Photo must be 1 byte to ${MAX_PHOTO / 1024} KB`);
        const magic = (mime === "image/jpeg" && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
          (mime === "image/png" && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ||
          (mime === "image/webp" && String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP");
        if (!magic) throw new HttpError(415, "bad_image", "File content does not match its type");
        let bin = ""; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
        const ts = nowIso();
        await commit(env,
          env.DB.prepare("INSERT INTO employee_photos (employee_id,mime,data_b64,updated_at) VALUES (?,?,?,?) ON CONFLICT(employee_id) DO UPDATE SET mime=excluded.mime,data_b64=excluded.data_b64,updated_at=excluded.updated_at").bind(id, mime, btoa(bin), ts),
          env.DB.prepare("UPDATE employees SET photo_version=photo_version+1, updated_at=?, updated_by=? WHERE id=?").bind(ts, user.email, id),
          auditStmt(env, user, request, "photo_set", "employee", id, { bytes: buf.length, mime }));
        return json({ employee: adminEmployee(await getEmployee(env, id), env) });
      }
      if (sub === "photo" && method === "DELETE") {
        requireRole(user, "editor");
        await commit(env, env.DB.prepare("DELETE FROM employee_photos WHERE employee_id=?").bind(id),
          env.DB.prepare("UPDATE employees SET photo_version=0, updated_at=?, updated_by=? WHERE id=?").bind(nowIso(), user.email, id),
          auditStmt(env, user, request, "photo_remove", "employee", id, null));
        return json({ employee: adminEmployee(await getEmployee(env, id), env) });
      }
      throw new HttpError(405, "method_not_allowed", "Method not allowed");
    }

    if (path === "/api/admin/audit" && method === "GET") {
      requireRole(user, "admin");
      const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 200);
      const { results } = await env.DB.prepare("SELECT id,ts,user_email,action,entity,entity_id,changes FROM audit_log ORDER BY id DESC LIMIT ?").bind(limit).all();
      return json({ entries: results });
    }
    if (path === "/api/admin/users" && method === "GET") {
      requireRole(user, "admin");
      const { results } = await env.DB.prepare("SELECT id,email,name,role,active,created_at FROM users ORDER BY id").all();
      return json({ users: results });
    }
    if (path === "/api/admin/users" && method === "POST") {
      requireRole(user, "admin");
      const b = await readJson(request);
      const u = await createUser(env, b);
      await audit(env, user, request, "user_create", "user", String(u.id), { email: u.email, role: u.role });
      return json({ user: u }, 201);
    }
    if ((m = path.match(/^\/api\/admin\/users\/(\d+)$/)) && method === "PUT") {
      requireRole(user, "admin");
      const uid = Number(m[1]); const b = await readJson(request);
      if ("active" in b && typeof b.active !== "boolean") throw new HttpError(422, "validation_failed", "Validation failed", { active: "must be true or false" });
      if (uid === user.id && (b.active === false || (b.role && b.role !== "admin"))) throw new HttpError(422, "validation_failed", "You cannot demote or disable yourself");
      const target = await env.DB.prepare("SELECT id,role,active FROM users WHERE id=?").bind(uid).first();
      if (!target) throw new HttpError(404, "not_found", "User not found");
      if (target.role === "admin" && target.active && (b.active === false || ("role" in b && b.role !== "admin"))) {
        const o = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1 AND id<>?").bind(uid).first();
        if (!o.n) throw new HttpError(422, "validation_failed", "At least one active admin must remain");
      }
      const sets = []; const binds = [];
      if ("role" in b) { if (!RANK[b.role]) throw new HttpError(422, "validation_failed", "Validation failed", { role: "admin, editor or viewer" }); sets.push("role=?"); binds.push(b.role); }
      if ("active" in b) { sets.push("active=?"); binds.push(b.active ? 1 : 0); }
      if ("password" in b) { checkPassword(b.password); const salt = randomHex(16); sets.push("salt=?", "pass_hash=?", "iterations=?"); binds.push(salt, await hashPassword(b.password, salt, PBKDF2_ITER), PBKDF2_ITER); }
      if (!sets.length) throw new HttpError(400, "nothing_to_update", "Nothing to update");
      const ops = [env.DB.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).bind(...binds, uid)];
      if ("password" in b || "role" in b || b.active === false) ops.push(env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(uid)); // role change also ends old sessions
      ops.push(auditStmt(env, user, request, "user_update", "user", String(uid), { fields: Object.keys(b).filter((k) => k !== "password"), password_changed: "password" in b }));
      await commit(env, ...ops);
      return json({ ok: true });
    }
    throw new HttpError(404, "not_found", "Not found");
  }
  throw new HttpError(404, "not_found", "Not found");
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: cors["Access-Control-Allow-Origin"] ? 204 : 403, headers: cors });
    let res;
    try {
      if (!env.DB) throw new HttpError(503, "no_database", "Database binding is missing");
      res = await route(request, env);
    } catch (e) {
      if (e instanceof HttpError && e.code === "forbidden" && request._u) {
        // Audit role denials of a signed-in user: method+path only (no body, no secrets); max 20 per user per 15 min so it cannot grow unbounded.
        try {
          const u = request._u, since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
          const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE user_id=? AND action='denied' AND ts>?").bind(u.id, since).first();
          if (c.n < 20) await audit(env, u, request, "denied", "request", new URL(request.url).pathname.slice(0, 120), { method: request.method, role: u.role });
        } catch {}
      }
      if (e instanceof HttpError) res = json({ error: e.message, code: e.code, ...(e.details ? { details: e.details } : {}) }, e.status);
      else { console.error("unhandled", e && e.message); res = json({ error: "Internal error", code: "internal" }, 500); }
    }
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) h.set(k, v);
    return new Response(res.body, { status: res.status, headers: h });
  },
};
