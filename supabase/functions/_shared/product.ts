/**
 * product.ts — WooCommerce product -> semantic document mapping (Deno, shared).
 * Mirrors woocommerce-api-wrapper/src/sync/compose.ts so the Edge Function
 * sync produces the same content_for_embedding + metadata shape as the Node backend.
 */

const stripHtml = (s = "") =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);

/** Compose the text blob that gets embedded (semantic meaning only — no price/stock). */
export function buildContentForEmbedding(p: any): string {
  const cats = (p.categories || [])
    .map((c: any) => (typeof c === "object" ? c.name || "" : c))
    .join(" ");
  const attrs = Object.entries(p.attributes || {})
    .map(([k, v]: any) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
    .join(" ");
  return [
    p.name || "",
    stripHtml(p.short_description || p.description || ""),
    cats,
    p.brand || "",
    attrs,
    p.sku || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Metadata stored as jsonb and returned by search (compact product fields). */
export function buildMetadata(p: any) {
  return {
    name: p.name,
    price: p.price,
    regular_price: p.regular_price,
    sale_price: p.sale_price,
    currency: "SAR",
    sku: p.sku,
    stock_status: p.stock_status,
    type: p.type,
    category_ids: (p.categories || [])
      .map((c: any) => (typeof c === "object" ? c.id : c))
      .filter(Boolean),
    category_names: (p.categories || []).map((c: any) =>
      typeof c === "object" ? c.name || "" : c
    ),
    brand: p.brand || null,
    image_url: p.images?.[0]?.src || null,
    permalink: p.permalink,
    date_modified: p.date_modified,
  };
}
