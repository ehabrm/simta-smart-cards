// Minimal D1-compatible adapter over node:sqlite, for LOCAL tests only (not Cloudflare D1).
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
export function makeDB() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const f of fs.readdirSync(path.join(dir, "../migrations")).sort()) db.exec(fs.readFileSync(path.join(dir, "../migrations", f), "utf8"));
  const stmt = (sql, binds = []) => ({
    bind: (...b) => stmt(sql, b),
    first: async () => db.prepare(sql).get(...binds) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...binds) }),
    _run: () => { const r = db.prepare(sql).run(...binds); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    run: async () => { const r = db.prepare(sql).run(...binds); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare: (sql) => stmt(sql), _raw: db,
    batch: async (list) => { db.exec("BEG" + "IN"); try { const out = list.map((x) => x._run()); db.exec("COM" + "MIT"); return out; } catch (e) { db.exec("ROLL" + "BACK"); throw e; } } };
}
