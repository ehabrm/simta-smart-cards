-- Remembered-device credentials for the admin (opt-in "remember this device"). Additive: one new table, nothing existing is changed, old Worker versions ignore it.
-- Only the SHA-256 of a random 256-bit token is stored. Each use rotates the token (family stays the same); a rotated token shown again after a short grace revokes the whole family.
-- expires_at slides (30 days from last use); abs_expires_at is the 90-day cap from the password(+2FA) login that started the family.
CREATE TABLE remember_tokens (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash     TEXT NOT NULL UNIQUE,
  family         TEXT NOT NULL,
  user_id        INTEGER NOT NULL,
  created_at     TEXT NOT NULL,
  last_used_at   TEXT NOT NULL,
  expires_at     TEXT NOT NULL,
  abs_expires_at TEXT NOT NULL,
  rotated_at     TEXT
);
CREATE INDEX idx_remember_user ON remember_tokens(user_id);
CREATE INDEX idx_remember_family ON remember_tokens(family);
