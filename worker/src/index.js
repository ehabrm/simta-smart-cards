// SIMTA Cards API (Cloudflare Worker + D1). Production code (deployed as simta-cards-prod).
// Auth: password (PBKDF2-SHA256) -> random bearer session token, stored only as a SHA-256 hash in D1.
// Roles: admin (everything + users), editor (employees), viewer (read-only admin).

const PBKDF2_ITER = 100000; // Workers cap
const SESSION_HOURS = 8;
const REMEMBER_DAYS = 30, REMEMBER_ABS_DAYS = 90, ROTATE_GRACE_MS = 30000; // remembered device: slides 30 days from last use, hard cap 90 days from the full sign-in
const MAX_JSON = 16 * 1024;
const MAX_PHOTO = 300 * 1024;
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
  constructor(status, code, message, details, headers) { super(message); this.status = status; this.code = code; this.details = details; this.headers = headers; }
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

// ---------- rate limiting (no database writes) ----------
// Two layers. (1) If a Workers Rate Limiting binding named RL_<BUCKET> exists it is used (per Cloudflare location, approximate).
// (2) A small in-memory fixed window per Worker instance, always on. Neither writes to D1, so a flood cannot grow the database.
// Limits are per client IP per minute and are chosen for normal use: one card view is 1-2 requests.
const RATE_DEFAULTS = { card: 60, auth: 20, api: 300, health: 30 };
const RATE_MEM = new Map();
async function rateLimit(request, env, bucket) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const max = Number(env["RATE_" + bucket.toUpperCase() + "_PER_MIN"]) || RATE_DEFAULTS[bucket];
  const bound = env["RL_" + bucket.toUpperCase()];
  let ok = true;
  if (bound && typeof bound.limit === "function") { try { ok = (await bound.limit({ key: `${bucket}|${ip}` })).success; } catch { ok = true; } }
  const win = Math.floor(Date.now() / 60000), k = `${bucket}|${ip}`;
  const e = RATE_MEM.get(k);
  const n = e && e.win === win ? e.n + 1 : 1;
  RATE_MEM.set(k, { win, n });
  if (RATE_MEM.size > 5000) for (const [kk, v] of RATE_MEM) if (v.win !== win) RATE_MEM.delete(kk);
  if (!ok || n > max) throw new HttpError(429, "rate_limited", "Too many requests. Please slow down and try again in a minute.", undefined, { "Retry-After": "60" });
}

// ---------- two-factor (TOTP, RFC 6238: HMAC-SHA1, 6 digits, 30 s) ----------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32encode(bytes) { let bits = 0, v = 0, out = ""; for (const b of bytes) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(v << (5 - bits)) & 31]; return out; }
function b32decode(str) { let bits = 0, v = 0; const out = []; for (const c of str.replace(/=+$/, "").toUpperCase()) { const i = B32.indexOf(c); if (i < 0) continue; v = (v << 5) | i; bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); }
async function hotp(secretBytes, counter) {
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new Uint8Array(8); new DataView(msg.buffer).setUint32(4, counter >>> 0); new DataView(msg.buffer).setUint32(0, Math.floor(counter / 4294967296));
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, "0");
}
export async function totpCode(secretB32, atMs = Date.now()) { return hotp(b32decode(secretB32), Math.floor(atMs / 30000)); }
// Returns the accepted step (> lastStep) or 0. Window: previous, current, next step (clock drift).
async function totpVerify(secretB32, code, lastStep, atMs = Date.now()) {
  code = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return 0;
  const sb = b32decode(secretB32), cur = Math.floor(atMs / 30000);
  let hit = 0;
  for (const st of [cur - 1, cur, cur + 1]) { if (timingSafeEqual(await hotp(sb, st), code) && st > lastStep) hit = st; }
  return hit;
}
async function totpKey(env) {
  if (!env.TOTP_KEY || String(env.TOTP_KEY).length < 16) throw new HttpError(503, "two_factor_unavailable", "Two-factor sign-in is not configured on this server");
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", enc.encode("simta-totp|" + env.TOTP_KEY)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function sealSecret(env, plain, uid) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode("simta-totp-user|" + uid) }, await totpKey(env), enc.encode(plain)); return hex(iv) + ":" + hex(ct); }
async function openSecret(env, sealed, uid) { const [iv, ct] = String(sealed).split(":"); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unhex(iv), additionalData: enc.encode("simta-totp-user|" + uid) }, await totpKey(env), unhex(ct))); }

// Phone numbers and e-mail addresses are not copied into the audit log (the data itself lives in the employees table).
const PII_KEYS = new Set(["phone", "whatsapp", "email"]);
function redactChanges(c) {
  if (!c || typeof c !== "object") return c;
  const mark = (v) => (v === null || v === undefined || v === "" ? "(empty)" : "(set)");
  const out = {};
  for (const [k, v] of Object.entries(c)) {
    if (!PII_KEYS.has(k)) out[k] = v;
    else if (v && typeof v === "object" && ("from" in v || "to" in v)) out[k] = { from: mark(v.from), to: mark(v.to) };
    else out[k] = mark(v);
  }
  return out;
}

// ---------- companies ----------
// Every employee, user membership, audit row, counter and setting belongs to one company. A company is resolved from the URL
// (/api/c/<slug>/...) or, for the legacy SIMTA routes (/api/...), is SIMTA (id 1). Rows are cached per Worker instance for 30 s.
let CO_CACHE = { at: 0, rows: [] };
async function companies(env, fresh = false) {
  if (!fresh && Date.now() - CO_CACHE.at < 30000 && CO_CACHE.rows.length) return CO_CACHE.rows;
  const { results } = await env.DB.prepare("SELECT * FROM companies ORDER BY id").all();
  CO_CACHE = { at: Date.now(), rows: results };
  return results;
}
const idRe = (co) => new RegExp(`^${co.prefix}-\\d{3,6}$`);
const ANY_ID_RE = /^[A-Z]{3}-\d{3,6}$/;
const SLUG_RE = /^[a-z][a-z0-9-]{1,29}$/;
const ORIGIN_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;

async function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const h = { "Vary": "Origin" };
  if (origin) {
    let ok = allowed.includes(origin);
    if (!ok && env.DB) { try { ok = (await companies(env)).some((c) => c.active && String(c.allowed_origins || "").split(",").map((s) => s.trim()).includes(origin)); } catch { ok = false; } }
    if (ok) {
      h["Access-Control-Allow-Origin"] = origin;
      h["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS";
      h["Access-Control-Allow-Headers"] = "Authorization,Content-Type";
      h["Access-Control-Max-Age"] = "600";
    }
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
function cardUrlFor(co, env, id) {
  const fromCo = co && co.card_base_url;
  const base = fromCo ? String(co.card_base_url) : (co && co.id === 1 ? String(env.CARD_BASE_URL || "").replace(/\/$/, "") : "");
  return base ? `${base}?id=${id}` : null;
}
function photoUrlFor(co, r) {
  if (!r.photo_version) return null;
  return co.id === 1 ? `/api/photos/${r.id}?v=${r.photo_version}` : `/api/c/${co.slug}/photos/${r.id}?v=${r.photo_version}`; // SIMTA keeps its original photo URL shape
}
function publicEmployee(r, env, co) {
  // Public card shape: an explicit allowlist. Internal fields (department code, extra, audit/user data, active flag, company id) never appear here.
  return {
    id: r.id, name_ar: r.name_ar, name_en: r.name_en, title_ar: r.title_ar, title_en: r.title_en,
    dept_ar: r.dept_ar, dept_en: r.dept_en,
    phone: r.phone, whatsapp: r.whatsapp, email: r.email, location_ar: r.location_ar, location_en: r.location_en,
    photo_url: photoUrlFor(co, r),
    card_url: cardUrlFor(co, env, r.id),
  };
}
function adminOnly(r) {
  let extra = {}; try { extra = JSON.parse(r.extra || "{}"); } catch { /* ignore */ }
  return { department: r.department, extra };
}
function adminEmployee(r, env, co) {
  return { ...publicEmployee(r, env, co), ...adminOnly(r), active: !!r.active, created_at: r.created_at, updated_at: r.updated_at, deactivated_at: r.deactivated_at, created_by: r.created_by, updated_by: r.updated_by };
}

// ---------- auth ----------
async function currentUser(request, env) {
  const h = request.headers.get("Authorization") || "";
  const m = /^Bearer ([0-9a-f]{64})$/.exec(h);
  if (!m) throw new HttpError(401, "unauthenticated", "Sign in required");
  const th = await sha256Hex(m[1]);
  const row = await env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role,u.active,u.totp_enabled,u.is_super,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?"
  ).bind(th).first();
  if (!row || !row.active || row.expires_at < nowIso()) throw new HttpError(401, "unauthenticated", "Session expired or invalid");
  const { results } = await env.DB.prepare("SELECT uc.company_id,uc.role FROM user_companies uc JOIN companies c ON c.id=uc.company_id WHERE uc.user_id=? AND uc.active=1 AND c.active=1").bind(row.id).all();
  const member = new Map(results.map((r) => [r.company_id, r.role]));
  if (!row.is_super && !member.size) throw new HttpError(401, "unauthenticated", "Session expired or invalid"); // no company access left
  return { id: row.id, email: row.email, name: row.name, legacy_role: row.role, is_super: !!row.is_super, member, two_factor: !!row.totp_enabled, token_hash: th };
}
const RANK = { viewer: 1, editor: 2, admin: 3 };
// Effective role of a user inside ONE company: platform owners are admin everywhere, everybody else only where they hold an active membership.
function roleIn(user, co) { return user.is_super ? "admin" : (user.member.get(co.id) || null); }
function requireRole(user, co, role) {
  const r = roleIn(user, co);
  if (!r || RANK[r] < RANK[role]) throw new HttpError(403, "forbidden", "Your role does not allow this action");
}
function requireSuper(user) { if (!user.is_super) throw new HttpError(403, "forbidden", "Your role does not allow this action"); }
async function userView(env, user) {
  const all = await companies(env);
  const cs = all.filter((c) => c.active && (user.is_super || user.member.has(c.id))).map((c) => ({ id: c.id, slug: c.slug, prefix: c.prefix, name_ar: c.name_ar, name_en: c.name_en, role: roleIn(user, c), card_base_url: c.card_base_url || "" }));
  const def = cs.find((c) => c.slug === "simta") || cs[0];
  return { id: user.id, email: user.email, name: user.name, role: def ? def.role : user.legacy_role, two_factor: user.two_factor, platform_admin: user.is_super, companies: cs };
}
function auditStmt(env, user, request, action, entity, entityId, changes, companyId = null) {
  return env.DB.prepare("INSERT INTO audit_log (ts,user_id,user_email,action,entity,entity_id,changes,ip,company_id) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(nowIso(), user ? user.id : null, user ? user.email : null, action, entity, entityId || null,
      changes ? JSON.stringify(redactChanges(changes)).slice(0, 4000) : null, request.headers.get("CF-Connecting-IP") || null, companyId ?? null);
}
async function audit(...a) { await auditStmt(...a).run(); }
// A user-level event (sign-in, 2FA) is recorded once per company the user belongs to, so each company's audit shows its own users' events and nobody else's.
async function auditUserEvent(env, uid, user, request, action, entity, entityId, changes) {
  let ids = [];
  if (uid) { const { results } = await env.DB.prepare("SELECT company_id FROM user_companies WHERE user_id=? AND active=1").bind(uid).all(); ids = results.map((r) => r.company_id); }
  if (!ids.length) ids = [null];
  await commit(env, ...ids.map((cid) => auditStmt(env, user, request, action, entity, entityId, changes, cid)));
}
// Run the data change and its audit row in ONE D1 batch (a transaction): either both are stored or neither.
// Wrong-code cap for the signed-in 2FA enable/disable steps (5 per user per 15 minutes, stored in D1 like the login lockout).
async function twoFaGuard(env, user) {
  const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE key=? AND ts>?").bind("2fa|" + user.id, Date.now() - 15 * 60 * 1000).first();
  if (c.n >= 5) throw new HttpError(429, "too_many_attempts", "Too many wrong codes. Try again in 15 minutes.");
}
async function twoFaFail(env, user, status, code, msg) {
  await env.DB.prepare("INSERT INTO login_attempts (key,ts) VALUES (?,?)").bind("2fa|" + user.id, Date.now()).run();
  throw new HttpError(status, code, msg);
}
async function commit(env, ...stmts) { return env.DB.batch(stmts); }
// Creates a login. Memberships: [{company_id, role}]. First-run setup (onlyIfEmpty) creates the platform owner with SIMTA admin membership.
async function createUser(env, { email, name, role, password, onlyIfEmpty, memberships, isSuper }) {
  checkPassword(password);
  email = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(422, "validation_failed", "Validation failed", { email: "invalid email" });
  const ms = memberships || [];
  if (!ms.length && !isSuper) throw new HttpError(422, "validation_failed", "Validation failed", { memberships: "at least one company" });
  for (const m of ms) if (!RANK[m.role]) throw new HttpError(422, "validation_failed", "Validation failed", { role: "admin, editor or viewer" });
  const legacyRole = ms.length ? ms.reduce((a, m) => (RANK[m.role] > RANK[a] ? m.role : a), "viewer") : "viewer";
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt, PBKDF2_ITER);
  const ts = nowIso();
  try {
    // onlyIfEmpty (first-run setup): one atomic statement, so two concurrent setups cannot both create an admin.
    const r = await env.DB.prepare(`INSERT INTO users (email,name,role,salt,pass_hash,iterations,active,created_at,is_super) ${onlyIfEmpty ? "SELECT ?,?,?,?,?,?,1,?,? WHERE NOT EXISTS (SELECT 1 FROM users)" : "VALUES (?,?,?,?,?,?,1,?,?)"}`)
      .bind(email, cleanStr(name || "").slice(0, 100), legacyRole, salt, hash, PBKDF2_ITER, ts, isSuper ? 1 : 0).run();
    if (onlyIfEmpty && !r.meta.changes) throw new HttpError(409, "already_setup", "Setup already completed");
    const uid = r.meta.last_row_id;
    try { await commit(env, ...ms.map((m) => env.DB.prepare("INSERT INTO user_companies (user_id,company_id,role,active,created_at) VALUES (?,?,?,1,?)").bind(uid, m.company_id, m.role, ts))); }
    catch (e) { await env.DB.prepare("DELETE FROM users WHERE id=?").bind(uid).run(); throw e; } // never leave a login without its memberships
    return { id: uid, email, role: legacyRole };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (/UNIQUE/i.test(String(e.message))) throw new HttpError(409, "exists", "A user with this email already exists");
    throw e;
  }
}
// Reserve one login attempt for the account+IP key and the IP key in ONE statement: the limit check and the insert cannot be split by a
// concurrent request, so a burst cannot get past 5 per account+IP or 30 per IP. A reserved attempt stays counted (failure, missing 2FA code,
// replay) and is removed again only when the sign-in fully succeeds. Returns the rowid of the IP-key row (inserted last), the exact identity of this reservation.
async function reserveAttempt(env, key, ipKey, since) {
  const ts = Date.now();
  const r = await env.DB.prepare("INSERT INTO login_attempts (key,ts) SELECT k,? FROM (SELECT ? AS k UNION ALL SELECT ?) WHERE (SELECT COUNT(*) FROM login_attempts WHERE key=? AND ts>?)<5 AND (SELECT COUNT(*) FROM login_attempts WHERE key=? AND ts>?)<30")
    .bind(ts, key, ipKey, key, since, ipKey, since).run();
  if (!r.meta || r.meta.changes < 2) throw new HttpError(429, "too_many_attempts", "Too many failed attempts. Try again in 15 minutes.");
  return r.meta.last_row_id;
}
async function login(request, env) {
  const body = await readJson(request);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `${email.slice(0, 254)}|${ip}`;
  const ipKey = `ip|${ip}`; // per-IP cap too, so rotating e-mail names cannot bypass the limit or flood the audit log
  const since = Date.now() - 15 * 60 * 1000;
  const resRow = await reserveAttempt(env, key, ipKey, since);
  const u = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  // Always run the hash so response time does not reveal whether the user exists.
  const salt = u ? u.salt : "00".repeat(16);
  const h = await hashPassword(password, salt, u ? u.iterations : PBKDF2_ITER);
  let hasAccess = false;
  if (u) hasAccess = !!u.is_super || !!(await env.DB.prepare("SELECT 1 AS x FROM user_companies uc JOIN companies c ON c.id=uc.company_id WHERE uc.user_id=? AND uc.active=1 AND c.active=1 LIMIT 1").bind(u.id).first());
  let totpStep = 0, totpBad = false;
  if (u && u.active && hasAccess && timingSafeEqual(h, u.pass_hash) && u.totp_enabled) {
    if (!body.totp) {
      // Correct password but no code yet: count it against the account and IP limits and audit it (no password, code or secret is stored).
      await auditUserEvent(env, u.id, { id: u.id, email: u.email }, request, "login_totp_required", "user", String(u.id), null);
      await env.DB.prepare("DELETE FROM login_attempts WHERE ts<?").bind(since).run(); // keep the table small
      throw new HttpError(401, "totp_required", "Enter the 6-digit code from your authenticator app");
    }
    try { totpStep = await totpVerify(await openSecret(env, u.totp_secret, u.id), body.totp, u.totp_last_step); } catch (e) { if (e instanceof HttpError) throw e; totpStep = 0; }
    totpBad = !totpStep;
  }
  if (!u || !u.active || !hasAccess || !timingSafeEqual(h, u.pass_hash) || totpBad) {
    await auditUserEvent(env, u ? u.id : null, null, request, "login_failed", "user", EMAIL_RE.test(email) ? email.slice(0, 100) : "(not an e-mail)", totpBad ? { reason: "bad_code" } : null); // never store text that may be a mistyped password
    await env.DB.prepare("DELETE FROM login_attempts WHERE ts<?").bind(since).run(); // keep the table small
    throw new HttpError(401, "invalid_credentials", "Invalid email or password");
  }
  if (totpStep) {
    // Atomic replay guard: only one concurrent login can advance totp_last_step past this code's step.
    const adv = await env.DB.prepare("UPDATE users SET totp_last_step=? WHERE id=? AND totp_last_step<?").bind(totpStep, u.id, totpStep).run();
    if (!adv.meta || adv.meta.changes !== 1) {
      await auditUserEvent(env, u.id, null, request, "login_failed", "user", EMAIL_RE.test(email) ? email.slice(0, 100) : "(not an e-mail)", { reason: "code_replay" });
      throw new HttpError(401, "invalid_credentials", "Invalid email or password");
    }
  }
  await env.DB.prepare("DELETE FROM login_attempts WHERE key=?").bind(key).run(); // fully authenticated: reset this account+IP counter
  await env.DB.prepare("DELETE FROM login_attempts WHERE rowid=? AND key=?").bind(resRow, ipKey).run(); // give back exactly this sign-in's IP slot (by row id, never by time)
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(nowIso()).run();
  const token = randomHex(32);
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)").bind(await sha256Hex(token), u.id, nowIso(), expires).run();
  const wantRemember = body.remember === true;
  await auditUserEvent(env, u.id, { id: u.id, email: u.email }, request, "login", "user", String(u.id), wantRemember ? { remember: true } : null);
  const cu = await currentUser(new Request("https://x/", { headers: { Authorization: "Bearer " + token } }), env);
  const out = { token, expires_at: expires, user: await userView(env, cu) };
  if (wantRemember) Object.assign(out, await issueRemember(env, u.id, randomHex(16), null));
  return out;
}
// Create the next remember token of a family. absIso is the family's 90-day cap (null = a fresh family starting now).
async function issueRemember(env, userId, family, absIso) {
  const now = Date.now();
  const abs = absIso || new Date(now + REMEMBER_ABS_DAYS * 86400e3).toISOString();
  const exp = new Date(Math.min(now + REMEMBER_DAYS * 86400e3, Date.parse(abs))).toISOString();
  const tok = randomHex(32);
  await env.DB.prepare("INSERT INTO remember_tokens (token_hash,family,user_id,created_at,last_used_at,expires_at,abs_expires_at) VALUES (?,?,?,?,?,?,?)").bind(await sha256Hex(tok), family, userId, nowIso(), nowIso(), exp, abs).run();
  return { remember_token: tok, remember_expires_at: exp };
}
// Exchange a remember token for a fresh 8-hour session and a rotated remember token. No password or 2FA is asked here: that was done at the sign-in that created the family.
async function refresh(request, env) {
  const b = await readJson(request);
  const raw = String(b.remember_token || "");
  if (!/^[0-9a-f]{64}$/.test(raw)) throw new HttpError(401, "unauthenticated", "Sign in required");
  const th = await sha256Hex(raw);
  const row = await env.DB.prepare("SELECT r.*, u.active AS u_active FROM remember_tokens r JOIN users u ON u.id=r.user_id WHERE r.token_hash=?").bind(th).first();
  if (!row) throw new HttpError(401, "unauthenticated", "Sign in required");
  const now = nowIso();
  const revoke = () => env.DB.prepare("DELETE FROM remember_tokens WHERE family=?").bind(row.family).run();
  if (row.rotated_at) {
    if (Date.now() - Date.parse(row.rotated_at) <= ROTATE_GRACE_MS) throw new HttpError(409, "rotated", "Remembered sign-in was just renewed by another tab"); // concurrent tab: no revoke, the client re-reads its stored token
    await revoke(); await auditUserEvent(env, row.user_id, null, request, "remember_reuse_revoked", "user", String(row.user_id), null);
    throw new HttpError(401, "unauthenticated", "Sign in required");
  }
  if (row.expires_at < now || row.abs_expires_at < now || !row.u_active) { await revoke(); throw new HttpError(401, "unauthenticated", "Sign in required"); }
  const mark = await env.DB.prepare("UPDATE remember_tokens SET rotated_at=? WHERE id=? AND rotated_at IS NULL").bind(now, row.id).run();
  if (!mark.meta || mark.meta.changes !== 1) throw new HttpError(409, "rotated", "Remembered sign-in was just renewed by another tab");
  await env.DB.prepare("DELETE FROM remember_tokens WHERE (expires_at<? OR abs_expires_at<?) OR (rotated_at IS NOT NULL AND rotated_at<?)").bind(now, now, new Date(Date.now() - 7 * 86400e3).toISOString()).run();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now).run();
  const token = randomHex(32);
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)").bind(await sha256Hex(token), row.user_id, now, expires).run();
  let cu;
  try { cu = await currentUser(new Request("https://x/", { headers: { Authorization: "Bearer " + token } }), env); }
  catch (e) { await revoke(); await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256Hex(token)).run(); throw e; } // no company access left
  const next = await issueRemember(env, row.user_id, row.family, row.abs_expires_at);
  return { token, expires_at: expires, user: await userView(env, cu), ...next };
}

// ---------- maintenance switch (per company "temporarily unavailable" for visitor cards) ----------
async function isMaintenance(env, co) {
  try { const r = await env.DB.prepare("SELECT value FROM company_settings WHERE company_id=? AND key='maintenance'").bind(co.id).first(); return !!r && r.value === "1"; }
  catch { return false; } // if the setting cannot be read, keep cards online
}
async function guardMaintenance(env, co) {
  if (await isMaintenance(env, co)) throw new HttpError(503, "maintenance", "Temporarily unavailable", null, { "Retry-After": "300", "Cache-Control": "no-store" });
}

// ---------- visit counters (aggregate only; never breaks a card) ----------
// "views" = successful opens of an active card by a non-bot, non-preview client. "browsers" = how many of those were the first open
// of the day on that browser, as REPORTED by the card page (?f=1, a per-day localStorage flag). It is approximate: not people, and it
// must not be summed across days. No IP, user-agent, cookie or visitor id is stored. Counts are buffered in memory per Worker isolate
// and written at most once per VIEWS_FLUSH_SECONDS (default 60) per isolate, capped per isolate per UTC day, so a traffic spike cannot
// use up the D1 free write budget. A recycled isolate loses its unflushed counts (undercount). Not a global budget reserve.
const BOT_RE = /bot|crawl|spider|slurp|preview|headless|facebookexternalhit|curl|wget|python|httpclient|monitor|uptime/i;
const VIEWS_PENDING = new Map(); let viewsLastFlush = 0, viewsDay = "", viewsFlushes = 0;
async function noteView(env, request, url, id, co) {
  try {
    if (url.searchParams.get("preview") === "1" || BOT_RE.test(request.headers.get("User-Agent") || "")) return;
    const day = nowIso().slice(0, 10);
    if (day !== viewsDay) { viewsDay = day; viewsFlushes = 0; }
    const k = day + "|" + id, e = VIEWS_PENDING.get(k) || { day, id, cid: co.id, v: 0, b: 0 };
    e.v++; if (url.searchParams.get("f") === "1") e.b++;
    VIEWS_PENDING.set(k, e);
    const every = Number(env.VIEWS_FLUSH_SECONDS ?? 60) * 1000, cap = Number(env.VIEWS_MAX_FLUSHES_PER_DAY || 200);
    if (Date.now() - viewsLastFlush < every || viewsFlushes >= cap) { if (VIEWS_PENDING.size > 500) VIEWS_PENDING.clear(); return; }
    viewsLastFlush = Date.now(); viewsFlushes++;
    const rows = [...VIEWS_PENDING.values()]; VIEWS_PENDING.clear();
    await env.DB.batch(rows.map((r) => env.DB.prepare("INSERT INTO card_views (day,employee_id,company_id,views,browsers) VALUES (?,?,?,?,?) ON CONFLICT(day,employee_id) DO UPDATE SET views=views+excluded.views, browsers=browsers+excluded.browsers").bind(r.day, r.id, r.cid, r.v, r.b)));
  } catch { /* analytics must never affect cards */ }
}
async function visitStats(env, co) {
  try {
    const d = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const sum = async (from) => (await env.DB.prepare("SELECT COALESCE(SUM(views),0) AS v FROM card_views WHERE company_id=? AND day>=?").bind(co.id, from).first()).v;
    const day = async (x) => await env.DB.prepare("SELECT COALESCE(SUM(views),0) AS v, COALESCE(SUM(browsers),0) AS b FROM card_views WHERE company_id=? AND day=?").bind(co.id, x).first();
    const t = await day(d(0)), y = await day(d(1));
    const { results: top } = await env.DB.prepare("SELECT c.employee_id AS id, SUM(c.views) AS views, e.name_ar, e.name_en FROM card_views c LEFT JOIN employees e ON e.id=c.employee_id AND e.company_id=c.company_id WHERE c.company_id=? AND c.day>=? GROUP BY c.employee_id ORDER BY views DESC LIMIT 5").bind(co.id, d(29)).all();
    return { views: { today: t.v, yesterday: y.v, last7: await sum(d(6)), last30: await sum(d(29)), total: await sum("0000-00-00") }, browsers_approx: { today: t.b, yesterday: y.b }, top_30d: top, since_note: "Counts start when this feature was activated; day is UTC." };
  } catch { return null; }
}

// ---------- routes ----------
async function getEmployee(env, id, co) {
  return env.DB.prepare(`SELECT * FROM employees WHERE id=? AND company_id=?`).bind(id, co.id).first();
}
function diff(before, after) {
  const c = {};
  for (const k of Object.keys(after)) if (String(before[k] ?? "") !== String(after[k] ?? "")) c[k] = { from: before[k] ?? null, to: after[k] };
  return c;
}
function safeDecode(s) { try { return decodeURIComponent(s); } catch { throw new HttpError(400, "bad_id", "Invalid employee ID"); } }
function esc(s) { return s.replace(/[\\%_]/g, (m) => "\\" + m); }

function userAuditStmts(env, user, request, action, entity, entityId, changes) {
  const ids = [...user.member.keys()]; if (!ids.length) ids.push(null);
  return ids.map((cid) => auditStmt(env, user, request, action, entity, entityId, changes, cid));
}
function cleanCompanyInput(b, { partial = false } = {}) {
  const out = {}, errors = {};
  const txt = (k, max, req) => { if (!(k in b)) { if (!partial && req) errors[k] = "required"; return; } const v = cleanStr(b[k] ?? ""); if (req && !v) errors[k] = "required"; else if (v.length > max) errors[k] = `max ${max} characters`; else out[k] = v; };
  txt("name_ar", 120, true); txt("name_en", 120, true);
  if ("card_base_url" in b) { const v = String(b.card_base_url ?? "").trim(); if (v && !/^(https:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[A-Za-z0-9._~\/-]*)?|http:\/\/localhost(:\d{1,5})?(\/[A-Za-z0-9._~\/-]*)?)$/.test(v)) errors.card_base_url = "must be an https URL (the part before ?id=)"; else out.card_base_url = v; }
  if ("allowed_origins" in b) { const list = (Array.isArray(b.allowed_origins) ? b.allowed_origins : String(b.allowed_origins || "").split(",")).map((s) => String(s).trim()).filter(Boolean); if (list.some((o) => !ORIGIN_RE.test(o) || o === "*")) errors.allowed_origins = "exact origins only, e.g. https://example.com"; else out.allowed_origins = list.join(","); }
  if ("active" in b) { if (typeof b.active !== "boolean") errors.active = "must be true or false"; else out.active = b.active ? 1 : 0; }
  if (Object.keys(errors).length) throw new HttpError(422, "validation_failed", "Validation failed", errors);
  return out;
}
const companyView = (c, full) => ({ id: c.id, slug: c.slug, prefix: c.prefix, name_ar: c.name_ar, name_en: c.name_en, ...(full ? { card_base_url: c.card_base_url, allowed_origins: c.allowed_origins, active: !!c.active } : {}) });

async function route(request, env) {
  const url = new URL(request.url);
  let path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;
  let m;

  if ((path === "/health" || path === "/api/health") && method === "GET") {
    await rateLimit(request, env, "health");
    let db = "unbound";
    if (env.DB) { try { await env.DB.prepare("SELECT 1").first(); db = "bound"; } catch { db = "error"; } }
    return json({ ok: true, service: "SIMTA Cards API", mode: env.ENVIRONMENT || "staging", database: db });
  }

  // Company scope: /api/c/<slug>/... selects a company; the legacy /api/... routes are SIMTA (id 1), unchanged for existing pages and QR links.
  const all = await companies(env);
  let co = null;
  const cm = path.match(/^\/api\/c\/([a-z][a-z0-9-]*)(\/.*)$/);
  if (cm) { co = all.find((c) => c.slug === cm[1] && c.active); if (!co) throw new HttpError(404, "not_found", "Not found"); path = "/api" + cm[2]; }
  const scope = co || all.find((c) => c.id === 1);
  if (!scope) throw new HttpError(503, "no_company", "Company configuration is missing");
  const ID = idRe(scope);

  // ---- public ----
  if (path === "/api/status" && method === "GET") { await rateLimit(request, env, "card"); return json({ maintenance: await isMaintenance(env, scope) }, 200, { "Cache-Control": "no-store" }); }
  if (path === "/api/employees" && method === "GET") {
    const user = await currentUser(request, env); // directory/search needs a session (viewer or above of THIS company); single cards below stay public by ID
    requireRole(user, scope, "viewer");
    const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
    let sql = `SELECT ${PUBLIC_COLS} FROM employees WHERE company_id=? AND active=1`; const binds = [scope.id];
    if (q) {
      const like = `%${esc(q)}%`;
      sql += " AND (id LIKE ? ESCAPE '\\' OR name_ar LIKE ? ESCAPE '\\' OR name_en LIKE ? ESCAPE '\\' OR title_ar LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\' OR dept_ar LIKE ? ESCAPE '\\' OR dept_en LIKE ? ESCAPE '\\' OR department LIKE ? ESCAPE '\\')";
      binds.push(like, like, like, like, like, like, like, like);
    }
    const lim = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1), 200);
    const off = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
    const tot = await env.DB.prepare(sql.replace(`SELECT ${PUBLIC_COLS} FROM`, "SELECT COUNT(*) AS n FROM")).bind(...binds).first();
    const { results } = await env.DB.prepare(sql + " ORDER BY id LIMIT ? OFFSET ?").bind(...binds, lim, off).all();
    return json(results.map((r) => publicEmployee(r, env, scope)), 200, { "X-Total-Count": String(tot.n) }); // bare array; total in header
  }
  if ((m = path.match(/^\/api\/employees\/([^/]+)$/)) && method === "GET") {
    await rateLimit(request, env, "card");
    await guardMaintenance(env, scope);
    const id = normalizeId(safeDecode(m[1]));
    if (!ID.test(id)) throw new HttpError(400, "bad_id", "Invalid employee ID");
    const r = await env.DB.prepare(`SELECT ${PUBLIC_COLS}, active FROM employees WHERE id=? AND company_id=?`).bind(id, scope.id).first();
    if (!r) throw new HttpError(404, "not_found", "Employee not found"); // deleted, never existed, or belongs to another company -> "card deleted" message
    // A card switched off in admin is "under maintenance" for that card only: own code, so the card page shows a card-specific message (the company-wide one stays "maintenance"). Not counted as a view.
    if (!r.active) throw new HttpError(503, "card_maintenance", "This card is temporarily unavailable", null, { "Retry-After": "300", "Cache-Control": "no-store" });
    await noteView(env, request, url, id, scope);
    return json(publicEmployee(r, env, scope), 200); // bare object
  }
  if ((m = path.match(/^\/api\/photos\/([^/]+)$/)) && method === "GET") {
    await rateLimit(request, env, "card");
    await guardMaintenance(env, scope);
    const id = normalizeId(safeDecode(m[1]));
    if (!ID.test(id)) throw new HttpError(400, "bad_id", "Invalid employee ID");
    const p = await env.DB.prepare("SELECT p.mime,p.data_b64 FROM employee_photos p JOIN employees e ON e.id=p.employee_id WHERE p.employee_id=? AND e.active=1 AND e.company_id=?").bind(id, scope.id).first();
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
    const u = await createUser(env, { email: body.email, name: body.name, role: "admin", password: body.password, onlyIfEmpty: true, isSuper: true, memberships: [{ company_id: 1, role: "admin" }] });
    await audit(env, { id: u.id, email: u.email }, request, "setup_admin", "user", String(u.id), null, 1);
    return json({ ok: true, user: u }, 201);
  }
  if (path === "/api/auth/login" && method === "POST") { await rateLimit(request, env, "auth"); return json(await login(request, env)); }
  if (path === "/api/auth/refresh" && method === "POST") { await rateLimit(request, env, "auth"); return json(await refresh(request, env)); }

  // ---- authenticated ----
  if (path.startsWith("/api/auth/") || path.startsWith("/api/admin/")) {
    await rateLimit(request, env, "api");
    const user = await currentUser(request, env);
    request._u = user; request._co = scope.id; // lets the top-level handler audit a role denial
    // Optional enforcement: with REQUIRE_2FA=true, accounts without 2FA can only reach the /api/auth/ endpoints (to set it up).
    if (String(env.REQUIRE_2FA) === "true" && !user.two_factor && !path.startsWith("/api/auth/")) throw new HttpError(403, "two_factor_required", "Two-factor sign-in must be enabled for this account first");

    if (path === "/api/auth/me" && method === "GET") return json({ user: await userView(env, user) });
    if (path === "/api/auth/2fa/setup" && method === "POST") {
      if (user.two_factor) throw new HttpError(409, "already_enabled", "Two-factor sign-in is already enabled");
      const secret = b32encode(crypto.getRandomValues(new Uint8Array(20)));
      await env.DB.prepare("UPDATE users SET totp_secret=?, totp_enabled=0, totp_last_step=0 WHERE id=?").bind(await sealSecret(env, secret, user.id), user.id).run();
      return json({ secret, otpauth_uri: `otpauth://totp/SIMTA%20Cards:${encodeURIComponent(user.email)}?secret=${secret}&issuer=SIMTA%20Cards&algorithm=SHA1&digits=6&period=30` });
    }
    if (path === "/api/auth/2fa/enable" && method === "POST") {
      const b = await readJson(request);
      await twoFaGuard(env, user);
      const row = await env.DB.prepare("SELECT totp_secret,totp_enabled FROM users WHERE id=?").bind(user.id).first();
      if (row.totp_enabled) throw new HttpError(409, "already_enabled", "Two-factor sign-in is already enabled");
      if (!row.totp_secret) throw new HttpError(409, "not_started", "Start 2FA setup first");
      const step = await totpVerify(await openSecret(env, row.totp_secret, user.id), b.code, 0);
      if (!step) await twoFaFail(env, user, 422, "bad_code", "That code is not valid");
      await commit(env, env.DB.prepare("UPDATE users SET totp_enabled=1, totp_last_step=? WHERE id=?").bind(step, user.id),
        env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND token_hash<>?").bind(user.id, user.token_hash),
        env.DB.prepare("DELETE FROM remember_tokens WHERE user_id=?").bind(user.id),
        ...userAuditStmts(env, user, request, "2fa_enable", "user", String(user.id), null));
      return json({ ok: true });
    }
    if (path === "/api/auth/2fa/disable" && method === "POST") {
      const b = await readJson(request);
      await twoFaGuard(env, user);
      const row = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(user.id).first();
      if (!row.totp_enabled) throw new HttpError(409, "not_enabled", "Two-factor sign-in is not enabled");
      const okPw = timingSafeEqual(await hashPassword(String(b.password || ""), row.salt, row.iterations), row.pass_hash);
      const step = okPw ? await totpVerify(await openSecret(env, row.totp_secret, user.id), b.code, row.totp_last_step) : 0;
      if (!okPw || !step) await twoFaFail(env, user, 403, "forbidden", "Password or code is not valid");
      await commit(env, env.DB.prepare("UPDATE users SET totp_enabled=0, totp_secret=NULL, totp_last_step=0 WHERE id=?").bind(user.id),
        ...userAuditStmts(env, user, request, "2fa_disable", "user", String(user.id), null));
      return json({ ok: true });
    }
    if (path === "/api/auth/logout" && method === "POST") {
      let rt = ""; try { rt = String((await readJson(request)).remember_token || ""); } catch { /* body is optional */ }
      const stmts = [env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(user.token_hash)];
      if (/^[0-9a-f]{64}$/.test(rt)) stmts.push(env.DB.prepare("DELETE FROM remember_tokens WHERE family=(SELECT family FROM remember_tokens WHERE token_hash=? AND user_id=?)").bind(await sha256Hex(rt), user.id)); // this device's remembered sign-in ends with the logout
      await commit(env, ...stmts, ...userAuditStmts(env, user, request, "logout", "user", String(user.id), null));
      return json({ ok: true });
    }

    // ---- platform (company-independent) ----
    if (path === "/api/admin/companies" && method === "GET") {
      const list = (await companies(env, true)).filter((c) => user.is_super || (c.active && user.member.has(c.id)));
      return json({ companies: list.map((c) => ({ ...companyView(c, user.is_super), role: roleIn(user, c) })) });
    }
    if (path === "/api/admin/companies" && method === "POST") {
      requireSuper(user);
      const b = await readJson(request);
      const slug = String(b.slug || "").trim().toLowerCase(), prefix = String(b.prefix || "").trim().toUpperCase();
      const errs = {}; if (!SLUG_RE.test(slug)) errs.slug = "2-30 chars: a-z, 0-9, -"; if (!/^[A-Z]{3}$/.test(prefix)) errs.prefix = "exactly 3 letters A-Z";
      if (Object.keys(errs).length) throw new HttpError(422, "validation_failed", "Validation failed", errs);
      const v = cleanCompanyInput(b);
      let id;
      try {
        const r = await env.DB.prepare("INSERT INTO companies (slug,prefix,name_ar,name_en,card_base_url,allowed_origins,active,created_at) VALUES (?,?,?,?,?,?,1,?)").bind(slug, prefix, v.name_ar, v.name_en, v.card_base_url || "", v.allowed_origins || "", nowIso()).run();
        id = r.meta.last_row_id;
      } catch (e) { if (/UNIQUE/i.test(String(e.message))) throw new HttpError(409, "exists", "A company with this slug or prefix already exists"); throw e; }
      await audit(env, user, request, "company_create", "company", String(id), { slug, prefix, name_en: v.name_en }, id);
      CO_CACHE.at = 0;
      return json({ company: companyView((await companies(env, true)).find((c) => c.id === id), true) }, 201);
    }
    if ((m = path.match(/^\/api\/admin\/companies\/(\d+)$/)) && method === "PUT") {
      requireSuper(user);
      const cid = Number(m[1]); const cur = (await companies(env, true)).find((c) => c.id === cid);
      if (!cur) throw new HttpError(404, "not_found", "Company not found");
      const b = await readJson(request);
      if ("slug" in b || "prefix" in b) throw new HttpError(422, "validation_failed", "Validation failed", { slug: "slug and prefix cannot be changed" });
      const v = cleanCompanyInput(b, { partial: true });
      const c = diff(cur, v);
      if (!Object.keys(c).length) return json({ company: companyView(cur, true) });
      const keys = Object.keys(v);
      await commit(env, env.DB.prepare(`UPDATE companies SET ${keys.map((k) => k + "=?").join(",")} WHERE id=?`).bind(...keys.map((k) => v[k]), cid), auditStmt(env, user, request, "company_update", "company", String(cid), c, cid));
      CO_CACHE.at = 0;
      return json({ company: companyView((await companies(env, true)).find((x) => x.id === cid), true) });
    }
    if (path === "/api/admin/platform/audit" && method === "GET") {
      requireSuper(user);
      const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 200);
      const { results } = await env.DB.prepare("SELECT a.id,a.ts,a.user_email,a.action,a.entity,a.entity_id,a.changes,a.company_id,c.slug AS company FROM audit_log a LEFT JOIN companies c ON c.id=a.company_id ORDER BY a.id DESC LIMIT ?").bind(limit).all();
      return json({ entries: results });
    }
    if (path === "/api/admin/platform/users" && method === "GET") {
      requireSuper(user);
      const { results } = await env.DB.prepare("SELECT id,email,name,active,is_super,totp_enabled AS two_factor,created_at FROM users ORDER BY id").all();
      const { results: ms } = await env.DB.prepare("SELECT uc.user_id,c.slug,uc.role,uc.active FROM user_companies uc JOIN companies c ON c.id=uc.company_id ORDER BY uc.user_id,c.id").all();
      return json({ users: results.map((u) => ({ ...u, is_super: !!u.is_super, active: !!u.active, memberships: ms.filter((x) => x.user_id === u.id).map((x) => ({ company: x.slug, role: x.role, active: !!x.active })) })) });
    }
    const slugToId = (s) => { const c = all.find((x) => x.slug === s); if (!c) throw new HttpError(422, "validation_failed", "Validation failed", { memberships: "unknown company " + String(s).slice(0, 30) }); return c.id; };
    if (path === "/api/admin/platform/users" && method === "POST") {
      requireSuper(user);
      const b = await readJson(request);
      const ms = [...new Map((Array.isArray(b.memberships) ? b.memberships : []).map((x) => [slugToId(x.company), { company_id: slugToId(x.company), role: x.role }])).values()];
      const u = await createUser(env, { email: b.email, name: b.name, password: b.password, memberships: ms, isSuper: b.is_super === true });
      await commit(env, ...(ms.length ? ms.map((x) => auditStmt(env, user, request, "user_create", "user", String(u.id), { email: u.email, role: x.role, is_super: b.is_super === true }, x.company_id)) : [auditStmt(env, user, request, "user_create", "user", String(u.id), { email: u.email, is_super: b.is_super === true }, null)]));
      return json({ user: u }, 201);
    }
    if ((m = path.match(/^\/api\/admin\/platform\/users\/(\d+)$/)) && method === "PUT") {
      requireSuper(user);
      const uid = Number(m[1]); const b = await readJson(request);
      const target = await env.DB.prepare("SELECT id,is_super,active FROM users WHERE id=?").bind(uid).first();
      if (!target) throw new HttpError(404, "not_found", "User not found");
      if (uid === user.id && (b.is_super === false || b.active === false)) throw new HttpError(422, "validation_failed", "You cannot demote or disable yourself");
      const ops = []; const sets = [], binds = []; const changed = {};
      if ("is_super" in b) { if (typeof b.is_super !== "boolean") throw new HttpError(422, "validation_failed", "Validation failed", { is_super: "must be true or false" }); sets.push("is_super=?"); binds.push(b.is_super ? 1 : 0); changed.is_super = b.is_super; }
      if ("active" in b) { if (typeof b.active !== "boolean") throw new HttpError(422, "validation_failed", "Validation failed", { active: "must be true or false" }); sets.push("active=?"); binds.push(b.active ? 1 : 0); changed.active = b.active; }
      if ("password" in b) { checkPassword(b.password); const salt = randomHex(16); sets.push("salt=?", "pass_hash=?", "iterations=?"); binds.push(salt, await hashPassword(b.password, salt, PBKDF2_ITER), PBKDF2_ITER); changed.password_changed = true; }
      if (b.reset_2fa === true) { sets.push("totp_enabled=0", "totp_secret=NULL", "totp_last_step=0"); changed.reset_2fa = true; }
      if (sets.length) ops.push(env.DB.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).bind(...binds, uid));
      if (Array.isArray(b.memberships)) for (const x of b.memberships) {
        const cid = slugToId(x.company); if (!RANK[x.role]) throw new HttpError(422, "validation_failed", "Validation failed", { role: "admin, editor or viewer" });
        ops.push(env.DB.prepare("INSERT INTO user_companies (user_id,company_id,role,active,created_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,company_id) DO UPDATE SET role=excluded.role, active=excluded.active").bind(uid, cid, x.role, x.active === false ? 0 : 1, nowIso()));
        ops.push(auditStmt(env, user, request, "membership_set", "user", String(uid), { role: x.role, active: x.active !== false }, cid));
      }
      if (!ops.length) throw new HttpError(400, "nothing_to_update", "Nothing to update");
      if (target.is_super && (b.is_super === false || b.active === false)) {
        const o = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE is_super=1 AND active=1 AND id<>?").bind(uid).first();
        if (!o.n) throw new HttpError(422, "validation_failed", "At least one active platform admin must remain");
      }
      ops.push(env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(uid), env.DB.prepare("DELETE FROM remember_tokens WHERE user_id=?").bind(uid)); // any change to access ends old sessions and remembered devices
      if (Object.keys(changed).length) ops.push(auditStmt(env, user, request, "user_update", "user", String(uid), changed, null));
      await commit(env, ...ops);
      return json({ ok: true });
    }

    // ---- company-scoped admin (every query below carries scope.id; roles are checked against THIS company) ----
    if (path === "/api/admin/maintenance" && method === "GET") { requireRole(user, scope, "viewer"); return json({ maintenance: await isMaintenance(env, scope) }); }
    if (path === "/api/admin/maintenance" && method === "PUT") {
      requireRole(user, scope, "admin");
      const b = await readJson(request);
      if (typeof b.enabled !== "boolean") throw new HttpError(422, "validation_failed", "Validation failed", { enabled: "must be true or false" });
      const before = await isMaintenance(env, scope);
      await commit(env,
        env.DB.prepare("INSERT INTO company_settings (company_id,key,value,updated_at) VALUES (?,'maintenance',?,?) ON CONFLICT(company_id,key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind(scope.id, b.enabled ? "1" : "0", nowIso()),
        auditStmt(env, user, request, "maintenance", "site", null, { maintenance: { from: before, to: b.enabled } }, scope.id));
      return json({ maintenance: b.enabled });
    }

    if (path === "/api/admin/stats" && method === "GET") {
      requireRole(user, scope, "viewer");
      const t = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(active) AS active, SUM(CASE WHEN photo_version>0 THEN 1 ELSE 0 END) AS with_photo FROM employees WHERE company_id=?").bind(scope.id).first();
      const { results: depts } = await env.DB.prepare("SELECT department, dept_ar, dept_en, COUNT(*) AS n FROM employees WHERE company_id=? AND active=1 GROUP BY department, dept_ar, dept_en ORDER BY n DESC").bind(scope.id).all();
      const { results: recent } = await env.DB.prepare("SELECT id,name_ar,name_en,updated_at,active FROM employees WHERE company_id=? ORDER BY updated_at DESC LIMIT 5").bind(scope.id).all();
      const visits = await visitStats(env, scope);
      return json({ visits, total: t.total || 0, active: t.active || 0, inactive: (t.total || 0) - (t.active || 0), with_photo: t.with_photo || 0, departments: depts, recent });
    }

    if (path === "/api/admin/employees" && method === "GET") {
      requireRole(user, scope, "viewer");
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
      const where = ["company_id=?"]; const binds = [scope.id];
      if (status === "active") where.push("active=1"); else if (status === "inactive") where.push("active=0");
      else if (status !== "all") throw new HttpError(400, "bad_status", "status must be all, active or inactive");
      if (dept) { where.push("department=?"); binds.push(dept); }
      if (q) {
        const like = `%${esc(q)}%`;
        where.push("(id LIKE ? ESCAPE '\\' OR name_ar LIKE ? ESCAPE '\\' OR name_en LIKE ? ESCAPE '\\' OR title_ar LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\' OR dept_ar LIKE ? ESCAPE '\\' OR dept_en LIKE ? ESCAPE '\\' OR department LIKE ? ESCAPE '\\')");
        binds.push(like, like, like, like, like, like, like, like);
      }
      const w = " WHERE " + where.join(" AND ");
      const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM employees" + w).bind(...binds).first();
      const { results } = await env.DB.prepare(`SELECT * FROM employees${w} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(...binds, limit, offset).all();
      return json({ total: total.n, employees: results.map((r) => adminEmployee(r, env, scope)) });
    }
    if (path === "/api/admin/employees" && method === "POST") {
      requireRole(user, scope, "editor");
      const body = await readJson(request);
      const id = normalizeId(body.id);
      if (!ID.test(id)) throw new HttpError(422, "validation_failed", "Validation failed", { id: `format ${scope.prefix}-001 (${scope.prefix}- followed by 3 to 6 digits)` });
      const v = validateEmployee(body);
      const ts = nowIso();
      try {
        await commit(env, env.DB.prepare(`INSERT INTO employees (id,company_id,name_ar,name_en,title_ar,title_en,department,dept_ar,dept_en,phone,whatsapp,email,location_ar,location_en,photo_version,active,extra,created_at,updated_at,created_by,updated_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?,?,?,?,?)`)
          .bind(id, scope.id, v.name_ar, v.name_en, v.title_ar, v.title_en, v.department || "", v.dept_ar || "", v.dept_en || "", v.phone, v.whatsapp || "", v.email || "", v.location_ar || "", v.location_en || "", v.extra || "{}", ts, ts, user.email, user.email),
          auditStmt(env, user, request, "create", "employee", id, v, scope.id));
      } catch (e) {
        if (/UNIQUE|PRIMARY/i.test(String(e.message))) throw new HttpError(409, "exists", "An employee with this ID already exists"); // ids are unique across companies; the message does not say which company holds it
        throw e;
      }
      return json({ employee: adminEmployee(await getEmployee(env, id, scope), env, scope) }, 201);
    }
    if ((m = path.match(/^\/api\/admin\/employees\/([^/]+)(\/(deactivate|reactivate|photo))?$/))) {
      requireRole(user, scope, "viewer");
      const id = normalizeId(safeDecode(m[1]));
      if (!ID.test(id)) throw new HttpError(400, "bad_id", "Invalid employee ID");
      const sub = m[3];
      const cur = await getEmployee(env, id, scope);
      if (!cur) throw new HttpError(404, "not_found", "Employee not found");

      if (!sub && method === "GET") return json({ employee: adminEmployee(cur, env, scope) });
      if (!sub && method === "DELETE") {
        // Permanent delete: admin only, and the caller must send the employee ID again as {"confirm": "SMT-001"}.
        requireRole(user, scope, "admin");
        let body = null; try { body = await request.json(); } catch { body = null; }
        if (!body || normalizeId(String(body.confirm || "")) !== id) throw new HttpError(422, "confirmation_required", "Type the employee ID to confirm deletion", { confirm: "must equal the employee ID" });
        await commit(env, env.DB.prepare("DELETE FROM employee_photos WHERE employee_id=?").bind(id),
          env.DB.prepare("DELETE FROM employees WHERE id=? AND company_id=?").bind(id, scope.id),
          auditStmt(env, user, request, "delete", "employee", id, { name_en: cur.name_en }, scope.id));
        return json({ deleted: true, id });
      }
      if (!sub && method === "PUT") {
        requireRole(user, scope, "editor");
        const body = await readJson(request);
        if ("id" in body && normalizeId(body.id) !== id) throw new HttpError(422, "validation_failed", "Validation failed", { id: "ID cannot be changed" });
        if ("active" in body) throw new HttpError(422, "validation_failed", "Validation failed", { active: "use the deactivate/reactivate endpoints" });
        if ("company_id" in body || "company" in body) throw new HttpError(422, "validation_failed", "Validation failed", { company: "an employee cannot move to another company" });
        const v = validateEmployee(body, { partial: true });
        const c = diff(cur, v);
        if (!Object.keys(c).length) return json({ employee: adminEmployee(cur, env, scope) });
        const keys = Object.keys(v);
        await commit(env, env.DB.prepare(`UPDATE employees SET ${keys.map((k) => k + "=?").join(",")}, updated_at=?, updated_by=? WHERE id=? AND company_id=?`)
          .bind(...keys.map((k) => v[k]), nowIso(), user.email, id, scope.id), auditStmt(env, user, request, "update", "employee", id, c, scope.id));
        return json({ employee: adminEmployee(await getEmployee(env, id, scope), env, scope) });
      }
      if ((sub === "deactivate" || sub === "reactivate") && method === "POST") {
        requireRole(user, scope, "editor");
        const on = sub === "reactivate" ? 1 : 0;
        if (cur.active !== on) {
          await commit(env, env.DB.prepare("UPDATE employees SET active=?, deactivated_at=?, updated_at=?, updated_by=? WHERE id=? AND company_id=?").bind(on, on ? null : nowIso(), nowIso(), user.email, id, scope.id),
            auditStmt(env, user, request, sub, "employee", id, null, scope.id));
        }
        return json({ employee: adminEmployee(await getEmployee(env, id, scope), env, scope) });
      }
      if (sub === "photo" && method === "PUT") {
        requireRole(user, scope, "editor");
        const mime = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
        if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new HttpError(415, "unsupported_media_type", "Photo must be JPEG, PNG or WebP");
        const declared = Number(request.headers.get("Content-Length") || 0);
        if (declared > MAX_PHOTO) throw new HttpError(413, "too_large", `Photo must be 1 byte to ${MAX_PHOTO / 1024} KB`); // reject before reading the body
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
          env.DB.prepare("UPDATE employees SET photo_version=photo_version+1, updated_at=?, updated_by=? WHERE id=? AND company_id=?").bind(ts, user.email, id, scope.id),
          auditStmt(env, user, request, "photo_set", "employee", id, { bytes: buf.length, mime }, scope.id));
        return json({ employee: adminEmployee(await getEmployee(env, id, scope), env, scope) });
      }
      if (sub === "photo" && method === "DELETE") {
        requireRole(user, scope, "editor");
        await commit(env, env.DB.prepare("DELETE FROM employee_photos WHERE employee_id=?").bind(id),
          env.DB.prepare("UPDATE employees SET photo_version=0, updated_at=?, updated_by=? WHERE id=? AND company_id=?").bind(nowIso(), user.email, id, scope.id),
          auditStmt(env, user, request, "photo_remove", "employee", id, null, scope.id));
        return json({ employee: adminEmployee(await getEmployee(env, id, scope), env, scope) });
      }
      throw new HttpError(405, "method_not_allowed", "Method not allowed");
    }

    if (path === "/api/admin/audit" && method === "GET") {
      requireRole(user, scope, "admin");
      const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 200);
      const { results } = await env.DB.prepare("SELECT id,ts,user_email,action,entity,entity_id,changes FROM audit_log WHERE company_id=? ORDER BY id DESC LIMIT ?").bind(scope.id, limit).all();
      return json({ entries: results });
    }
    if (path === "/api/admin/users" && method === "GET") {
      requireRole(user, scope, "admin");
      const { results } = await env.DB.prepare("SELECT u.id,u.email,u.name,uc.role,uc.active,u.totp_enabled AS two_factor,u.created_at FROM user_companies uc JOIN users u ON u.id=uc.user_id WHERE uc.company_id=? ORDER BY u.id").bind(scope.id).all();
      return json({ users: results });
    }
    if (path === "/api/admin/users" && method === "POST") {
      requireRole(user, scope, "admin");
      const b = await readJson(request);
      const u = await createUser(env, { email: b.email, name: b.name, password: b.password, memberships: [{ company_id: scope.id, role: b.role }] });
      await audit(env, user, request, "user_create", "user", String(u.id), { email: u.email, role: u.role }, scope.id);
      return json({ user: { id: u.id, email: u.email, role: u.role } }, 201);
    }
    if ((m = path.match(/^\/api\/admin\/users\/(\d+)$/)) && method === "PUT") {
      requireRole(user, scope, "admin");
      const uid = Number(m[1]); const b = await readJson(request);
      if ("active" in b && typeof b.active !== "boolean") throw new HttpError(422, "validation_failed", "Validation failed", { active: "must be true or false" });
      if (uid === user.id && (b.active === false || (b.role && b.role !== "admin"))) throw new HttpError(422, "validation_failed", "You cannot demote or disable yourself");
      // The target must belong to THIS company; users of other companies do not exist from here.
      const target = await env.DB.prepare("SELECT u.id,u.is_super,uc.role,uc.active FROM user_companies uc JOIN users u ON u.id=uc.user_id WHERE uc.company_id=? AND u.id=?").bind(scope.id, uid).first();
      if (!target) throw new HttpError(404, "not_found", "User not found");
      if (target.role === "admin" && target.active && (b.active === false || ("role" in b && b.role !== "admin"))) {
        const o = await env.DB.prepare("SELECT COUNT(*) AS n FROM user_companies WHERE company_id=? AND role='admin' AND active=1 AND user_id<>?").bind(scope.id, uid).first();
        if (!o.n) throw new HttpError(422, "validation_failed", "At least one active admin must remain");
      }
      const sets = []; const binds = []; const msets = []; const mbinds = [];
      if ("role" in b) { if (!RANK[b.role]) throw new HttpError(422, "validation_failed", "Validation failed", { role: "admin, editor or viewer" }); msets.push("role=?"); mbinds.push(b.role); }
      if ("active" in b) { msets.push("active=?"); mbinds.push(b.active ? 1 : 0); }
      if ("password" in b || b.reset_2fa === true) {
        // A login that also belongs to another company (or is a platform admin) is shared identity: only a platform admin may change its password or 2FA.
        const other = await env.DB.prepare("SELECT COUNT(*) AS n FROM user_companies WHERE user_id=? AND company_id<>?").bind(uid, scope.id).first();
        if (!user.is_super && (other.n > 0 || target.is_super)) throw new HttpError(403, "forbidden", "Your role does not allow this action");
      }
      if ("password" in b) { checkPassword(b.password); const salt = randomHex(16); sets.push("salt=?", "pass_hash=?", "iterations=?"); binds.push(salt, await hashPassword(b.password, salt, PBKDF2_ITER), PBKDF2_ITER); }
      if (b.reset_2fa === true) sets.push("totp_enabled=0", "totp_secret=NULL", "totp_last_step=0");
      if (!sets.length && !msets.length) throw new HttpError(400, "nothing_to_update", "Nothing to update");
      const ops = [];
      if (sets.length) ops.push(env.DB.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).bind(...binds, uid));
      if (msets.length) ops.push(env.DB.prepare(`UPDATE user_companies SET ${msets.join(",")} WHERE user_id=? AND company_id=?`).bind(...mbinds, uid, scope.id));
      if ("password" in b || "role" in b || b.active === false || b.reset_2fa === true) ops.push(env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(uid), env.DB.prepare("DELETE FROM remember_tokens WHERE user_id=?").bind(uid)); // role change also ends old sessions and remembered devices
      ops.push(auditStmt(env, user, request, "user_update", "user", String(uid), { fields: Object.keys(b).filter((k) => k !== "password"), password_changed: "password" in b }, scope.id));
      await commit(env, ...ops);
      return json({ ok: true });
    }
    throw new HttpError(404, "not_found", "Not found");
  }
  throw new HttpError(404, "not_found", "Not found");
}

export default {
  async fetch(request, env) {
    let cors = { "Vary": "Origin" };
    try { cors = await corsHeaders(request, env); } catch { /* keep default */ }
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
          if (c.n < 20) await audit(env, { id: u.id, email: u.email }, request, "denied", "request", new URL(request.url).pathname.slice(0, 120), { method: request.method, role: roleIn(u, { id: request._co }) }, u.is_super || u.member.has(request._co) ? request._co : null); // a denial is logged in the target company only when the user belongs to it; otherwise at platform level
        } catch {}
      }
      if (e instanceof HttpError) res = json({ error: e.message, code: e.code, ...(e.details ? { details: e.details } : {}) }, e.status, e.headers || {});
      else { console.error("unhandled", e && e.message); res = json({ error: "Internal error", code: "internal" }, 500); }
    }
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) h.set(k, v);
    // Security headers on every API response (set only if the route did not set its own).
    const sec = { "Strict-Transport-Security": "max-age=31536000", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "X-Content-Type-Options": "nosniff" };
    for (const [k, v] of Object.entries(sec)) if (!h.has(k)) h.set(k, v);
    return new Response(res.body, { status: res.status, headers: h });
  },
};
