-- SIMTA Cards: initial schema (Cloudflare D1 / SQLite)
-- Deliberately NO "IF NOT EXISTS": if any of these tables already exists (e.g. an older employees table with different columns)
-- the migration FAILS instead of silently skipping it. Run worker/scripts/preflight.sql first. D1 records applied migrations, so it will not re-run.
CREATE TABLE employees (
  id            TEXT PRIMARY KEY CHECK (id GLOB 'SMT-[0-9][0-9][0-9]*'),
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  title_ar      TEXT NOT NULL,
  title_en      TEXT NOT NULL,
  department    TEXT NOT NULL DEFAULT '',   -- internal department code, e.g. "sales"
  dept_ar       TEXT NOT NULL DEFAULT '',
  dept_en       TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL,
  whatsapp      TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  location_ar   TEXT NOT NULL DEFAULT '',
  location_en   TEXT NOT NULL DEFAULT '',
  photo_version INTEGER NOT NULL DEFAULT 0, -- 0 = no photo
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  extra         TEXT NOT NULL DEFAULT '{}', -- JSON object for future fields (no migration needed)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deactivated_at TEXT,
  created_by    TEXT,
  updated_by    TEXT
);
CREATE INDEX idx_employees_active ON employees(active);
CREATE INDEX idx_employees_dept ON employees(department);

CREATE TABLE employee_photos (
  employee_id TEXT PRIMARY KEY REFERENCES employees(id),
  mime        TEXT NOT NULL,
  data_b64    TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),
  salt       TEXT NOT NULL,
  pass_hash  TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,   -- SHA-256 of the bearer token; the token itself is never stored
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_exp ON sessions(expires_at);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL,
  user_id    INTEGER,
  user_email TEXT,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  changes    TEXT,
  ip         TEXT
);
CREATE INDEX idx_audit_ts ON audit_log(ts);

CREATE TABLE login_attempts (
  key TEXT NOT NULL,
  ts  INTEGER NOT NULL
);
CREATE INDEX idx_login_key ON login_attempts(key, ts);
