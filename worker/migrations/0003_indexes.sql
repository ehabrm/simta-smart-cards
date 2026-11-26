-- SIMTA Cards: extra indexes for the session, audit and login-attempt queries. Additive only: no table or row is changed.
-- IF NOT EXISTS makes it safe to run twice. Apply with: wrangler d1 migrations apply (staging first).
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_action ON audit_log(user_id, action, ts);
CREATE INDEX IF NOT EXISTS idx_login_ts ON login_attempts(ts);
