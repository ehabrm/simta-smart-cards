-- READ-ONLY preflight. Run before applying migration 0001 to an existing D1 database:
--   wrangler d1 execute <DB_NAME> --remote --file worker/scripts/preflight.sql
-- Expected for a clean install: zero rows from the first query. Any row means a table with that name already exists
-- and migration 0001 will refuse to run (by design). Inspect it with PRAGMA table_info(<name>) and plan a versioned migration.
SELECT name, type FROM sqlite_master
WHERE name IN ('employees','employee_photos','users','sessions','audit_log','login_attempts')
   OR name LIKE 'idx_employees_%' OR name LIKE 'idx_sessions_%' OR name LIKE 'idx_audit_%' OR name LIKE 'idx_login_%';
