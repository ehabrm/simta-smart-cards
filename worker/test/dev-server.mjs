// LOCAL ONLY dev server: serves the static site + the Worker code against an in-memory SQLite (not D1).
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import worker from "../src/index.js"; import { makeDB } from "./mock-d1.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.PORT || 8799);
const env = { DB: makeDB(), ALLOWED_ORIGINS: `http://localhost:${PORT}`, CARD_BASE_URL: `http://localhost:${PORT}/card.html`, SETUP_TOKEN: "local-setup", ENVIRONMENT: "local-mock", TOTP_KEY: "local-totp-key-0123456789", RATE_API_PER_MIN: "100000", RATE_AUTH_PER_MIN: "100000", RATE_CARD_PER_MIN: "100000" };
const call = (m, p, body, tok) => worker.fetch(new Request("http://x" + p, { method: m, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }), env).then((r) => r.json());
await call("POST", "/api/setup", { setup_token: "local-setup", email: "admin@example.com", name: "Admin", password: "local test password 1" });
const tok = (await call("POST", "/api/auth/login", { email: "admin@example.com", password: "local test password 1" })).token;
const seed = [
 ["SMT-001", "سارة نموذج", "Sara Sample", "مندوب خرسانة", "Concrete Sales Representative", "sales", "المبيعات", "Sales", "+12025550101", "12025550101", "", "المدينة التجريبية", "Demo City"],
 ["SMT-002", "عمر تجريبي", "Omar Demo", "مشرف مبيعات", "Sales Supervisor", "sales", "المبيعات", "Sales", "+12025550102", "12025550102", "omar.demo@example.com", "المدينة التجريبية ٢", "Demo City 2"],
 ["SMT-003", "دينا افتراضية", "Dina Mock", "مهندس جودة", "Quality Engineer", "quality", "الجودة", "Quality", "+12025550103", "", "", "المدينة التجريبية ٣", "Demo City 3"],
];
for (const s of seed) await call("POST", "/api/admin/employees", { id: s[0], name_ar: s[1], name_en: s[2], title_ar: s[3], title_en: s[4], department: s[5], dept_ar: s[6], dept_en: s[7], phone: s[8], whatsapp: s[9], email: s[10], location_ar: s[11], location_en: s[12] }, tok);
await call("POST", "/api/admin/employees/SMT-003/deactivate", undefined, tok);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png" };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (u.pathname.startsWith("/api/") || u.pathname === "/health") {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await worker.fetch(new Request("http://localhost:" + PORT + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (u.pathname === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end('window.SIMTA_CONFIG={API_BASE:"",CARD_BASE_URL:""};'); }
  const f = path.join(root, u.pathname === "/" ? "index.html" : u.pathname);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": mime[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log("dev server on " + PORT));
