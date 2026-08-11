/**
 * trim.ts
 * -------
 * Mappers that trim WooCommerce REST API responses into clean shapes
 * suitable for n8n consumption and for the semantic backend metadata.
 */

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */

/** Strip HTML tags and decode common entities. */
export function stripHtml(html: string): string {
  if (!html) return "";
  let text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, "...")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

/** Truncate text to maxLen, appending ellipsis if truncated. */
function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

/** Mask an email for privacy (user@domain -> u***@domain). */
function maskEmail(email?: string): string | null {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const maskedUser = user.length > 1 ? user[0] + "***" : "***";
  return `${maskedUser}@${domain}`;
}

/* ------------------------------------------------------------------ */
/* Trimmed response shapes (what n8n sees)                            */
/* ------------------------------------------------------------------ */

/** Trim a WooCommerce product into a clean response object. */
export function trimProduct(wcProduct: any) {
  const images: string[] = (wcProduct.images || [])
    .map((img: any) => img?.src)
    .filter(Boolean);

  const categoryIds: number[] = (wcProduct.categories || []).map(
    (c: any) => c.id,
  );
  const categoryNames: string[] = (wcProduct.categories || []).map(
    (c: any) => c.name,
  );

  // Brand is often stored as an attribute named "Brand" or "العلامة التجارية"
  let brand = "";
  const attrs: Record<string, any> = {};
  for (const attr of wcProduct.attributes || []) {
    const name = attr.name || "";
    const value = (attr.options || []).join(", ");
    attrs[name] = value;
    if (
      !brand &&
      (name.toLowerCase() === "brand" || name.includes("علامة"))
    ) {
      brand = value;
    }
  }

  return {
    id: wcProduct.id,
    name: wcProduct.name || "",
    price: wcProduct.price || "0",
    regular_price: wcProduct.regular_price || "0",
    sale_price: wcProduct.sale_price || "",
    currency: "SAR",
    sku: wcProduct.sku || "",
    stock_status: wcProduct.stock_status || "instock",
    type: wcProduct.type || "simple",
    status: wcProduct.status || "publish",
    image_url: images[0] || "",
    // All gallery image URLs. The bot's product_details intent sends these to the
    // customer; image_url is kept as the single "main" image for back-compat.
    images,
    permalink: wcProduct.permalink || "",
    category_ids: categoryIds,
    category_names: categoryNames,
    brand,
    attributes: attrs,
    short_desc: truncate(stripHtml(wcProduct.short_description || ""), 140),
  };
}

/** Trim a WooCommerce order into a clean response object. */
export function trimOrder(wcOrder: any) {
  return {
    id: wcOrder.id,
    status: wcOrder.status || "",
    total: wcOrder.total || "0",
    currency: wcOrder.currency || "SAR",
    payment_method: wcOrder.payment_method || "",
    payment_method_title: wcOrder.payment_method_title || "",
    customer_note: wcOrder.customer_note || "",
    date_created: wcOrder.date_created || "",
    order_key: wcOrder.order_key || "",
    billing: {
      first_name: wcOrder.billing?.first_name || "",
      phone: wcOrder.billing?.phone || "",
      email: maskEmail(wcOrder.billing?.email),
    },
    line_items: (wcOrder.line_items || []).map((item: any) => ({
      product_id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      total: item.total,
    })),
  };
}

/** Trim a WooCommerce product category. */
export function trimCategory(wcCategory: any) {
  return {
    id: wcCategory.id,
    name: wcCategory.name || "",
    slug: wcCategory.slug || "",
    parent: wcCategory.parent || 0,
    count: wcCategory.count || 0,
    image: wcCategory.image?.src || null,
  };
}

/** Trim a WooCommerce payment gateway. */
export function trimPaymentGateway(wcGateway: any) {
  return {
    id: wcGateway.id,
    title: wcGateway.title || "",
    enabled: wcGateway.enabled === "yes",
  };
}

/** Trim a WooCommerce shipping zone. */
export function trimShippingZone(wcZone: any) {
  return {
    id: wcZone.id,
    zone_name: wcZone.zone_name || "",
    zone_order: wcZone.zone_order || 0,
    zone_locations: wcZone.zone_locations || [],
  };
}

/** Trim a WooCommerce shipping zone method. */
export function trimShippingMethod(wcMethod: any) {
  return {
    id: wcMethod.instance_id,
    method_id: wcMethod.method_id || "",
    title: wcMethod.title || "",
    enabled: wcMethod.enabled === "yes",
    settings: wcMethod.settings || {},
  };
}
