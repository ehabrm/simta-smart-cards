-- ROLLBACK of 0004_multi_company.sql. NOT applied automatically. Run only against a database that holds NO non-SIMTA data and after a backup.
-- Guard: fails (and changes nothing) if any non-SIMTA employee, non-SIMTA membership, or company-scoped setting exists.
DROP TABLE IF EXISTS temp.rollback_guard;
CREATE TEMP TABLE rollback_guard (n INTEGER CHECK (n = 0));
INSERT INTO rollback_guard SELECT (SELECT COUNT(*) FROM employees WHERE company_id<>1) + (SELECT COUNT(*) FROM user_companies WHERE company_id<>1) + (SELECT COUNT(*) FROM company_settings WHERE company_id<>1) + (SELECT COUNT(*) FROM companies WHERE id<>1) + (SELECT COUNT(*) FROM card_views WHERE company_id<>1);
DROP TRIGGER employees_company_prefix_ins;
DROP TRIGGER employees_company_immutable;
CREATE TABLE employees_old (
  id TEXT PRIMARY KEY CHECK (id GLOB 'SMT-[0-9][0-9][0-9]*'), name_ar TEXT NOT NULL, name_en TEXT NOT NULL, title_ar TEXT NOT NULL, title_en TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '', dept_ar TEXT NOT NULL DEFAULT '', dept_en TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL, whatsapp TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '', location_ar TEXT NOT NULL DEFAULT '', location_en TEXT NOT NULL DEFAULT '', photo_version INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), extra TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  deactivated_at TEXT, created_by TEXT, updated_by TEXT);
INSERT INTO employees_old SELECT id,name_ar,name_en,title_ar,title_en,department,dept_ar,dept_en,phone,whatsapp,email,location_ar,location_en,photo_version,active,extra,created_at,updated_at,deactivated_at,created_by,updated_by FROM employees;
CREATE TABLE employee_photos_old (employee_id TEXT PRIMARY KEY REFERENCES employees_old(id), mime TEXT NOT NULL, data_b64 TEXT NOT NULL, updated_at TEXT NOT NULL);
INSERT INTO employee_photos_old SELECT employee_id,mime,data_b64,updated_at FROM employee_photos;
DROP TABLE employee_photos;
DROP TABLE employees;
ALTER TABLE employees_old RENAME TO employees;
ALTER TABLE employee_photos_old RENAME TO employee_photos;
CREATE INDEX idx_employees_active ON employees(active);
CREATE INDEX idx_employees_dept ON employees(department);
-- Maintenance flag: copy SIMTA's current value back to the legacy global table so the old Worker sees the same state.
INSERT INTO settings (key,value,updated_at) SELECT key,value,updated_at FROM company_settings WHERE company_id=1 AND key='maintenance' ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
DROP TABLE company_settings;
DROP TABLE user_companies;
DROP INDEX idx_audit_company;
ALTER TABLE audit_log DROP COLUMN company_id;
ALTER TABLE users DROP COLUMN is_super;
ALTER TABLE card_views DROP COLUMN company_id;
DROP TABLE companies;
