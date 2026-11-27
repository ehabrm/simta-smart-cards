// Shared runtime for tests that need raw SQL access. mock D1 by default, real workerd (Miniflare) with MODE=workerd.
// Returns { mode, mf, fetch(Request), q(sql) -> rows, x1(sql) -> run }.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
export async function makeRuntime(bindings) {
  if (process.env.MODE !== "workerd") {
    const worker = (await import("../src/index.js")).default; const { makeDB } = await import("./mock-d1.mjs");
    const db = makeDB(); const env = { DB: db, ...bindings };
    return { mode: "mock", mf: null, fetch: (req) => worker.fetch(req, env), q: async (sql) => db._raw.prepare(sql).all(), x1: async (sql, ...b) => db._raw.prepare(sql).run(...b) };
  }
  const { Miniflare } = await import("miniflare");
  const mf = new Miniflare({ modules: true, scriptPath: path.join(dir, "../src/index.js"), compatibilityDate: "2024-11-01", bindings, d1Databases: { DB: "simta-remember" } });
  const db = await mf.getD1Database("DB");
  for (const f of fs.readdirSync(path.join(dir, "../migrations")).sort()) for (const st of fs.readFileSync(path.join(dir, "../migrations", f), "utf8").replace(/^--.*$/gm, "").split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) await db.prepare(st).run();
  return { mode: "workerd", mf,
    fetch: async (req) => mf.dispatchFetch(req.url, { method: req.method, headers: Object.fromEntries(req.headers), body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text() }),
    q: async (sql) => (await db.prepare(sql).all()).results,
    x1: async (sql, ...b) => db.prepare(sql).bind(...b).run() };
}
