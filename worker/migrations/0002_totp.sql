-- SIMTA Cards: optional two-factor sign-in (TOTP) for admin users. Adds columns only; no data is changed.
-- totp_secret holds the secret ENCRYPTED with the Worker secret TOTP_KEY (AES-GCM); it is NULL until a user starts 2FA setup.
-- totp_last_step is the last accepted 30-second step, so a code cannot be reused.
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0 CHECK (totp_enabled IN (0,1));
ALTER TABLE users ADD COLUMN totp_last_step INTEGER NOT NULL DEFAULT 0;
