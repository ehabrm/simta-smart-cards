# SIMTA smart cards

PRIMARY SITE: https://simta-smart-cards.pages.dev (this repo, branch main, auto-deployed by Cloudflare Pages).
All future changes to cards, admin and design go in THIS repo.

- `/` and `/?id=SMT-xxx`  public card (bare `/` defaults to SMT-001). Printed QR codes use this form.
- `/card.html?id=...`    same card page
- `qrcode.js` is the local QR generator used by the admin
- `/admin.html`          admin panel (cards, users, audit, Pause site / Resume site)
- API + database: Cloudflare Worker `simta-cards-prod` (https://simta-cards-prod.ehabrmcr7.workers.dev, D1 `simta-cards-prod-db`). Its source is `worker/src/index.js` in the branch `simta-admin-upgrade` (also pasted into the Worker in the Cloudflare dashboard). Worker vars ALLOWED_ORIGINS and CARD_BASE_URL must include this site's origin.
- One maintenance switch (admin overview) pauses every public card route.
- This is the only operational frontend. Rollback is git history / Cloudflare Pages deployment history; there is no second site.
- Legacy static pages (old index with demo cards, old.html) are kept in git history, tag `legacy-pre-unify` (commit cac2e7e), and are not served.
