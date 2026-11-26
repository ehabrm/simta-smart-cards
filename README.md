# SIMTA smart cards

Primary site: https://simta-smart-cards.pages.dev (this repo, branch `main`, auto-deployed by Cloudflare Pages project `simta-smart-cards`). All changes go here.

## Pages
- `/` and `/?id=SMT-xxx`: public card. Bare `/` defaults to SMT-001. Printed QR codes use the `/?id=` form.
- `/card.html?id=...`: same card page.
- `/admin.html`: admin panel (cards, users, audit log, pause/resume site).
- `qrcode.js`: local QR generator used by the admin.
- `worker/`: API source (no secrets in it). /_redirects tries to send /worker/* to the card page; if Pages still serves those files that is source only, not a card page.

## API and data
Cloudflare Worker `simta-cards-prod` with D1 `simta-cards-prod-db`
(https://simta-cards-prod.ehabrmcr7.workers.dev). Source: `worker/src/index.js`.
Dashboard vars: `ALLOWED_ORIGINS=https://simta-smart-cards.pages.dev`, `CARD_BASE_URL=https://simta-smart-cards.pages.dev/card.html`.
Migrations: `worker/migrations`. Tests: `cd worker && npm i && npm test` (mock D1) and `npm run test:workerd`.

## One control
The pause switch in the admin overview is a single flag in D1. When on, every card route shows
"the site is under maintenance" (API returns 503 `maintenance`). A card that was deleted shows a
different message ("this card does not exist or has been deleted", API 404). There is no other frontend.

## Rollback (all within this canonical domain)
- Frontend: Cloudflare Pages > simta-smart-cards > Deployments > pick the older good deployment > Rollback, or `git revert <commit>` on main and push (auto-deploys).
- Worker: Workers > simta-cards-prod > Deployments, roll back to the previous version (e.g. d1c09ba0 is the version before the maintenance code), or paste `worker/src/index.js` from an earlier commit into the editor and Deploy.
- Worker vars must keep `ALLOWED_ORIGINS` and `CARD_BASE_URL` pointing at https://simta-smart-cards.pages.dev. Do not point them at any other domain.
- Legacy static pages (old demo cards) are only in git history (commit cac2e7e) and are intentionally not served. Do not restore them: they would bypass the admin control.

## Employee delete and visit stats

- Delete: `DELETE /api/admin/employees/:id` (admin role only). The body must be `{"confirm":"<EMPLOYEE_ID>"}`, otherwise the API returns 422 `confirmation_required`. The record and photo are removed, an audit row is written, and the public card then returns the "missing or deleted" page. The admin UI asks the admin to type the ID first.
- Visit stats (admin dashboard): "views" are successful opens of an active card. "Browsers" is an approximate, self-reported count per day (never people, never summed across days). Previews, bots, missing and maintenance responses are not counted. No IP, user agent or visitor ID is stored. Counts are buffered per Worker isolate and flushed at most once per `VIEWS_FLUSH_SECONDS` (default 60), so they can undercount. Analytics errors never affect cards or the admin.
- Rate limiting: the request limiter is an in-memory, per-isolate counter (card 60, auth 20, api 300 per IP per minute), so it is best effort and not a global limit. The login brute-force limit is stored in D1 and is shared.
