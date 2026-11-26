-- QR system. Additive: two new tables, nothing existing is changed; old Worker versions ignore them.
-- employee_qr freezes the exact text encoded in each employee's QR code at the moment it is first made, so a later change of a base URL setting never changes a printed QR.
CREATE TABLE employee_qr (
  company_id  INTEGER NOT NULL,
  employee_id TEXT NOT NULL,
  qr_url      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (company_id, employee_id)
);
-- QR scan counts per day and employee. Only counters: no IP, user agent, cookie or visitor id.
CREATE TABLE qr_scans (
  day         TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  company_id  INTEGER NOT NULL,
  scans       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, employee_id)
);
CREATE INDEX idx_qr_scans_company ON qr_scans(company_id, day);
