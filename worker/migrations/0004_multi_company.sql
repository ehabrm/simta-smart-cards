-- SIMTA/FALCOM central admin: multi-company isolation. Additive for old Worker versions: every new column has a default that maps to SIMTA (company 1).
-- Applied as ONE transaction by the runner (D1 wraps a migration file); staging first. Rollback: rollback/0004_down.sql (refuses if non-SIMTA data exists).
CREATE TABLE companies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z][a-z0-9-]*'),
  prefix          TEXT NOT NULL UNIQUE CHECK (prefix GLOB '[A-Z][A-Z][A-Z]'),
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  card_base_url   TEXT NOT NULL DEFAULT '',   -- text placed before "?id=", used verbatim; '' = fall back to the CARD_BASE_URL variable (SIMTA only)
  allowed_origins TEXT NOT NULL DEFAULT '',   -- comma-separated exact origins allowed to call the API for this company's public card pages
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at      TEXT NOT NULL
);
INSERT INTO companies (id,slug,prefix,name_ar,name_en,created_at) VALUES (1,'simta','SMT','سيمتا','SIMTA','2026-11-25T00:00:00.000Z');

CREATE TABLE employees_v2 (
  id            TEXT PRIMARY KEY CHECK (id GLOB '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9]*'),
  company_id    INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  title_ar      TEXT NOT NULL,
  title_en      TEXT NOT NULL,
  department    TEXT NOT NULL DEFAULT '',
  dept_ar       TEXT NOT NULL DEFAULT '',
  dept_en       TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL,
  whatsapp      TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  location_ar   TEXT NOT NULL DEFAULT '',
  location_en   TEXT NOT NULL DEFAULT '',
  photo_version INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  extra         TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deactivated_at TEXT,
  created_by    TEXT,
  updated_by    TEXT
);
INSERT INTO employees_v2 (id,company_id,name_ar,name_en,title_ar,title_en,department,dept_ar,dept_en,phone,whatsapp,email,location_ar,location_en,photo_version,active,extra,created_at,updated_at,deactivated_at,created_by,updated_by)
  SELECT id,1,name_ar,name_en,title_ar,title_en,department,dept_ar,dept_en,phone,whatsapp,email,location_ar,location_en,photo_version,active,extra,created_at,updated_at,deactivated_at,created_by,updated_by FROM employees;
CREATE TABLE employee_photos_v2 (
  employee_id TEXT PRIMARY KEY REFERENCES employees_v2(id),
  mime        TEXT NOT NULL,
  data_b64    TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
INSERT INTO employee_photos_v2 (employee_id,mime,data_b64,updated_at) SELECT employee_id,mime,data_b64,updated_at FROM employee_photos;
DROP TABLE employee_photos;
DROP TABLE employees;
ALTER TABLE employees_v2 RENAME TO employees;
ALTER TABLE employee_photos_v2 RENAME TO employee_photos;
CREATE INDEX idx_employees_active ON employees(active);
CREATE INDEX idx_employees_dept ON employees(department);
CREATE INDEX idx_employees_company ON employees(company_id, active);
-- Database-level isolation guard: an employee id must carry the prefix of its company, and neither id nor company can ever change.
CREATE TRIGGER employees_company_prefix_ins BEFORE INSERT ON employees WHEN substr(NEW.id,1,3) IS NOT (SELECT prefix FROM companies WHERE id=NEW.company_id) BEGIN SELECT RAISE(ABORT,'employee id prefix does not match company'); END;
CREATE TRIGGER employees_company_immutable BEFORE UPDATE OF id, company_id ON employees WHEN NEW.id <> OLD.id OR NEW.company_id <> OLD.company_id BEGIN SELECT RAISE(ABORT,'employee id and company are immutable'); END;

-- Users: global login identity + per-company membership with its own role. is_super = platform owner (all companies, companies and users management).
ALTER TABLE users ADD COLUMN is_super INTEGER NOT NULL DEFAULT 0 CHECK (is_super IN (0,1));
CREATE TABLE user_companies (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  role       TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, company_id)
) WITHOUT ROWID;
CREATE INDEX idx_user_companies_company ON user_companies(company_id, active);
INSERT INTO user_companies (user_id,company_id,role,active,created_at) SELECT id,1,role,1,created_at FROM users;
-- Existing admins keep the power they already have (they could administer everything before): platform owners.
UPDATE users SET is_super=1 WHERE role='admin';

-- Audit: company scope. Existing rows are all SIMTA. NULL = platform-level event (visible to platform owners only).
ALTER TABLE audit_log ADD COLUMN company_id INTEGER;
UPDATE audit_log SET company_id=1;
CREATE INDEX idx_audit_company ON audit_log(company_id, id);

-- Settings per company (maintenance switch). The old global settings table is left untouched (old Worker compatibility); its maintenance value seeds SIMTA.
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE company_settings (
  company_id INTEGER NOT NULL REFERENCES companies(id),
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, key)
) WITHOUT ROWID;
INSERT INTO company_settings (company_id,key,value,updated_at) SELECT 1,key,value,updated_at FROM settings WHERE key='maintenance';

-- Visit counters per company (employee ids are globally unique; the column makes company filters and isolation checks direct).
CREATE TABLE IF NOT EXISTS card_views (day TEXT NOT NULL, employee_id TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, browsers INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, employee_id)) WITHOUT ROWID;
ALTER TABLE card_views ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1;
