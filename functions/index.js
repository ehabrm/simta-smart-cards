// Approved by owner 2026-11-25: route printed QR SMT-001 to new card. Rollback: delete this file.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const id = (url.searchParams.get("id") || "").trim();
  if (id.toUpperCase() === "SMT-001") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "https://simta-cards-prod.pages.dev/card.html?id=SMT-001",
        "Cache-Control": "no-store"
      }
    });
  }
  return context.next();
}
