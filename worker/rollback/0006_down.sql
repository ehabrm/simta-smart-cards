-- Rollback of 0006: removes the QR tables (employees and cards are untouched; QR codes are regenerated from the card URL when needed).
DROP INDEX IF EXISTS idx_qr_scans_company;
DROP TABLE IF EXISTS qr_scans;
DROP TABLE IF EXISTS employee_qr;
