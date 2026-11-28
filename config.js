// Runtime configuration for card.html and admin.html (public values only, never secrets).
// API_BASE: origin of the SIMTA Cards API Worker, no trailing slash.
window.SIMTA_CONFIG = {
  API_BASE: "https://eanova-cards-prod.ehabrmcr7.workers.dev",
  // Public base URL used to build card links/QR codes in the admin dashboard.
  // Empty = same origin as the admin page.
  CARD_BASE_URL: "https://simta-smart-cards.pages.dev/card.html"
};
