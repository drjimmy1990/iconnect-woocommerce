/**
 * wc-client.ts
 * ------------
 * Axios-based WooCommerce REST API client.
 *
 * - Base URL, Basic Auth, and browser User-Agent come from env.
 * - Cloudflare intermittently challenges requests; the request() wrapper
 *   retries up to 8 times (2s sleep) until it receives a JSON body
 *   (starts with `[` or `{`). HTML/challenge pages or 403 are retried.
 * - paginate() reads X-WP-Total / X-WP-TotalPages to fetch all pages.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

const WC_URL = process.env.WC_URL || "https://iconnect-intl.com/store/wp-json/wc/v3";
const WC_KEY = process.env.WC_KEY || "";
const WC_SECRET = process.env.WC_SECRET || "";
const USER_AGENT =
  process.env.USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
// The origin (Apache/SiteLock) gates requests behind a JS challenge that sets
// this cookie and reloads. curl/axios can't run the JS, so we send it up-front
// to avoid the intermittent 409 "humans_21909" reload challenge.
const WC_COOKIE = process.env.WC_COOKIE || "humans_21909=1";

const MAX_RETRIES = 8;
const RETRY_SLEEP_MS = 2000;
/**
 * Statuses that mean "the origin blocked us", not "your request was wrong".
 * Only these (plus 429/5xx/network errors) are worth retrying — see shouldRetry().
 */
const CHALLENGE_STATUSES = [403, 406, 409];
const MAX_PAGE_CAP = Number(process.env.MAX_PAGE_CAP) || 50000; // safety cap on total items fetched

/**
 * Hard wall-clock ceiling for one request() call, retries included.
 *
 * Retry count alone is not a time bound: 8 attempts x a 30s socket timeout is
 * 4+ minutes, during which an n8n tool call just hangs and the customer gets
 * silence. The deadline makes the worst case predictable no matter how the
 * origin misbehaves. Retries still happen — they just have to fit inside it.
 *
 * ATTEMPT_TIMEOUT_MS is per-attempt; it is clamped down further so the last
 * attempt cannot overshoot the deadline. Both are env-tunable because the
 * bulk indexer is more patient than a live chat lookup.
 */
const DEADLINE_MS = Number(process.env.WC_DEADLINE_MS) || 25000;
const ATTEMPT_TIMEOUT_MS = Number(process.env.WC_ATTEMPT_TIMEOUT_MS) || 10000;

/* ------------------------------------------------------------------ */
/* Client setup                                                       */
/* ------------------------------------------------------------------ */

const client: AxiosInstance = axios.create({
  baseURL: WC_URL,
  timeout: 30000,
  params: {
    lang: "en", // WPML fix: prevents 500 fatal crash on Arabic REST requests
  },
  headers: {
    "User-Agent": USER_AGENT,
    Cookie: WC_COOKIE,
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization:
      "Basic " + Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64"),
  },
});

const WC_STORE_API_URL =
  process.env.WC_STORE_API_URL ||
  WC_URL.replace(/\/wc\/v[123]\/?$/, "/wc/store/v1");

const storeClient: AxiosInstance = axios.create({
  baseURL: WC_STORE_API_URL,
  timeout: 15000,
  headers: {
    "User-Agent": USER_AGENT,
    Cookie: WC_COOKIE,
    Accept: "application/json",
  },
});

export function normalizeStoreApiProduct(p: any) {
  const minorUnit = p.prices?.currency_minor_unit ?? 2;
  const divisor = Math.pow(10, minorUnit);
  const price = p.prices?.price ? (Number(p.prices.price) / divisor).toFixed(2) : "0";
  const regularPrice = p.prices?.regular_price ? (Number(p.prices.regular_price) / divisor).toFixed(2) : price;
  const salePrice =
    p.prices?.sale_price && p.prices.sale_price !== p.prices.regular_price
      ? (Number(p.prices.sale_price) / divisor).toFixed(2)
      : "";

  const attributes = (p.attributes || []).map((attr: any) => ({
    name: attr.name || "",
    options: (attr.terms || []).map((t: any) => t.name || ""),
  }));

  return {
    id: p.id,
    name: p.name || "",
    price,
    regular_price: regularPrice,
    sale_price: salePrice,
    currency: p.prices?.currency_code || "SAR",
    sku: p.sku || "",
    stock_status: p.is_in_stock ? "instock" : "outofstock",
    type: p.type || "simple",
    status: "publish",
    permalink: p.permalink || "",
    images: (p.images || []).map((img: any) => ({ src: img.src || img.thumbnail })),
    categories: (p.categories || []).map((c: any) => ({ id: c.id, name: c.name })),
    attributes,
    short_description: p.short_description || "",
    description: p.description || "",
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** True when the response body looks like JSON (starts with `[` or `{`). */
function isJsonResponse(data: unknown): boolean {
  if (typeof data === "object") return true;
  if (typeof data === "string") {
    const trimmed = data.trimStart();
    return trimmed.startsWith("[") || trimmed.startsWith("{");
  }
  return false;
}

/**
 * Decide whether a thrown request error is worth another attempt.
 *
 * Retrying a 404/400 is pure latency: WooCommerce will answer identically every
 * time. With MAX_RETRIES=8 and a 30s axios timeout, blindly retrying made one
 * bad product ID hang for up to 8*30s + 7*2s = 254s, which stalled the n8n AI
 * agent's tool call indefinitely. Only origin blocks, rate limits, server
 * errors and network faults are retried.
 */
function shouldRetry(err: any): boolean {
  const status = err?.response?.status;
  if (status === undefined) return true; // network error / timeout — no response at all
  if (CHALLENGE_STATUSES.includes(status)) return true;
  if (status === 429) return true;

  // Check if WordPress threw a PHP fatal error (JSON { code: "internal_server_error" } or HTML)
  const dataStr =
    typeof err?.response?.data === "object"
      ? JSON.stringify(err.response.data)
      : String(err?.response?.data || "");
  if (
    dataStr.includes("wp-die-message") ||
    dataStr.includes("خطأ فادح") ||
    dataStr.includes("internal_server_error")
  ) {
    return false; // Do not retry fatal PHP crashes!
  }

  // Do NOT retry 500 Internal Server Error (PHP fatal crashes on origin).
  // Only retry transient 502/503/504 gateway issues.
  if (status === 500) return false;

  return status > 500;
}

/**
 * Core request wrapper with Cloudflare retry-until-JSON logic.
 * On each attempt: if we get HTML / 403 / non-JSON, sleep and retry.
 * Resolves on first JSON response.
 */
export async function request<T = any>(
  method: "get" | "post" | "put" | "delete",
  path: string,
  params?: Record<string, any>,
  data?: any,
  _opts: { retry?: number } = {},
): Promise<AxiosResponse<T>> {
  const maxRetries = _opts.retry ?? MAX_RETRIES;
  let lastError: unknown;
  const startedAt = Date.now();
  const timeLeft = () => DEADLINE_MS - (Date.now() - startedAt);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const remaining = timeLeft();
    if (remaining <= 0) break;

    try {
      const config: AxiosRequestConfig = {
        method,
        url: path,
        params: { lang: "en", ...params },
        data,
        // Never let a single attempt run past the overall deadline.
        timeout: Math.min(ATTEMPT_TIMEOUT_MS, remaining),
      };
      const res = await client.request<T>(config);

      // Origin challenges return HTML or a 4xx block (Cloudflare 403 [now
      // removed], SiteLock 409, mod_security 406). Retry until a real JSON body.
      if (CHALLENGE_STATUSES.includes(res.status) || !isJsonResponse(res.data)) {
        if (attempt < maxRetries - 1 && timeLeft() > RETRY_SLEEP_MS) {
          await sleep(RETRY_SLEEP_MS);
          continue;
        }
      }
      return res;
    } catch (err: any) {
      lastError = err;
      // Axios throws on non-2xx. A 404/400 is a final answer — surface it now
      // instead of sleeping through 8 attempts (see shouldRetry).
      if (!shouldRetry(err)) break;
      // A silent retry loop is invisible in `docker compose logs` — which is
      // exactly what made a stalled origin so hard to diagnose.
      console.warn(
        `[wc] retry ${attempt + 1}/${maxRetries} ${method} ${path} — ` +
          `${err?.code || err?.response?.status || err?.message} ` +
          `(${timeLeft()}ms of budget left)`,
      );
      // Don't burn the remaining budget on a sleep we can't follow with a try.
      if (attempt < maxRetries - 1 && timeLeft() > RETRY_SLEEP_MS) {
        await sleep(RETRY_SLEEP_MS);
        continue;
      }
      break;
    }
  }

  const elapsed = Date.now() - startedAt;
  throw (
    lastError ??
    new Error(
      `Request failed after ${elapsed}ms (deadline ${DEADLINE_MS}ms): ${method} ${path}`,
    )
  );
}

/**
 * Paginate a WC list endpoint using X-WP-Total / X-WP-TotalPages.
 * Returns all items up to a cap.
 */
export async function paginate<T = any>(
  path: string,
  params: Record<string, any> = {},
): Promise<{ items: T[]; total: number; totalPages: number }> {
  const perPage = Math.min(Number(params.per_page) || 50, 100);
  let page = 1;
  const items: T[] = [];
  let total = 0;
  let totalPages = 1;

  while (page <= totalPages && items.length < MAX_PAGE_CAP) {
    const res = await request<T[]>("get", path, {
      ...params,
      per_page: perPage,
      page,
    });
    items.push(...(res.data as T[]));
    total = Number(res.headers["x-wp-total"]) || items.length;
    totalPages = Number(res.headers["x-wp-totalpages"]) || 1;
    page++;
  }

  // Trim to cap
  return { items: items.slice(0, MAX_PAGE_CAP), total, totalPages };
}

/* ------------------------------------------------------------------ */
/* Public WC API wrappers                                             */
/* ------------------------------------------------------------------ */

/** Fetch products (list) with optional filters. */
export async function getProducts(
  params: Record<string, any> = {},
  doPaginate = false,
): Promise<{ data: any[]; headers: any }> {
  // If paginating (e.g. delta-sync or bulk crawl), we try Classic API v3 because Store API doesn't support modified_after
  if (doPaginate) {
    try {
      const result = await paginate<any>("products", params);
      return { data: result.items, headers: { "x-wp-total": String(result.total), "x-wp-totalpages": String(result.totalPages) } };
    } catch (err: any) {
      console.warn(`[wc] Classic API getProducts(doPaginate) failed:`, err?.message || err);
      throw err;
    }
  }

  // For regular queries (search, category, list), try Store API first (fast & reliable, avoids WP 500 fatal errors)
  try {
    const storeParams: Record<string, any> = {};
    if (params.search) storeParams.search = params.search;
    if (params.category) storeParams.category = params.category;
    // Cap per_page to 12 max to prevent WordPress memory exhaustion / 500 fatal errors
    const requestedPerPage = Number(params.per_page) || 10;
    storeParams.per_page = Math.min(requestedPerPage, 12);
    if (params.page) storeParams.page = params.page;
    if (params.orderby) storeParams.orderby = params.orderby;
    if (params.order) storeParams.order = params.order;

    const storeRes = await storeClient.get<any[]>("products", { params: storeParams });
    const normalized = (storeRes.data || []).map(normalizeStoreApiProduct);
    return { data: normalized, headers: storeRes.headers || {} };
  } catch (storeErr: any) {
    console.warn(`[wc] Store API getProducts failed (${storeErr?.message || storeErr}). Trying Classic API v3 fallback...`);
    const res = await request<any[]>("get", "products", { ...params, per_page: Math.min(Number(params.per_page) || 10, 12) }, undefined, { retry: 1 });
    return { data: res.data, headers: res.headers };
  }
}

/** Fetch a single product by ID. */
export async function getProduct(id: number) {
  try {
    const storeRes = await storeClient.get<any>(`products/${id}`);
    return normalizeStoreApiProduct(storeRes.data);
  } catch (storeErr: any) {
    console.warn(`[wc] Store API getProduct(${id}) failed (${storeErr?.message || storeErr}). Trying Classic API v3 fallback...`);
    const res = await request<any>("get", `products/${id}`, undefined, undefined, { retry: 1 });
    return res.data;
  }
}

/** Fetch product categories. */
export async function getCategories(params: Record<string, any> = {}) {
  try {
    const storeRes = await storeClient.get<any[]>("products/categories", { params });
    return { data: storeRes.data, headers: storeRes.headers || {} };
  } catch (storeErr: any) {
    console.warn(`[wc] Store API getCategories failed (${storeErr?.message || storeErr}). Trying Classic API v3 fallback...`);
    const res = await request<any[]>("get", "products/categories", params, undefined, { retry: 1 });
    return { data: res.data, headers: res.headers };
  }
}

/** Fetch a single category by ID. */
export async function getCategory(id: number) {
  try {
    const storeRes = await storeClient.get<any>(`products/categories/${id}`);
    return storeRes.data;
  } catch (storeErr: any) {
    console.warn(`[wc] Store API getCategory(${id}) failed (${storeErr?.message || storeErr}). Trying Classic API v3 fallback...`);
    const res = await request<any>("get", `products/categories/${id}`, undefined, undefined, { retry: 1 });
    return res.data;
  }
}

/** Fetch product attributes. */
export async function getAttributes(params: Record<string, any> = {}) {
  const res = await request<any[]>("get", "products/attributes", params);
  return res.data;
}

/** Fetch payment gateways. */
export async function getPaymentGateways() {
  const res = await request<any[]>("get", "payment_gateways");
  return res.data;
}

/** Fetch shipping zones. */
export async function getShippingZones() {
  const res = await request<any[]>("get", "shipping/zones");
  return res.data;
}

/** Fetch shipping methods for a zone. */
export async function getShippingZoneMethods(zoneId: number) {
  const res = await request<any[]>("get", `shipping/zones/${zoneId}/methods`);
  return res.data;
}

/** Fetch orders (list). */
export async function getOrders(params: Record<string, any> = {}) {
  const res = await request<any[]>("get", "orders", params);
  return { data: res.data, headers: res.headers };
}

/** Fetch a single order by ID. */
export async function getOrder(id: number) {
  const res = await request<any>("get", `orders/${id}`);
  return res.data;
}

/** Create an order. */
export async function createOrder(data: Record<string, any>) {
  const res = await request<any>("post", "orders", undefined, data);
  return res.data;
}

/** Track an order by order_id + order_key, or by email + phone. */
export async function trackOrder(query: {
  order_id?: number;
  order_key?: string;
  email?: string;
  phone?: string;
}) {
  // Try by order_id + order_key first
  if (query.order_id && query.order_key) {
    try {
      const order = await getOrder(query.order_id);
      if (order && (!query.order_key || order.order_key === query.order_key)) return order;
    } catch {
      // fall through
    }
  }
  // Search by email or phone
  const search: Record<string, any> = { per_page: 10, lang: "en" };
  if (query.email) search.search = query.email;
  else if (query.phone) search.search = query.phone;

  try {
    const res = await request<any[]>("get", "orders", search);
    const list = Array.isArray(res.data) ? res.data : [];
    // If order_id was provided, filter matches
    if (query.order_id) {
      const match = list.find((o) => o.id === query.order_id);
      if (match) return match;
    }
    // If phone was provided, try fuzzy match on billing phone digits
    if (query.phone && list.length > 0) {
      const cleanPhone = query.phone.replace(/\D/g, "");
      if (cleanPhone.length >= 6) {
        const match = list.find((o) => {
          const orderPhone = (o.billing?.phone || "").replace(/\D/g, "");
          return orderPhone && (orderPhone.includes(cleanPhone) || cleanPhone.includes(orderPhone));
        });
        if (match) return match;
      }
    }
    return list[0] || null;
  } catch (err: any) {
    console.warn(`[wc] trackOrder search failed:`, err?.message || err);
    return null;
  }
}
