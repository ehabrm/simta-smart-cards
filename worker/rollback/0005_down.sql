-- ROLLBACK of 0005_remember_tokens.sql. Safe at any time: it only removes remembered-device credentials (users must sign in again). Deploy the previous Worker first or at the same time.
DROP TABLE IF EXISTS remember_tokens;
