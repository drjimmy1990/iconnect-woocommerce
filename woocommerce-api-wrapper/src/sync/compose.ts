/**
 * sync/compose.ts
 * ---------------
 * Builds the textual content and metadata object that the semantic
 * backend (A) consumes via POST /index.
 *
 * The HTTP contract requires:
 *   { id: string, content: string, metadata: object }
 *
 * A computes md5(content) and decides whether to re-embed. We must
 * therefore put everything searchable (name, desc, categories, brand,
 * attributes, sku) into `content`, and store structured fields in `metadata`.
 */

import { stripHtml } from "../trim.js";

/** Flatten a WooCommerce attributes array into a readable string. */
function flattenAttributes(attributes: any[]): string {
  if (!Array.isArray(attributes)) return "";
  return attributes
    .map((attr) => {
      const name = attr.name || "";
      const options = Array.isArray(attr.options)
        ? attr.options.join(", ")
        : attr.options || "";
      return `${name}: ${options}`;
    })
    .join(" ");
}

/**
 * Build the text content for embedding from a WC product.
 * This is the "document" that the semantic backend will embed and search.
 */
export function buildContentForEmbedding(product: any): string {
  const parts: string[] = [];

  if (product.name) parts.push(product.name);
  if (product.short_description) parts.push(stripHtml(product.short_description));
  if (product.description) parts.push(stripHtml(product.description));

  // Category names
  const categoryNames: string[] = (product.categories || []).map(
    (c: any) => c.name,
  );
  if (categoryNames.length) parts.push(categoryNames.join(" "));

  // Brand from attributes
  const brandAttr = (product.attributes || []).find(
    (a: any) =>
      a.name?.toLowerCase() === "brand" || a.name?.includes("علامة"),
  );
  if (brandAttr) parts.push((brandAttr.options || []).join(" "));

  // All attributes
  parts.push(flattenAttributes(product.attributes || []));

  // SKU
  if (product.sku) parts.push(product.sku);

  return parts.filter(Boolean).join(" ").trim();
}

/**
 * Build the metadata object (stored as jsonb by the semantic backend,
 * returned by POST /search). Must match the contract shape.
 */
export function buildMetadata(product: any) {
  const categoryIds: number[] = (product.categories || []).map(
    (c: any) => Number(c.id),
  );
  const categoryNames: string[] = (product.categories || []).map(
    (c: any) => c.name,
  );

  let brand = "";
  for (const attr of product.attributes || []) {
    if (attr.name?.toLowerCase() === "brand" || attr.name?.includes("علامة")) {
      brand = (attr.options || []).join(", ");
      break;
    }
  }

  const images: string[] = (product.images || [])
    .map((img: any) => img?.src)
    .filter(Boolean);

  return {
    name: product.name || "",
    price: product.price || "0",
    regular_price: product.regular_price || "0",
    sale_price: product.sale_price || "",
    currency: "SAR",
    sku: product.sku || "",
    stock_status: product.stock_status || "instock",
    type: product.type || "simple",
    category_ids: categoryIds,
    category_names: categoryNames,
    brand,
    image_url: images[0] || "",
    permalink: product.permalink || "",
    date_modified: product.date_modified || "",
  };
}
