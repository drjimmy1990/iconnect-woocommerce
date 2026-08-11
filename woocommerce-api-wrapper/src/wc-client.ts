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
const MAX_PAGE_CAP = 1000; // safety cap on total items fetched

/* ------------------------------------------------------------------ */
/* Client setup                                                       */
/* ------------------------------------------------------------------ */

const client: AxiosInstance = axios.create({
  baseURL: WC_URL,
  timeout: 30000,
  headers: {
    "User-Agent": USER_AGENT,
    Cookie: WC_COOKIE,
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization:
      "Basic " + Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64"),
  },
});

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
  return status >= 500;
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

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const config: AxiosRequestConfig = {
        method,
        url: path,
        params,
        data,
      };
      const res = await client.request<T>(config);

      // Origin challenges return HTML or a 4xx block (Cloudflare 403 [now
      // removed], SiteLock 409, mod_security 406). Retry until a real JSON body.
      if (CHALLENGE_STATUSES.includes(res.status) || !isJsonResponse(res.data)) {
        if (attempt < maxRetries - 1) {
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
      if (attempt < maxRetries - 1) {
        await sleep(RETRY_SLEEP_MS);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`Request failed after ${maxRetries} retries: ${method} ${path}`);
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
  if (doPaginate) {
    const result = await paginate<any>("products", params);
    return { data: result.items, headers: { "x-wp-total": String(result.total), "x-wp-totalpages": String(result.totalPages) } };
  }
  const res = await request<any[]>("get", "products", params);
  return { data: res.data, headers: res.headers };
}

/** Fetch a single product by ID. */
export async function getProduct(id: number) {
  const res = await request<any>("get", `products/${id}`);
  return res.data;
}

/** Fetch product categories. */
export async function getCategories(params: Record<string, any> = {}) {
  const res = await request<any[]>("get", "products/categories", params);
  return { data: res.data, headers: res.headers };
}

/** Fetch a single category by ID. */
export async function getCategory(id: number) {
  const res = await request<any>("get", `products/categories/${id}`);
  return res.data;
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
      if (order.order_key === query.order_key) return order;
    } catch {
      // fall through
    }
  }
  // Search by email or phone
  const search: Record<string, any> = { per_page: 10 };
  if (query.email) search.search = query.email;
  else if (query.phone) search.search = query.phone;
  const res = await request<any[]>("get", "orders", search);
  // If order_id was provided, filter matches
  if (query.order_id) {
    const match = res.data.find((o) => o.id === query.order_id);
    if (match) return match;
  }
  return res.data[0] || null;
}
