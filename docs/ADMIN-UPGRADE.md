# SIMTA Smart Cards: admin platform upgrade (branch `simta-admin-upgrade`)

## Status
- Built and tested LOCALLY only. Committed on the local branch `simta-admin-upgrade`; NOT pushed to GitHub (a Cloudflare Pages project may build pushed branches as preview deployments, and no deployment was authorised). The commit hash is stated in the delivery report that accompanies this file (a file cannot contain the hash of the commit that contains it).
- `main` and the live Pages site were not modified; no deployment, Cloudflare setting or DNS change was made. The live `index.html` is unchanged. All new work is additive.

## Files added
- `admin.html` + `admin.js`: admin dashboard (AR/EN, RTL/LTR, responsive).
- `card.html` + `card.js`: new public employee card, reads from the API. Same SIMTA design as `index.html`, plus department row, share button, better vCard.
- `config.js`: public runtime config (`API_BASE`, optional `CARD_BASE_URL`). No secrets.
- `assets/qrcode.js`: vendored `qrcode-generator` 1.x (MIT, Kazuhiko Arase) so QR codes are generated in the browser with no CDN.
- `worker/src/index.js`: Cloudflare Worker API (D1).
- `worker/migrations/0001_init.sql`: D1 schema.
- `worker/wrangler.toml`: staging config template with PLACEHOLDERS (not deployed).
- `worker/scripts/preflight.sql`: read-only check to run before the migration.
- `worker/test/*`: tests (mock D1, workerd/Miniflare, browser E2E), a mock D1 adapter, a local dev server and saved test output.
- `worker/package.json`, `.gitignore`, `docs/ADMIN-UPGRADE.md`.

## Features
Dashboard: totals, active/inactive, with-photo, by-department, recent changes. Employees: search (ID, Arabic/English name, department, job title), status filter, sorting (ID, name, department, job title, last updated; ascending/descending; name/department/title sort in the current UI language), paging, add, edit (ID is immutable), deactivate/reactivate (soft delete, no hard delete endpoint), photo upload (resized to 512 px JPEG in the browser, validated again on the server), card preview (real card in an iframe), per-employee QR (SVG/PNG download, verified by decoding), copy card URL, audit-log tab (admin only), AR/EN switch with RTL/LTR. Card page: photo, name, title, department, phone, WhatsApp, email, location, vCard, share (Web Share, falls back to copy link), unique URL `card.html?id=SMT-001`. Extra future fields: the `extra` JSON column (up to 20 text keys) plus a form box for it.

## Database (D1), migration 0001
`employees` (all requested fields + `active`, `deactivated_at`, `photo_version`, `extra` JSON, created/updated by and at), `employee_photos` (base64, <=300 KB), `users` (admin/editor/viewer, PBKDF2 hash + salt), `sessions` (SHA-256 of token), `audit_log`, `login_attempts`. The migration deliberately uses plain `CREATE TABLE` (no `IF NOT EXISTS`): if any of these tables already exists, the migration FAILS instead of silently skipping it (tested: an incompatible pre-existing `employees` table makes it fail with "already exists"). D1 records applied migrations, so it is not re-run. Run `worker/scripts/preflight.sql` first. The existing staging D1 schema was NOT seen, so compatibility with any existing table is unknown.

## API endpoints
Public (read-only): `GET /api/health` (alias `/health`), `GET /api/employees/:id` (one ACTIVE employee card; 404 for unknown OR deactivated), `GET /api/photos/:id` (active only). A card exposes only this allowlist: id, Arabic/English name and title, Arabic/English department name, phone, WhatsApp, email, Arabic/English location, photo_url, card_url. It never includes the department code, `extra`, active flag, timestamps, created/updated-by, audit or user data.
Session required (viewer or above): `GET /api/employees[?q=]` (directory/search, same allowlisted shape, active only). Change from what was observed on the existing staging Worker, where this path answered without credentials: a directory of every employee's phone/email is not needed by the public card, so it now needs a login. Individual cards stay public by ID by design (that is what the QR code opens); IDs like SMT-001 are sequential, so anyone can enumerate cards by guessing IDs. If that matters, use unguessable card slugs (not implemented).
Auth: `POST /api/setup` (first admin, needs `SETUP_TOKEN` secret, only while no users exist), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
Admin (Bearer token): `GET /api/admin/stats`, `GET|POST /api/admin/employees` (GET takes `q, status, department, sort, dir, limit, offset`; sort is an allowlist: id, name_ar, name_en, title_ar, title_en, dept_ar, dept_en, updated, created), `GET|PUT /api/admin/employees/:id`, `POST .../deactivate`, `POST .../reactivate`, `PUT|DELETE .../photo`, `GET /api/admin/audit` (admin), `GET|POST /api/admin/users`, `PUT /api/admin/users/:id` (admin). Errors are `{"error": "message", "code": "...", "details": {...}}`; the `error` string matches the shape the existing staging Worker returns.

## Authentication and security design (what it is, and what it is not)
- Method: email + password. Passwords hashed with PBKDF2-SHA256, 100,000 iterations (the Workers maximum), random 16-byte salt. Login returns a random 256-bit bearer token valid 8 hours. Only its SHA-256 is stored in D1. The token is kept in `sessionStorage` and sent in the `Authorization` header.
- No cookies are used, so classic CSRF does not apply; CORS is an exact-origin allowlist (`ALLOWED_ORIGINS`), no wildcard, and the allowed headers are `Authorization, Content-Type`. Browsers cannot read API responses from other origins.
- Bootstrap: no default password exists. The first admin is created once via `POST /api/setup` with a one-time `SETUP_TOKEN` secret that the owner sets with `wrangler secret put`. If the secret is absent the route is 404.
- Roles: viewer (read), editor (create/edit/deactivate/photo), admin (all + users + audit). Role is checked in code on every write route; the roles are server-side only.
- Brute force: 5 failed logins per email+IP per 15 minutes -> 429 (even for the right password during lockout). Failed and successful logins are audited. Constant-time compare; a hash is computed even for unknown users.
- Validation: ID `SMT-` + 3 to 6 digits (uppercased); phone/WhatsApp/email format; length caps; control chars and `<>` stripped; JSON only; 16 KB body cap; photo JPEG/PNG/WebP only, magic-byte check, 300 KB cap, never SVG. All SQL is parameterized; LIKE wildcards in search are escaped.
- Audit trail: create/update (with before/after), deactivate/reactivate, photo, logins, user changes. Passwords are never logged.
- Frontend: no secrets anywhere in HTML/JS; admin UI builds DOM with textContent (only the locally generated QR SVG uses innerHTML). `admin.html` and `card.html` carry a Content-Security-Policy meta tag: `default-src 'none'; script-src 'self'` (all scripts are external files, no inline handlers), `connect-src`/`img-src` limited to the page origin plus the staging API origin, `frame-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`. `style-src` still allows `'unsafe-inline'` (inline styles). A meta CSP cannot set `frame-ancestors`; clickjacking protection would need a response header (Pages `_headers`), not added. If the API origin changes, update the two meta tags. The old live files (`index.html`, `old.html`, `1-index.html`) have no CSP and were not touched.
LIMITS / NOT DONE:
- Cloudflare Access (the existing staging API's CORS header mentions `CF-Access-Jwt-Assertion`) is NOT implemented or verified here. If the owner puts Access in front of the admin, the Worker should additionally verify the Access JWT (signature, `aud`, `iss`). That is recommended defence in depth and is not coded.
- Bearer token in `sessionStorage` is readable by any XSS on the admin origin. Mitigated by textContent rendering and the CSP above (blocks inline/injected scripts, tested), not eliminated.
- Rate limiting is D1-based and per email+IP; it is not a replacement for Cloudflare WAF/Turnstile. An attacker can lock out one email from one IP only.
- No 2FA, no password reset flow, no user-management UI (API only), no email sending.
- Photos live in D1 as base64 (fine for ~300 KB each; R2 is better at scale).
- A public card exposes phone, WhatsApp, email and location of an ACTIVE employee (the purpose of a business card). Cards can be enumerated by guessing sequential IDs (see above).
- Not production-ready until: reviewed by the owner, deployed to staging and tested there, Access/WAF decision made, frame-ancestors header decided, backups/migration rehearsed.

## Tests performed (all LOCAL, except item 4)
1. `worker/test/api.test.mjs`: 88 checks against an in-memory SQLite stand-in for D1 (includes migration-fails-loudly and clean-apply checks). 88/88 pass.
2. `worker/test/api.workerd.test.mjs`: the same API checks (86) inside the real `workerd` runtime (Miniflare) with a real D1 binding, so PBKDF2/WebCrypto/D1 behave as on Cloudflare. 86/86 pass. This is a local emulator, not Cloudflare's network.
3. `worker/test/e2e.browser.mjs`: 67 headless-Chrome checks against the local dev server: login, wrong password, dashboard, AR/EN + RTL/LTR, search by ID/name/department/title, create (validation + duplicate), edit, photo upload, deactivate/reactivate, preview, QR download (decoded back to the right URL), vCard, share fallback, deactivated/unknown/invalid/missing ID -> not-found with no data shown, API down/500 -> error state with no data shown, mobile (390) / tablet (820) / desktop, no horizontal overflow, no JS errors, no broken local assets, no network request to any non-localhost host, CSP present, an injected inline script is blocked, no CSP violations, logout. 67/67 pass. Screenshots are in the delivery package.
4. Remote staging API: only requests to the existing Worker were GETs, one OPTIONS and one unauthenticated POST with an empty JSON body to /api/employees. Observed (only these): /api/health 200 {"ok":true,"service":"SIMTA Cards API","mode":"staging","database":"bound"}; GET /api/employees 200 []; GET /api/employees/SMT-001 and /SMT-999 404 {"error":"Employee not found"}; unauthenticated POST /api/employees, GET /api/admin/stats and GET /health 404 {"error":"Not found"}. This does not show that the database holds no rows, nor that other write, admin or authenticated routes do not exist: they were simply not found on the paths and methods tried without credentials. The existing Worker's source and schema were not seen, so field-name compatibility is unverified.
Run: `cd worker && npm i && npm test && npm run test:workerd`; E2E: `npm i playwright`, `node --no-warnings test/dev-server.mjs &`, `node test/e2e.browser.mjs`.

## Manual steps for the owner (nothing here has been done)
1. Decide where the Worker source lives. The existing staging Worker's source/wrangler config was not available; confirm this Worker may replace it or give me the source to merge.
2. Run the preflight first: `wrangler d1 execute <DB> --remote --file worker/scripts/preflight.sql`. Any row returned means a table already exists and migration 0001 will fail on purpose; inspect it (`PRAGMA table_info(employees)`) and plan a versioned migration instead.
3. Fill the placeholders in `worker/wrangler.toml` (database_name/id, ALLOWED_ORIGINS must include the exact origin that serves `admin.html` and `card.html`, CARD_BASE_URL).
4. `wrangler d1 migrations apply <DB> --remote`, `wrangler secret put SETUP_TOKEN`, `wrangler deploy` (staging only, with the owner's approval).
5. `POST /api/setup` once to create the first admin, then remove the `SETUP_TOKEN` secret.
6. A Cloudflare Pages project builds every pushed branch as a preview by default. Pushing this branch may trigger a preview deployment. Disable branch preview builds (Pages settings) or accept it before pushing.

## Test data
All tests, the local dev server and screenshots use fictional employees only (e.g. "Sara Sample", "Omar Demo", "Dina Mock"), `example.com` emails and phone numbers in the reserved fictional range +1 202 555 01xx. No real employee data is used anywhere in the new files. The legacy files (`index.html`, `old.html`, `1-index.html`) were preserved unchanged and still contain the existing live card data.

## Staging environment (isolated, created 2026-11-25)

Separate from production. Nothing here touches the production Pages deployment, its D1 database or its settings.

- Cloudflare account id: 1fb3e239109ca43652dae631bd5a43eb
- Worker: `simta-cards-staging-v2` at https://simta-cards-staging-v2.ehabrmcr7.workers.dev
- D1: `simta-cards-staging-db` (id c8f066ad-d564-4562-8aa0-eebaccaff168), migration `0001_init.sql` applied. Holds only fictional test data.
- Worker vars: ENVIRONMENT=staging, ALLOWED_ORIGINS and CARD_BASE_URL set to the Pages branch preview origin. Secret SETUP_TOKEN is set in the dashboard only (never committed).
- config.js API_BASE points at this Worker. CARD_BASE_URL is empty (same origin).
- The older Worker `simta-cards-staging-api` (account ea160894) is NOT used and has not been verified as isolated.
- The Pages Preview environment has no variables or bindings. Preview deployments of this branch are public pages.dev URLs.
- Before any production migration: take a D1 export or Time Travel bookmark, run `worker/scripts/preflight.sql`, then migrate. Compatibility with the existing production schema has not been verified.
