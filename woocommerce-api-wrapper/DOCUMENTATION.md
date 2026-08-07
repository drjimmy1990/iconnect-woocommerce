# WooCommerce API Wrapper — Complete Documentation

> **Single source of truth for the `woocommerce-api-wrapper` backend.**
> Version 1.0.0 · Node ≥ 20 · TypeScript ES2022 / NodeNext

---

## 1. Overview

The **woocommerce-api-wrapper** (referred to as "B" in the system architecture) is a standalone Node.js/Express backend that sits between n8n (or any HTTP client) and a WooCommerce store, and between WooCommerce and the generic semantic backend ("A").

**What it is:**
- A WooCommerce REST API wrapper that proxies all WC endpoints with Cloudflare-resilient retry logic, browser User-Agent, and HTTP Basic Auth.
- A response trimmer that maps bloated WooCommerce JSON objects into clean, minimal shapes suitable for LLM/n8n consumption.
- A sync bridge that keeps the semantic backend's vector index fresh by pushing product content + metadata over HTTP (webhook-driven real-time, periodic delta-sync, and full bulk re-index).

**Why it exists:**
1. **Hides `ck_`/`cs_` keys** — WooCommerce consumer key/secret never leave this server. n8n calls this wrapper with no auth; the wrapper adds Basic Auth internally.
2. **Handles Cloudflare** — the WC store sits behind Cloudflare, which intermittently issues JS challenges or 403s. The wrapper retries up to 8 times until it receives a valid JSON body.
3. **Returns trimmed responses** — raw WC product objects can be huge; the wrapper maps them to compact shapes (price, SKU, images, categories, masked PII) that n8n workflows and LLMs can reason about cheaply.
4. **Keeps the semantic index fresh** — when a product is created/updated/deleted in WooCommerce, the wrapper pushes the change to backend A so search results stay current.

---

## 2. Architecture

```
┌──────┐        HTTP (no auth)        ┌─────────────────────┐    Basic Auth + Browser UA    ┌──────────────┐
│ n8n  │ ───────────────────────────▶│  this wrapper (B)   │ ────────────────────────────▶│ WooCommerce   │
│      │   GET /api/products etc.    │  Express :8081      │   GET/POST /wc/v3/...         │ (behind CF)   │
└──────┘                             │                     │ ◀── Cloudflare retry ─────── │               │
                                     │  ┌───────────────┐  │                               └──────────────┘
                                     │  │ wc-client.ts  │  │
                                     │  │ (retry ×8)    │  │
                                     │  └───────────────┘  │
                                     │  ┌───────────────┐  │
                                     │  │ trim.ts       │  │  (compact responses → n8n)
                                     │  └───────────────┘  │
                                     │  ┌───────────────┐  │
                                     │  │ sync/         │  │   POST /index {id,content,metadata}
                                     │  │  webhook.ts   │──┼──────────────────────────────▶┌──────────────┐
                                     │  │  delta-sync   │  │   DELETE /:id                  │ Semantic      │
                                     │  │  upsert.ts    │  │                                │ Backend (A)   │
                                     │  │  compose.ts   │  │                                │ :8080         │
                                     │  └───────────────┘  │                                └──────────────┘
                                     └─────────────────────┘
                                              ▲
                                              │ HMAC-SHA256 webhook
                                      ┌──────────────┐
                                      │ WooCommerce  │  (product.created/updated/deleted/restored)
                                      │ webhook POST │
                                      └──────────────┘
```

**Where the key mechanisms live:**
- **Cloudflare retry** — `src/wc-client.ts`, `request()` function: 8 attempts, 2s sleep, `isJsonResponse()` check, 403 handling.
- **Keys (Basic Auth)** — `src/wc-client.ts`: `WC_KEY`/`WC_SECRET` read from env, Base64-encoded into the `Authorization` header of the Axios client. Never exposed to n8n.
- **HMAC webhook verification** — `src/sync/webhook.ts`: `verifySignature()` uses `WC_WEBHOOK_SECRET` to HMAC-SHA256 the raw body and compare with `X-Wc-Webhook-Signature` using `crypto.timingSafeEqual`.

**Cloudflare-free paths:**
- n8n → B (this wrapper): no Cloudflare.
- B → A (semantic backend): no Cloudflare.
- Only B → WooCommerce is behind Cloudflare and subject to challenges.

---

## 3. Folder & File Structure

```
woocommerce-api-wrapper/
├── .env.example
├── package.json
├── tsconfig.json
├── README.md
├── DOCUMENTATION.md          ← this file
├── data/
│   └── sync-state.json       ← last_modified high-water mark (runtime-generated)
└── src/
    ├── index.ts              ← Express app entry point
    ├── wc-client.ts          ← WC REST client (retry, paginate, all API functions)
    ├── trim.ts               ← trim* response mappers + helpers
    ├── routes/
    │   └── index.ts          ← Express router (all /api routes)
    └── sync/
        ├── compose.ts        ← build content + metadata for embedding
        ├── upsert.ts         ← HTTP push/delete to semantic backend
        ├── webhook.ts        ← HMAC-verified WC webhook receiver
        └── delta-sync.ts     ← periodic delta-sync + bulk load + interval mgmt
```

### `src/index.ts` — Express app entry point
**Purpose:** Boots the Express server, wires middleware (CORS, rate limiting, raw-body capture for webhooks), mounts all routers, and starts the delta-sync interval.

**Key exports/behaviors:**
- Creates `app = express()`, listens on `PORT` (default 8081).
- `cors()` — allows all origins (for n8n / browser clients).
- `rateLimit({ windowMs: 60000, max: 120 })` — 120 requests/min per IP, applied to `/api` and `/sync` routes.
- Raw body capture on `/webhook/wc` via `express.json({ verify })` — stores `req.rawBody` as a UTF-8 string for HMAC verification.
- Mounts: `/api` → routes router, `POST /webhook/wc` → `handleWebhook`, `POST /sync/bulk` → `bulkLoadAll`, `POST /sync/delta` → `runDeltaSync`, `GET /health` → health check.
- On startup: if `SYNC_ENABLED=true`, calls `startDeltaSync(SYNC_INTERVAL_MIN)` and fires an initial `runDeltaSync()` after a 5-second `setTimeout`.
- On `SIGTERM`/`SIGINT`: calls `stopDeltaSync()` then exits.

### `src/wc-client.ts` — WooCommerce REST API client
**Purpose:** Axios-based client that talks to WooCommerce. Contains the Cloudflare retry-until-JSON wrapper, a paginate helper, and every public WC API function.

**Key exports:**
- `request<T>(method, path, params?, data?, _opts?)` — core request wrapper with retry logic.
- `paginate<T>(path, params?)` — reads `X-WP-Total`/`X-WP-TotalPages` headers to auto-fetch all pages.
- `getProducts(params?, doPaginate?)` — list products.
- `getProduct(id)` — single product.
- `getCategories(params?)` — list product categories.
- `getCategory(id)` — single category.
- `getAttributes(params?)` — list product attributes.
- `getPaymentGateways()` — list payment gateways.
- `getShippingZones()` — list shipping zones.
- `getShippingZoneMethods(zoneId)` — shipping methods for a zone.
- `getOrders(params?)` — list orders.
- `getOrder(id)` — single order.
- `createOrder(data)` — create an order.
- `trackOrder(query)` — track by order_id+order_key, or email, or phone.

### `src/trim.ts` — Response mappers
**Purpose:** Maps bloated WC JSON objects into clean, minimal shapes. These trimmed shapes are what n8n/LLM see — not the raw WC objects.

**Key exports:**
- `stripHtml(html)` — removes HTML tags, decodes common entities, collapses whitespace.
- `trimProduct(wcProduct)` — compact product shape.
- `trimOrder(wcOrder)` — compact order shape (with PII masking).
- `trimCategory(wcCategory)` — compact category shape.
- `trimPaymentGateway(wcGateway)` — compact payment gateway shape.
- `trimShippingZone(wcZone)` — compact shipping zone shape.
- `trimShippingMethod(wcMethod)` — compact shipping method shape.

(Internal helpers: `truncate(text, maxLen)`, `maskEmail(email)`.)

### `src/routes/index.ts` — Express router (all `/api` routes)
**Purpose:** Defines every HTTP route that n8n calls. All inputs validated with Zod schemas. Mounted under the `/api` prefix in `index.ts`.

**Routes defined:**
- `GET /health`
- `GET /products` (zod-validated query)
- `GET /products/:id`
- `GET /categories` (query: `parent`)
- `GET /categories/:id`
- `GET /attributes`
- `GET /payment-gateways`
- `GET /shipping-zones`
- `GET /shipping-zones/:id/methods`
- `GET /orders` (zod-validated query)
- `GET /orders/:id`
- `GET /orders/track` (zod-validated query)
- `POST /orders` (zod-validated body)

### `src/sync/compose.ts` — Content & metadata builders
**Purpose:** Builds the text content string for embedding and the metadata object that the semantic backend stores/returns.

**Key exports:**
- `buildContentForEmbedding(product)` — concatenates name, short_description (HTML-stripped), description (HTML-stripped), category names, brand, all attributes, and SKU into a single searchable text string.
- `buildMetadata(product)` — builds the metadata object (name, price, regular_price, sale_price, currency, sku, stock_status, type, category_ids, category_names, brand, image_url, permalink, date_modified).

### `src/sync/upsert.ts` — HTTP push/delete to semantic backend
**Purpose:** The actual HTTP calls to backend A. Reads `SEMANTIC_BACKEND_URL` from env.

**Key exports:**
- `upsertProductToSemantic(product)` — `POST {SEMANTIC_BACKEND_URL}/index` with `{ id, content, metadata }`. Returns `{ id, action, reembedded }`.
- `deleteProductFromSemantic(id)` — `DELETE {SEMANTIC_BACKEND_URL}/{id}`. Returns `{ id, deleted }`.
- `listProductsModifiedAfter(modifiedAfter)` — fetches all WC products modified after a timestamp (used by delta-sync).

### `src/sync/webhook.ts` — WC webhook receiver
**Purpose:** Receives product lifecycle events from WooCommerce, verifies HMAC-SHA256 signature, routes by topic to upsert or delete.

**Key exports:**
- `handleWebhook(req, res)` — Express handler for `POST /webhook/wc`. Default export.

### `src/sync/delta-sync.ts` — Periodic delta-sync & bulk load
**Purpose:** Reads `data/sync-state.json`, fetches modified products, upserts them, updates the high-water mark. Also provides full re-index.

**Key exports:**
- `runDeltaSync()` — single delta-sync pass. Returns `{ processed, last_modified, errors }`.
- `bulkLoadAll()` — full re-index of ALL products. Returns `{ processed, errors }`.
- `startDeltaSync(intervalMin)` — starts the `setInterval` timer.
- `stopDeltaSync()` — clears the interval (graceful shutdown).

---

## 4. Environment Variables

All variables are defined in `.env.example`. The app reads them via `dotenv/config` (imported at the top of `src/index.ts`).

| Variable | Default | Required | Description |
|---|---|---|---|
| `WC_URL` | `https://iconnect-intl.com/store/wp-json/wc/v3` | Yes | WooCommerce REST API base URL (must end with `/wc/v3`). |
| `WC_KEY` | `""` (empty) | Yes | WooCommerce consumer key (`ck_...`). Used for Basic Auth. |
| `WC_SECRET` | `""` (empty) | Yes | WooCommerce consumer secret (`cs_...`). Used for Basic Auth. |
| `USER_AGENT` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36` | No | Browser User-Agent string sent on every WC request to reduce Cloudflare challenges. |
| `SEMANTIC_BACKEND_URL` | `http://localhost:8080` | Yes | Base URL of the semantic backend (A). The wrapper calls `POST /index` and `DELETE /:id` on this URL. |
| `WC_WEBHOOK_SECRET` | `""` (empty) | Yes (for webhook) | Shared secret used to HMAC-SHA256-verify incoming WC webhooks. Must match the `secret` field set in the WC webhook configuration. |
| `PORT` | `8081` | No | HTTP port this wrapper listens on. |
| `SYNC_ENABLED` | `true` (if `.env` sets it) | No | When `"true"`, starts the periodic delta-sync on boot. Any other value = disabled. |
| `SYNC_INTERVAL_MIN` | `5` | No | Delta-sync interval in minutes. Controls the `setInterval` period. |

---

## 5. WooCommerce Client Internals (`src/wc-client.ts`)

### 5.1 Client setup

An `AxiosInstance` is created with:

| Config | Value |
|---|---|
| `baseURL` | `WC_URL` (e.g. `https://iconnect-intl.com/store/wp-json/wc/v3`) |
| `timeout` | `30000` (30 seconds) |
| `User-Agent` | `USER_AGENT` env var (browser UA by default) |
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `Authorization` | `Basic <base64(WC_KEY:WC_SECRET)>` |

The `WC_KEY` and `WC_SECRET` are combined as `WC_KEY:WC_SECRET`, Base64-encoded, and sent as a standard HTTP Basic Auth header. These keys never leave this server.

### 5.2 Cloudflare retry-until-JSON logic

**Constants:**
- `MAX_RETRIES = 8`
- `RETRY_SLEEP_MS = 2000` (2 seconds)
- `MAX_PAGE_CAP = 1000` (safety cap on total items fetched via `paginate()`)

**`isJsonResponse(data)` helper:**
- Returns `true` if `data` is an object (already parsed by Axios).
- Returns `true` if `data` is a string that `trimStart()`s to start with `[` or `{`.
- Returns `false` otherwise (HTML challenge pages, empty body, etc.).

**`request<T>(method, path, params?, data?, _opts?)` flow:**

```
for attempt = 0..maxRetries-1:
    try:
        res = client.request({ method, url: path, params, data })
        if res.status === 403 OR !isJsonResponse(res.data):
            if not last attempt:
                sleep(2000ms)
                continue
        return res                          ← first valid JSON response
    catch err:
        if err.response.status === 403 OR err.code === "ECONNABORTED":
            if not last attempt: sleep(2000ms); continue
        if not last attempt: sleep(2000ms); continue

throw lastError ?? "Request failed after N retries"
```

**Why this works:**
- Cloudflare sometimes returns a 403 with an HTML challenge page (JS challenge that a real browser would solve). By checking `isJsonResponse`, the wrapper detects HTML/challenge responses and retries.
- Cloudflare's challenge logic is probabilistic — repeated requests from the same IP with a browser User-Agent often pass on retry. The 8-attempt / 2s-sleep loop is tuned for this.
- On 403 (both in the response and in the Axios catch block), the wrapper retries rather than failing immediately.
- `ECONNABORTED` (timeout) is also retried.

### 5.3 `paginate<T>(path, params)` helper

```
perPage = min(params.per_page || 50, 100)
page = 1, items = [], total = 0, totalPages = 1

while page <= totalPages AND items.length < MAX_PAGE_CAP:
    res = request("get", path, { ...params, per_page: perPage, page })
    items.push(...res.data)
    total = Number(res.headers["x-wp-total"]) || items.length
    totalPages = Number(res.headers["x-wp-totalpages"]) || 1
    page++

return { items: items.slice(0, MAX_PAGE_CAP), total, totalPages }
```

- Reads WooCommerce's standard pagination headers: `X-WP-Total` (total items) and `X-WP-TotalPages` (total pages).
- Caps at `MAX_PAGE_CAP = 1000` items as a safety valve.
- Per-page is clamped to 100 max.

### 5.4 Exported functions — signatures & return shapes

#### `request<T = any>(method, path, params?, data?, _opts?)`
- **Params:** `method: "get"|"post"|"put"|"delete"`, `path: string`, `params?: Record<string,any>`, `data?: any`, `_opts?: { retry?: number }`
- **Returns:** `Promise<AxiosResponse<T>>` — the full Axios response (with `.data`, `.headers`, `.status`).
- **Notes:** Core wrapper with Cloudflare retry. `_opts.retry` overrides `MAX_RETRIES`.

#### `paginate<T = any>(path, params?)`
- **Params:** `path: string`, `params?: Record<string,any>`
- **Returns:** `Promise<{ items: T[], total: number, totalPages: number }>`
- **Notes:** Auto-fetches all pages using `X-WP-Total` / `X-WP-TotalPages`. Caps at 1000 items.

#### `getProducts(params?, doPaginate?)`
- **Params:** `params?: Record<string,any>` (passed to WC `products` endpoint), `doPaginate?: boolean` (default `false`)
- **Returns:** `Promise<{ data: any[], headers: any }>`
- **Notes:** If `doPaginate=true`, uses `paginate()` to fetch all pages. Otherwise, a single `request("get", "products", params)`. Headers contain `x-wp-total` and `x-wp-totalpages`.

#### `getProduct(id)`
- **Params:** `id: number`
- **Returns:** `Promise<any>` — the raw WC product object.
- **Notes:** Calls `request("get", "products/${id}")`.

#### `getCategories(params?)`
- **Params:** `params?: Record<string,any>`
- **Returns:** `Promise<{ data: any[], headers: any }>`
- **Notes:** Calls `request("get", "products/categories", params)`.

#### `getCategory(id)`
- **Params:** `id: number`
- **Returns:** `Promise<any>` — the raw WC category object.
- **Notes:** Calls `request("get", "products/categories/${id}")`.

#### `getAttributes(params?)`
- **Params:** `params?: Record<string,any>`
- **Returns:** `Promise<any[]>` — array of raw WC attribute objects.
- **Notes:** Calls `request("get", "products/attributes", params)`.

#### `getPaymentGateways()`
- **Params:** none
- **Returns:** `Promise<any[]>` — array of raw WC payment gateway objects.
- **Notes:** Calls `request("get", "payment_gateways")`.

#### `getShippingZones()`
- **Params:** none
- **Returns:** `Promise<any[]>` — array of raw WC shipping zone objects.
- **Notes:** Calls `request("get", "shipping/zones")`.

#### `getShippingZoneMethods(zoneId)`
- **Params:** `zoneId: number`
- **Returns:** `Promise<any[]>` — array of raw WC shipping method objects.
- **Notes:** Calls `request("get", "shipping/zones/${zoneId}/methods")`.

#### `getOrders(params?)`
- **Params:** `params?: Record<string,any>` (e.g. `per_page`, `page`, `status`, `search`)
- **Returns:** `Promise<{ data: any[], headers: any }>`
- **Notes:** Calls `request("get", "orders", params)`.

#### `getOrder(id)`
- **Params:** `id: number`
- **Returns:** `Promise<any>` — the raw WC order object.
- **Notes:** Calls `request("get", "orders/${id}")`.

#### `createOrder(data)`
- **Params:** `data: Record<string,any>` — the WC order creation payload (line_items, billing, payment_method, etc.)
- **Returns:** `Promise<any>` — the created WC order object (includes `id`, `status`, `total`, `order_key`, `checkout_payment_url`).
- **Notes:** Calls `request("post", "orders", undefined, data)`.

#### `trackOrder(query)`
- **Params:** `query: { order_id?: number, order_key?: string, email?: string, phone?: string }`
- **Returns:** `Promise<any | null>` — the matching WC order object, or `null` if not found.
- **Notes:**
  1. If `order_id` + `order_key` provided: fetches the order by ID, checks if `order_key` matches.
  2. Falls back to searching by `email` or `phone` via `GET /orders?search=...`.
  3. If `order_id` was provided, filters matches by ID; otherwise returns the first result.

---

## 6. HTTP API (for n8n)

All routes are mounted under the `/api` prefix (see `src/index.ts`: `app.use("/api", limiter, routes)`). There is no authentication — the WC keys are internal to the wrapper. Input validation uses Zod schemas. Rate limited at 120 requests/min per IP.

> **Note on route ordering:** `GET /orders/track` is defined **before** `GET /orders/:id` in the router, so Express matches `/orders/track` as the track route, not as `id="track"`.

---

### 6.1 `GET /health`

**Full path:** `GET /health` (also available at root `GET /health` from `index.ts`)

**Auth:** none

**Params:** none

**Example request:**
```bash
curl http://localhost:8081/api/health
```

**Example response:**
```json
{
  "status": "ok",
  "service": "woocommerce-api-wrapper"
}
```

---

### 6.2 `GET /products`

**Full path:** `GET /api/products`

**Auth:** none (keys internal)

**Query params (Zod-validated):**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `search` | string | — | optional |
| `category` | string | — | optional |
| `per_page` | number (coerced) | `10` | int, 1–50 |
| `page` | number (coerced) | `1` | int, ≥1 |
| `orderby` | enum | — | `date` \| `id` \| `title` \| `slug` \| `price` \| `popularity` |
| `order` | enum | — | `asc` \| `desc` |
| `min_price` | number (coerced) | — | optional |
| `max_price` | number (coerced) | — | optional |
| `on_sale` | boolean (coerced) | — | optional |
| `featured` | boolean (coerced) | — | optional |
| `sku` | string | — | optional |

**Example request:**
```bash
curl "http://localhost:8081/api/products?search=wireless&per_page=5&orderby=price&order=asc"
```

**Example trimmed response:**
```json
{
  "products": [
    {
      "id": 1234,
      "name": "Wireless Headphones",
      "price": "199.00",
      "regular_price": "249.00",
      "sale_price": "199.00",
      "currency": "SAR",
      "sku": "WH-1234",
      "stock_status": "instock",
      "type": "simple",
      "status": "publish",
      "image_url": "https://example.com/wp-content/uploads/2024/01/headphones.jpg",
      "permalink": "https://example.com/product/wireless-headphones/",
      "category_ids": [15, 22],
      "category_names": ["Electronics", "Audio"],
      "brand": "Sony",
      "attributes": {
        "Color": "Black, White",
        "Brand": "Sony"
      },
      "short_desc": "High-quality wireless headphones with noise cancellation..."
    }
  ],
  "total": 42,
  "page": 1,
  "total_pages": 9
}
```

---

### 6.3 `GET /products/:id`

**Full path:** `GET /api/products/:id`

**Auth:** none

**Path params:** `id` (number — validated with `isNaN` check)

**Example request:**
```bash
curl http://localhost:8081/api/products/1234
```

**Example response:** (single `trimProduct` object — same shape as array element above)
```json
{
  "id": 1234,
  "name": "Wireless Headphones",
  "price": "199.00",
  "regular_price": "249.00",
  "sale_price": "199.00",
  "currency": "SAR",
  "sku": "WH-1234",
  "stock_status": "instock",
  "type": "simple",
  "status": "publish",
  "image_url": "https://example.com/wp-content/uploads/2024/01/headphones.jpg",
  "permalink": "https://example.com/product/wireless-headphones/",
  "category_ids": [15, 22],
  "category_names": ["Electronics", "Audio"],
  "brand": "Sony",
  "attributes": {
    "Color": "Black, White",
    "Brand": "Sony"
  },
  "short_desc": "High-quality wireless headphones with noise cancellation..."
}
```

---

### 6.4 `GET /categories`

**Full path:** `GET /api/categories`

**Auth:** none

**Query params:** `parent` (string, optional — filter by parent category ID)

**Example request:**
```bash
curl "http://localhost:8081/api/categories?parent=0"
```

**Example response:** (array of `trimCategory` objects)
```json
[
  {
    "id": 15,
    "name": "Electronics",
    "slug": "electronics",
    "parent": 0,
    "count": 128,
    "image": null
  },
  {
    "id": 22,
    "name": "Audio",
    "slug": "audio",
    "parent": 15,
    "count": 42,
    "image": { "src": "https://example.com/wp-content/uploads/2024/01/audio.jpg" }
  }
]
```

---

### 6.5 `GET /categories/:id`

**Full path:** `GET /api/categories/:id`

**Auth:** none

**Path params:** `id` (number)

**Example request:**
```bash
curl http://localhost:8081/api/categories/15
```

**Example response:** (single `trimCategory` object)
```json
{
  "id": 15,
  "name": "Electronics",
  "slug": "electronics",
  "parent": 0,
  "count": 128,
  "image": null
}
```

---

### 6.6 `GET /attributes`

**Full path:** `GET /api/attributes`

**Auth:** none

**Query params:** none (fetches with `per_page: 100`)

**Example request:**
```bash
curl http://localhost:8081/api/attributes
```

**Example response:** (raw WC attribute objects — not trimmed)
```json
[
  {
    "id": 1,
    "name": "Color",
    "slug": "color",
    "type": "select",
    "order_by": "menu_order",
    "has_archives": true
  },
  {
    "id": 2,
    "name": "Brand",
    "slug": "pa_brand",
    "type": "select",
    "order_by": "name",
    "has_archives": true
  }
]
```

---

### 6.7 `GET /payment-gateways`

**Full path:** `GET /api/payment-gateways`

**Auth:** none

**Query params:** none

**Example request:**
```bash
curl http://localhost:8081/api/payment-gateways
```

**Example response:** (array of `trimPaymentGateway` objects)
```json
[
  {
    "id": "telr",
    "title": "Credit/Debit Card (Telr)",
    "enabled": true
  },
  {
    "id": "cod",
    "title": "Cash on Delivery",
    "enabled": true
  },
  {
    "id": "bacs",
    "title": "Bank Transfer",
    "enabled": false
  }
]
```

---

### 6.8 `GET /shipping-zones`

**Full path:** `GET /api/shipping-zones`

**Auth:** none

**Query params:** none

**Example request:**
```bash
curl http://localhost:8081/api/shipping-zones
```

**Example response:** (array of `trimShippingZone` objects)
```json
[
  {
    "id": 1,
    "zone_name": "Saudi Arabia",
    "zone_order": 0,
    "zone_locations": [
      { "code": "SA", "type": "country" }
    ]
  },
  {
    "id": 2,
    "zone_name": "UAE",
    "zone_order": 1,
    "zone_locations": [
      { "code": "AE", "type": "country" }
    ]
  }
]
```

---

### 6.9 `GET /shipping-zones/:id/methods`

**Full path:** `GET /api/shipping-zones/:id/methods`

**Auth:** none

**Path params:** `id` (number — zone ID)

**Example request:**
```bash
curl http://localhost:8081/api/shipping-zones/1/methods
```

**Example response:** (array of `trimShippingMethod` objects)
```json
[
  {
    "id": 5,
    "method_id": "flat_rate",
    "title": "Flat Rate",
    "enabled": true,
    "settings": {
      "cost": "25.00",
      "title": "Standard Shipping"
    }
  },
  {
    "id": 6,
    "method_id": "free_shipping",
    "title": "Free Shipping",
    "enabled": true,
    "settings": {
      "min_amount": "100.00"
    }
  }
]
```

---

### 6.10 `GET /orders`

**Full path:** `GET /api/orders`

**Auth:** none

**Query params (Zod-validated):**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `per_page` | number (coerced) | `10` | int, 1–100 |
| `page` | number (coerced) | `1` | int, ≥1 |
| `status` | string | — | optional (e.g. `completed`, `processing`) |
| `search` | string | — | optional |

**Example request:**
```bash
curl "http://localhost:8081/api/orders?status=completed&per_page=5"
```

**Example response:**
```json
{
  "orders": [
    {
      "id": 5678,
      "status": "completed",
      "total": "199.00",
      "currency": "SAR",
      "payment_method": "telr",
      "payment_method_title": "Credit/Debit Card (Telr)",
      "customer_note": "Please deliver after 5 PM",
      "date_created": "2024-06-15T14:30:00",
      "order_key": "wc_order_abc123",
      "billing": {
        "first_name": "Ahmed",
        "phone": "+966 50 123 4567",
        "email": "a***@example.com"
      },
      "line_items": [
        {
          "product_id": 1234,
          "name": "Wireless Headphones",
          "quantity": 1,
          "total": "199.00"
        }
      ]
    }
  ],
  "total": 15,
  "page": 1,
  "total_pages": 3
}
```

---

### 6.11 `GET /orders/:id`

**Full path:** `GET /api/orders/:id`

**Auth:** none

**Path params:** `id` (number)

**Example request:**
```bash
curl http://localhost:8081/api/orders/5678
```

**Example response:** (single `trimOrder` object — same shape as array element above)

---

### 6.12 `GET /orders/track`

**Full path:** `GET /api/orders/track`

> **Route ordering note:** This route is defined before `GET /orders/:id` in the router, so Express matches it correctly. If it were defined after, `/orders/track` would be captured by the `:id` param.

**Auth:** none

**Query params (Zod-validated with `.refine()`):**

| Param | Type | Constraints |
|---|---|---|
| `order_id` | number (coerced) | optional |
| `order_key` | string | optional |
| `email` | string (email format) | optional |
| `phone` | string | optional |

**Validation rule (`.refine()`):** At least one of the following must be true:
- Both `order_id` AND `order_key` are provided
- `email` is provided
- `phone` is provided

If none of these conditions are met, returns 400 with `"Provide order_id+order_key, or email, or phone"`.

**Example request:**
```bash
curl "http://localhost:8081/api/orders/track?order_id=5678&order_key=wc_order_abc123"
```

**Example response:** (single `trimOrder` object, or 404 if not found)
```json
{
  "id": 5678,
  "status": "completed",
  "total": "199.00",
  "currency": "SAR",
  "payment_method": "telr",
  "payment_method_title": "Credit/Debit Card (Telr)",
  "customer_note": "Please deliver after 5 PM",
  "date_created": "2024-06-15T14:30:00",
  "order_key": "wc_order_abc123",
  "billing": {
    "first_name": "Ahmed",
    "phone": "+966 50 123 4567",
    "email": "a***@example.com"
  },
  "line_items": [
    {
      "product_id": 1234,
      "name": "Wireless Headphones",
      "quantity": 1,
      "total": "199.00"
    }
  ]
}
```

---

### 6.13 `POST /orders`

**Full path:** `POST /api/orders`

**Auth:** none

**Body params (Zod-validated):**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `line_items` | array | Yes | min 1 item; each: `{ product_id: int, quantity: int ≥ 1 }` |
| `billing` | object | Yes | `{ first_name: string (req), last_name?: string, phone: string (req), email?: string (email), address_1?: string, city?: string, country?: string }` |
| `payment_method` | string | No | e.g. `"telr"` |
| `payment_method_title` | string | No | e.g. `"Credit/Debit Card (Telr)"` |
| `customer_note` | string | No | |

The route constructs a WC payload with `set_paid: false` and calls `createOrder()`.

**Example request:**
```bash
curl -X POST http://localhost:8081/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "line_items": [
      { "product_id": 1234, "quantity": 2 }
    ],
    "billing": {
      "first_name": "Ahmed",
      "last_name": "Al-Rashid",
      "phone": "+966 50 123 4567",
      "email": "ahmed@example.com",
      "address_1": "King Fahd Road, Building 42",
      "city": "Riyadh",
      "country": "SA"
    },
    "payment_method": "telr",
    "payment_method_title": "Credit/Debit Card (Telr)",
    "customer_note": "Please deliver after 5 PM"
  }'
```

**Example response:**
```json
{
  "id": 5679,
  "status": "pending",
  "total": "398.00",
  "order_key": "wc_order_def456",
  "payment_url": "https://telr.example.com/pay/abc123xyz"
}
```

**Note on `payment_url`:** The route returns `order.checkout_payment_url || order.payment_url || null`. This is the Telr payment link that n8n can send to the customer (e.g., via WhatsApp or SMS) for them to complete payment. The field is named `payment_url` in the response.

---

### 6.14 Admin sync routes (mounted at root, not under `/api`)

These are defined in `src/index.ts` directly (not in `routes/index.ts`) and are rate-limited.

#### `POST /sync/bulk`
Triggers `bulkLoadAll()` — full re-index of ALL products into the semantic backend.
```bash
curl -X POST http://localhost:8081/sync/bulk
```
Response: `{ "processed": 500, "errors": 0 }`

#### `POST /sync/delta`
Triggers `runDeltaSync()` — a single delta-sync pass.
```bash
curl -X POST http://localhost:8081/sync/delta
```
Response: `{ "processed": 3, "last_modified": "2024-06-15T14:30:00", "errors": 0 }`

---

### 6.15 Webhook receiver (mounted at root)

#### `POST /webhook/wc`
Receives WooCommerce webhook events. See section 8a for details.

---

## 7. Response Trimming (`src/trim.ts`)

The raw WooCommerce REST API responses are large and deeply nested. The `trim*` mappers reduce them to clean shapes that n8n workflows and LLMs can reason about efficiently. These trimmed shapes are what every `/api/*` route returns.

### 7.1 `stripHtml(html: string): string`
Removes all HTML tags (`<[^>]*>` → space), decodes common HTML entities, collapses whitespace, and trims. Entities decoded: `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;`, `&#8217;` (right single quote), `&#8220;` (left double quote), `&#8221;` (right double quote), `&#8230;` (ellipsis).

### 7.2 `truncate(text: string, maxLen: number): string` *(internal helper)*
Truncates text to `maxLen` characters, appending `"..."` if truncated (the last 3 chars are replaced with the ellipsis).

### 7.3 `maskEmail(email?: string): string | null` *(internal helper)*
Masks email for privacy: `user@domain` → `u***@domain`. If the user part is a single character, masks as `***@domain`. Returns `null` if no email provided.

### 7.4 `trimProduct(wcProduct: any)` — output shape
```typescript
{
  id: number,
  name: string,
  price: string,                    // "199.00" (WC returns strings)
  regular_price: string,
  sale_price: string,              // "" if not on sale
  currency: "SAR",                // hardcoded
  sku: string,
  stock_status: string,            // "instock" | "outofstock" | "onbackorder"
  type: string,                    // "simple" | "variable" | etc.
  status: string,                  // "publish" | "draft" | etc.
  image_url: string,               // first image src, or ""
  permalink: string,
  category_ids: number[],
  category_names: string[],
  brand: string,                   // from attribute named "Brand" or "العلامة التجارية"
  attributes: Record<string, string>,  // { "Color": "Black, White", "Brand": "Sony" }
  short_desc: string               // stripHtml(short_description) truncated to 140 chars
}
```

**Brand detection:** Iterates `wcProduct.attributes`; if an attribute's `name` lowercased equals `"brand"` or includes `"علامة"` (Arabic for "brand"), its options are joined as the brand value.

### 7.5 `trimOrder(wcOrder: any)` — output shape
```typescript
{
  id: number,
  status: string,                  // "pending" | "processing" | "completed" | etc.
  total: string,                   // "199.00"
  currency: string,                // from WC, e.g. "SAR"
  payment_method: string,
  payment_method_title: string,
  customer_note: string,
  date_created: string,            // ISO 8601
  order_key: string,
  billing: {
    first_name: string,
    phone: string,
    email: string | null           // masked via maskEmail()
  },
  line_items: Array<{
    product_id: number,
    name: string,
    quantity: number,
    total: string
  }>
}
```

**PII masking:** The `billing.email` field is masked via `maskEmail()` (e.g., `ahmed@example.com` → `a***@example.com`). Phone and first_name are passed through unmasked (needed for delivery/order tracking).

### 7.6 `trimCategory(wcCategory: any)` — output shape
```typescript
{
  id: number,
  name: string,
  slug: string,
  parent: number,                  // 0 = top-level
  count: number,                   // number of products in category
  image: string | null             // wcCategory.image?.src || null
}
```

### 7.7 `trimPaymentGateway(wcGateway: any)` — output shape
```typescript
{
  id: string,                      // e.g. "telr", "cod", "bacs"
  title: string,                   // display title
  enabled: boolean                 // true if wcGateway.enabled === "yes"
}
```

### 7.8 `trimShippingZone(wcZone: any)` — output shape
```typescript
{
  id: number,
  zone_name: string,
  zone_order: number,
  zone_locations: any[]            // raw array of { code, type } from WC
}
```

### 7.9 `trimShippingMethod(wcMethod: any)` — output shape
```typescript
{
  id: number,                      // instance_id (unique per zone)
  method_id: string,               // e.g. "flat_rate", "free_shipping"
  title: string,
  enabled: boolean,                // true if wcMethod.enabled === "yes"
  settings: any                    // raw settings object from WC
}
```

---

## 8. Sync Bridge to the Semantic Backend

The wrapper keeps the semantic backend's vector index fresh through three complementary mechanisms. All three converge on the same HTTP contract (see section 9).

### 8a. Webhook receiver (`src/sync/webhook.ts`)

**Endpoint:** `POST /webhook/wc` (mounted in `index.ts`)

**How it works:**
1. WooCommerce sends a POST to this endpoint when a product is created, updated, deleted, or restored.
2. The `X-Wc-Webhook-Signature` header contains an HMAC-SHA256 hex digest of the raw request body, signed with the shared `WC_WEBHOOK_SECRET`.
3. `verifySignature(rawBody, signature)` computes the expected HMAC and compares using `crypto.timingSafeEqual()` (timing-safe comparison to prevent side-channel attacks).
4. The `X-Wc-Webhook-Topic` header indicates the event type. The handler routes:
   - `product.created` → `upsertProductToSemantic(product)`
   - `product.updated` → `upsertProductToSemantic(product)`
   - `product.restored` → `upsertProductToSemantic(product)`
   - `product.deleted` → `deleteProductFromSemantic(product.id)`
   - Unknown topics → acknowledged with `{ topic, ok: true, ignored: true }` (to prevent WC retries).
5. Always returns HTTP 200, even on errors, to prevent WooCommerce retry storms. Errors are logged to console.

**HMAC verification detail:**
```typescript
function verifySignature(rawBody: string, signature: string): boolean {
  if (!WC_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", WC_WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
```

**Raw body capture:** In `src/index.ts`, the `/webhook/wc` path has a dedicated `express.json({ verify })` middleware that captures the raw body as `req.rawBody` (a UTF-8 string) before JSON parsing. The webhook handler uses `req.body` (the parsed JSON) for processing and re-serializes it (`JSON.stringify(req.body)`) if needed for signature verification.

**How to register the webhook in WooCommerce:**

Create one or more webhooks in WooCommerce pointing to this wrapper's `/webhook/wc` endpoint:

```bash
# Register a webhook for product updates
curl -X POST "$WC_URL/webhooks" \
  -u "$WC_KEY:$WC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Semantic Sync - Updated",
    "topic": "product.updated",
    "delivery_url": "https://your-wrapper-host:8081/webhook/wc",
    "secret": "your WC_WEBHOOK_SECRET"
  }'
```

Register separate webhooks for each topic (`product.created`, `product.updated`, `product.deleted`, `product.restored`), or use `product.*` as the topic (if supported by your WC version). The `secret` field must match the `WC_WEBHOOK_SECRET` environment variable exactly.

You can also register webhooks via the WooCommerce admin UI: **WooCommerce → Settings → Advanced → Webhooks**.

### 8b. Delta-sync cron (`src/sync/delta-sync.ts`)

**How it works:**
1. Reads `last_modified` timestamp from `data/sync-state.json` (defaults to `"1970-01-01T00:00:00"` if the file doesn't exist).
2. Calls `getProducts({ modified_after: state.last_modified, per_page: 100 }, true)` — with `doPaginate=true` to auto-fetch all pages.
3. For each product, calls `upsertProductToSemantic(product)`.
4. Tracks the maximum `date_modified` seen across all products.
5. Writes the new high-water mark back to `data/sync-state.json`.
6. Returns `{ processed, last_modified, errors }`.

**State file:** `data/sync-state.json` — contains `{ "last_modified": "2024-06-15T14:30:00" }`. The `data/` directory is created automatically by `ensureDataDir()` if it doesn't exist.

**Interval management:**
- `startDeltaSync(intervalMin)` — creates a `setInterval` with the configured interval. Called from `index.ts` on startup if `SYNC_ENABLED=true`.
- `stopDeltaSync()` — clears the interval. Called on `SIGTERM`/`SIGINT`.
- **Initial 5-second fire:** On startup, `index.ts` calls `setTimeout(() => runDeltaSync(), 5000)` to run an immediate delta-sync shortly after the server boots, before the first interval tick.

**`SYNC_INTERVAL_MIN`** — controls the interval (default 5 minutes). Set via environment variable.

### 8c. Bulk load (`delta-sync.ts` `bulkLoadAll`)

**How it works:**
1. Calls `getProducts({ per_page: 100 }, true)` — fetches ALL products with pagination.
2. For each product, calls `upsertProductToSemantic(product)`.
3. Updates `data/sync-state.json` with the max `date_modified` seen.
4. Returns `{ processed, errors }`.

**Trigger:** `POST /sync/bulk` (admin route in `index.ts`). This is the "nuclear option" — it walks every single product in WooCommerce and re-indexes it into the semantic backend. Use when:
- Setting up the system for the first time.
- The semantic backend was wiped and needs a full rebuild.
- The delta-sync state file is corrupted or lost.

### 8d. `compose.ts` — content & metadata builders

**`buildContentForEmbedding(product: any): string`**

Concatenates the following into a single space-separated string (all HTML stripped):
1. `product.name`
2. `stripHtml(product.short_description)`
3. `stripHtml(product.description)`
4. Category names (joined with space)
5. Brand (from attribute named "Brand" or containing "علامة")
6. All attributes flattened via `flattenAttributes()` — format: `"Color: Black, White Brand: Sony"`
7. `product.sku`

This is the "document" that the semantic backend embeds and searches. Putting everything searchable into `content` ensures full-text / vector search finds products by any of these fields.

**`buildMetadata(product: any): object`**

```typescript
{
  name: string,
  price: string,                    // "199.00"
  regular_price: string,
  sale_price: string,
  currency: "SAR",
  sku: string,
  stock_status: string,
  type: string,
  category_ids: bigint[],          // note: BigInt array
  category_names: string[],
  brand: string,
  image_url: string,
  permalink: string,
  date_modified: string
}
```

This metadata is stored as JSONB by the semantic backend and returned in search results. It does NOT go into the embedding — only `content` does. The semantic backend uses `md5(content)` to decide if re-embedding is needed (if the hash matches the stored hash, it skips the OpenAI embedding call).

**`upsert.ts` — `upsertProductToSemantic(product)`**
Sends `POST {SEMANTIC_BACKEND_URL}/index` with:
```json
{
  "id": "1234",
  "content": "Wireless Headphones High-quality wireless... Electronics Audio Sony Color: Black, White Brand: Sony WH-1234",
  "metadata": { "name": "Wireless Headphones", "price": "199.00", ... }
}
```
Returns: `{ id, action, reembedded }` — where `reembedded` is `true` if the backend actually called OpenAI to re-embed (content changed), or `false` if it was a no-op (content unchanged, same md5).

**`upsert.ts` — `deleteProductFromSemantic(id)`**
Sends `DELETE {SEMANTIC_BACKEND_URL}/{id}`. Returns: `{ id, deleted }`.

**`upsert.ts` — `listProductsModifiedAfter(modifiedAfter)`**
Helper used by delta-sync: calls `getProducts({ modified_after: modifiedAfter, per_page: 100 }, true)` and returns the product array.

---

## 9. The Inter-Backend HTTP Contract

The wrapper (B) communicates with the semantic backend (A) exclusively over HTTP. There is no shared code, no shared database, no direct OpenAI/Postgres access from B.

### `POST /index` — Upsert a product

**Request (B → A):**
```json
{
  "id": "1234",
  "content": "Wireless Headphones High-quality wireless headphones with noise cancellation Electronics Audio Sony Color: Black, White Brand: Sony WH-1234",
  "metadata": {
    "name": "Wireless Headphones",
    "price": "199.00",
    "regular_price": "249.00",
    "sale_price": "199.00",
    "currency": "SAR",
    "sku": "WH-1234",
    "stock_status": "instock",
    "type": "simple",
    "category_ids": [15, 22],
    "category_names": ["Electronics", "Audio"],
    "brand": "Sony",
    "image_url": "https://example.com/wp-content/uploads/2024/01/headphones.jpg",
    "permalink": "https://example.com/product/wireless-headphones/",
    "date_modified": "2024-06-15T14:30:00"
  }
}
```

**Response (A → B):**
```json
{
  "id": "1234",
  "action": "upserted",
  "reembedded": true
}
```

**Key design point:** Backend A owns the re-embed decision. It computes `md5(content)` and compares to the stored hash. If they match, it skips the OpenAI embedding call (`reembedded: false`). The wrapper (B) never calls OpenAI directly — it just pushes content and metadata.

### `DELETE /:id` — Delete a product

**Request (B → A):**
```
DELETE http://localhost:8080/1234
```

**Response (A → B):**
```json
{
  "id": "1234",
  "deleted": true
}
```

### Timeout configuration
- `POST /index`: 30-second timeout (`timeout: 30000` in `upsert.ts`).
- `DELETE /:id`: 15-second timeout (`timeout: 15000` in `upsert.ts`).

---

## 10. Cloudflare Handling

### Why the retry is needed

The WooCommerce store (`https://iconnect-intl.com/store/`) sits behind Cloudflare's bot protection. Cloudflare intermittently issues "challenges" — interactive JavaScript challenges that a real browser would solve, but an HTTP client (like Axios) cannot. These manifest as:

1. **HTTP 403** with an HTML challenge page in the response body.
2. **HTTP 200** but with an HTML body (not JSON) — a challenge or interstitial page.
3. **`ECONNABORTED`** — connection timeout.

The WooCommerce REST API normally returns JSON (content type `application/json`, body starting with `[` or `{`). Any response that is HTML or 403 is a Cloudflare challenge, not a real WC response.

### What triggers a challenge

Cloudflare's bot protection is probabilistic and heuristic-based. It can be triggered by:
- Request rate from the same IP exceeding a threshold.
- Missing or non-browser User-Agent.
- Suspicious request patterns (e.g., rapid sequential requests to the same endpoint).
- Cloudflare's "Under Attack" mode being enabled by the site admin.
- JS challenges that require executing JavaScript in a browser context.

### Why a browser User-Agent helps on GETs

The wrapper sends a browser User-Agent on every request:
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36
```

Cloudflare's heuristic bot detection scores requests partly on the User-Agent. A browser UA passes the basic check, reducing (but not eliminating) the chance of a challenge. Since the challenge logic is probabilistic, retrying (up to 8 times with 2-second sleeps) eventually gets through on most attempts.

### The retry loop in detail

```
attempt 0: send request → got 403 HTML → sleep 2s → retry
attempt 1: send request → got 200 HTML → sleep 2s → retry
attempt 2: send request → got 200 JSON ✓ → return response
```

If all 8 attempts fail, the last error is thrown.

### The durable fix: WAF bypass rule

The retry logic is a mitigation, not a fix. The only durable solution is to configure a Cloudflare WAF bypass rule that exempts requests to the `/wp-json/wc/v3/*` path from the bot/challenge rules. This is documented in `SETUP-cloudflare-bypass.md` (separate file). The bypass rule should:
1. Match requests where the URI path starts with `/store/wp-json/wc/v3/`.
2. Match requests that include the Basic Auth header (WC keys).
3. Set the action to "Bypass" or "Skip" for the bot/challenge ruleset.

### Paths affected

Only **B → WooCommerce** is behind Cloudflare:
- `n8n → B` (this wrapper): no Cloudflare — n8n calls `localhost:8081` or the wrapper's public URL.
- `B → A` (semantic backend): no Cloudflare — the semantic backend is on a separate URL.
- `B → WooCommerce`: **Cloudflare-protected** — the only path affected.

---

## 11. Security

### Key isolation
- `WC_KEY` (`ck_...`) and `WC_SECRET` (`cs_...`) are read from environment variables and used only to construct the Basic Auth header inside `wc-client.ts`. They are never logged, never sent to n8n, never returned in any API response.
- n8n calls the wrapper with no authentication — the wrapper has no auth middleware on its `/api` routes. (Access control is expected to be handled at the network level — the wrapper should not be publicly exposed without a reverse proxy adding auth.)

### HMAC webhook verification
- Incoming WooCommerce webhooks are verified with HMAC-SHA256 using `WC_WEBHOOK_SECRET`.
- Verification uses `crypto.timingSafeEqual()` to prevent timing side-channel attacks.
- If `WC_WEBHOOK_SECRET` is not set (empty string), `verifySignature()` returns `false` — webhooks are rejected.
- The raw body is captured before JSON parsing via `express.json({ verify })` to ensure the signature matches the exact bytes WooCommerce signed.

### Rate limiting
- Global rate limiter: 120 requests per minute per IP (`express-rate-limit`), applied to `/api` routes and `/sync` admin routes.
- Standard rate-limit headers (`RateLimit-*`) are sent; legacy `X-RateLimit-*` headers are disabled.
- Exceeding the limit returns `{ error: "Too many requests, please try again later." }` with HTTP 429.

### Input validation (Zod)
- `GET /products` query params validated by `productsQuerySchema` — `per_page` clamped 1–50, `orderby` restricted to enum, `order` restricted to `asc`/`desc`, `on_sale`/`featured` coerced to boolean.
- `GET /orders` query params validated by `ordersQuerySchema` — `per_page` clamped 1–100.
- `GET /orders/track` validated by `trackQuerySchema` with `.refine()` requiring at least `order_id+order_key`, `email`, or `phone`.
- `POST /orders` body validated by `createOrderSchema` — `line_items` must be a non-empty array of `{ product_id: int, quantity: int ≥ 1 }`, `billing.first_name` and `billing.phone` required, `billing.email` must be valid email format if provided.
- Invalid input returns HTTP 400 with `{ error: "<message>" }`.

### PII masking
- In `trimOrder()`, the customer email is masked via `maskEmail()` (e.g., `ahmed@example.com` → `a***@example.com`) before being sent to n8n. This prevents PII from leaking into n8n workflow logs or LLM context.
- Phone number and first name are **not** masked (they are needed for order tracking and delivery). This is a deliberate trade-off — adjust if your compliance requirements differ.

---

## 12. Setup & Run

### Prerequisites
1. **Node.js ≥ 20.0.0** (the `engines` field in `package.json` enforces this).
2. **WooCommerce REST API keys** — a consumer key (`ck_...`) and consumer secret (`cs_...`) with at least Read access (Write access needed for `POST /orders` and webhook registration). Generate at: WooCommerce → Settings → Advanced → REST API.
3. **Semantic backend URL** — the semantic backend (A) must be running and accessible at `SEMANTIC_BACKEND_URL`.
4. **Webhook secret** — a shared secret string for HMAC verification. Generate a random string (e.g., `openssl rand -hex 32`).

### Step-by-step

```bash
# 1. Clone / navigate to the project
cd woocommerce-api-wrapper

# 2. Copy the env template
cp .env.example .env

# 3. Edit .env — fill in your values
#    WC_URL=         your WooCommerce REST API base URL
#    WC_KEY=         your ck_ key
#    WC_SECRET=      your cs_ secret
#    USER_AGENT=     (leave default or customize)
#    SEMANTIC_BACKEND_URL=  URL of semantic backend (A)
#    WC_WEBHOOK_SECRET=     random secret (must match WC webhook config)
#    PORT=           8081 (or your preferred port)
#    SYNC_ENABLED=   true
#    SYNC_INTERVAL_MIN= 5

# 4. Install dependencies
npm install

# 5. Run in development (auto-reload with tsx watch)
npm run dev

# 6. Build for production
npm run build
npm start

# 7. Register WC webhooks (one per topic, or use product.* if supported)
#    See section 8a for the curl command.
#    Set delivery_url to: https://your-wrapper-host:PORT/webhook/wc
#    Set secret to: your WC_WEBHOOK_SECRET value

# 8. Run bulk load (initial full re-index of all products into semantic backend)
curl -X POST http://localhost:8081/sync/bulk

# 9. Test with curl
curl http://localhost:8081/api/health
curl "http://localhost:8081/api/products?per_page=5"
curl http://localhost:8081/api/products/1234
curl "http://localhost:8081/api/orders/track?order_id=5678&order_key=wc_order_abc123"
```

### npm scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx watch src/index.ts` | Development with auto-reload on file changes. |
| `build` | `tsc` | Compile TypeScript to `dist/`. |
| `start` | `node dist/index.js` | Run the compiled production build. |

### TypeScript configuration highlights (`tsconfig.json`)
- Target: `ES2022`
- Module: `NodeNext` (ESM — `"type": "module"` in `package.json`)
- Strict mode enabled
- Output: `dist/` directory
- Source: `src/` directory
- Generates declarations, declaration maps, and source maps

---

## 13. Troubleshooting

### 403 Cloudflare errors

**Symptom:** `GET /api/products` returns 403 or hangs for a long time before returning an error.

**Diagnosis:**
1. Check that `USER_AGENT` is set to a browser UA (the default in `.env.example` is fine).
2. Check that the wrapper is retrying — look for console logs showing multiple attempts.
3. If all 8 retries fail consistently, Cloudflare is in "Under Attack" mode or the WAF is blocking the wrapper's IP entirely.

**Fix:**
1. Verify `USER_AGENT` env var is set and looks like a real browser.
2. Wait and retry — Cloudflare challenges are often intermittent.
3. **Apply the WAF bypass rule** — see `SETUP-cloudflare-bypass.md`. Create a Cloudflare firewall rule that bypasses bot protection for requests to `/store/wp-json/wc/v3/*` with a Basic Auth header. This is the only durable fix.
4. If using a CDN/reverse proxy in front of the wrapper, ensure it forwards the correct `User-Agent` header.

### Webhook HMAC signature failures

**Symptom:** `POST /webhook/wc` returns 401 `"Invalid signature"`.

**Diagnosis:**
1. The `WC_WEBHOOK_SECRET` env var in the wrapper doesn't match the `secret` field set in the WooCommerce webhook configuration.
2. The raw body was modified between WooCommerce signing it and the wrapper verifying it (e.g., a reverse proxy modifying the body, or Express parsing the body before verification).

**Fix:**
1. Ensure `WC_WEBHOOK_SECRET` exactly matches the secret configured in WooCommerce's webhook settings.
2. Verify the raw-body capture middleware is working — the `verify` function in `express.json()` must run before any body modification.
3. Check that no reverse proxy (nginx, Cloudflare) is modifying the request body.
4. If the secret is empty (`WC_WEBHOOK_SECRET=""`), `verifySignature()` returns `false` for all requests — ensure the env var is set.

### Delta-sync not advancing

**Symptom:** `data/sync-state.json` `last_modified` is not updating, or products aren't being synced.

**Diagnosis:**
1. The `data/` directory or `data/sync-state.json` file has incorrect permissions — the Node process can't write to it.
2. `SYNC_ENABLED` is not set to `"true"` (check the exact string comparison in `index.ts`).
3. All products have `date_modified` older than the stored `last_modified` — nothing to sync.
4. WooCommerce is returning 403s (Cloudflare), so `getProducts()` fails.

**Fix:**
1. Check permissions on the `data/` directory: `ls -la data/`. The Node process needs write access.
2. Verify `SYNC_ENABLED=true` in `.env` (exact string, lowercase `true`).
3. Check console logs for `[delta-sync]` messages — look for error counts.
4. If the state file is corrupted, delete `data/sync-state.json` — it will be recreated with the default `last_modified` of `1970-01-01T00:00:00`, causing a full re-sync on the next delta-sync run.
5. Run `POST /sync/delta` manually to see the response: `{ processed, last_modified, errors }`.

### Empty `/api/products` response

**Symptom:** `GET /api/products` returns `{ products: [], total: 0, page: 1, total_pages: 1 }`.

**Diagnosis:**
1. `WC_KEY` / `WC_SECRET` are wrong or the key has insufficient permissions — WooCommerce returns an empty array or 403.
2. The WooCommerce store is down or behind a Cloudflare challenge that the retry can't get through.
3. The `WC_URL` is incorrect (e.g., missing `/wc/v3` suffix, or wrong path).
4. The query params (e.g., `category`, `search`) are filtering out all products.

**Fix:**
1. Test the WC keys directly: `curl -u "$WC_KEY:$WC_SECRET" "$WC_URL/products?per_page=1"`. If this returns 401/403, the keys are wrong.
2. Check `WC_URL` — it must end with `/wc/v3` (e.g., `https://iconnect-intl.com/store/wp-json/wc/v3`).
3. Check the wrapper's console logs for Cloudflare retry messages or errors.
4. Try a simpler query: `curl http://localhost:8081/api/products?per_page=1` to see if any products come back.

---

## 14. Appendix

### A. Route table (quick reference)

| Method | Full path | Params | Notes |
|---|---|---|---|
| `GET` | `/health` | — | Health check (also at root `GET /health`) |
| `GET` | `/api/products` | `search?, category?, per_page (1-50, def 10), page (def 1), orderby?, order?, min_price?, max_price?, on_sale?, featured?, sku?` | Zod-validated; returns `{ products, total, page, total_pages }` |
| `GET` | `/api/products/:id` | `id` (path, number) | Returns single `trimProduct` |
| `GET` | `/api/categories` | `parent?` (query, string) | Returns array of `trimCategory` |
| `GET` | `/api/categories/:id` | `id` (path, number) | Returns single `trimCategory` |
| `GET` | `/api/attributes` | — | Returns raw WC attribute objects |
| `GET` | `/api/payment-gateways` | — | Returns array of `trimPaymentGateway` |
| `GET` | `/api/shipping-zones` | — | Returns array of `trimShippingZone` |
| `GET` | `/api/shipping-zones/:id/methods` | `id` (path, number, zone ID) | Returns array of `trimShippingMethod` |
| `GET` | `/api/orders` | `per_page (1-100, def 10), page (def 1), status?, search?` | Zod-validated; returns `{ orders, total, page, total_pages }` |
| `GET` | `/api/orders/:id` | `id` (path, number) | Returns single `trimOrder` |
| `GET` | `/api/orders/track` | `order_id?, order_key?, email?, phone?` (must have `order_id+order_key`, or `email`, or `phone`) | Zod-validated with `.refine()`; returns `trimOrder` or 404 |
| `POST` | `/api/orders` | Body: `{ line_items: [{ product_id, quantity }], billing: { first_name, phone, ... }, payment_method?, payment_method_title?, customer_note? }` | Zod-validated; returns `{ id, status, total, order_key, payment_url }` |
| `POST` | `/sync/bulk` | — | Admin: full re-index; returns `{ processed, errors }` |
| `POST` | `/sync/delta` | — | Admin: single delta-sync pass; returns `{ processed, last_modified, errors }` |
| `POST` | `/webhook/wc` | WC webhook payload (JSON body) | HMAC-verified; routes by `X-Wc-Webhook-Topic` |

### B. Trim* output shapes (quick copy)

#### `trimProduct`
```json
{
  "id": 1234,
  "name": "Product Name",
  "price": "199.00",
  "regular_price": "249.00",
  "sale_price": "199.00",
  "currency": "SAR",
  "sku": "SKU-123",
  "stock_status": "instock",
  "type": "simple",
  "status": "publish",
  "image_url": "https://...",
  "permalink": "https://...",
  "category_ids": [15, 22],
  "category_names": ["Cat1", "Cat2"],
  "brand": "BrandName",
  "attributes": { "Color": "Black", "Size": "M, L" },
  "short_desc": "Truncated to 140 chars..."
}
```

#### `trimOrder`
```json
{
  "id": 5678,
  "status": "completed",
  "total": "199.00",
  "currency": "SAR",
  "payment_method": "telr",
  "payment_method_title": "Credit/Debit Card (Telr)",
  "customer_note": "Note text",
  "date_created": "2024-06-15T14:30:00",
  "order_key": "wc_order_abc123",
  "billing": {
    "first_name": "Ahmed",
    "phone": "+966 50 123 4567",
    "email": "a***@example.com"
  },
  "line_items": [
    { "product_id": 1234, "name": "Product Name", "quantity": 1, "total": "199.00" }
  ]
}
```

#### `trimCategory`
```json
{
  "id": 15,
  "name": "Electronics",
  "slug": "electronics",
  "parent": 0,
  "count": 128,
  "image": null
}
```

#### `trimPaymentGateway`
```json
{
  "id": "telr",
  "title": "Credit/Debit Card (Telr)",
  "enabled": true
}
```

#### `trimShippingZone`
```json
{
  "id": 1,
  "zone_name": "Saudi Arabia",
  "zone_order": 0,
  "zone_locations": [{ "code": "SA", "type": "country" }]
}
```

#### `trimShippingMethod`
```json
{
  "id": 5,
  "method_id": "flat_rate",
  "title": "Flat Rate",
  "enabled": true,
  "settings": { "cost": "25.00" }
}
```

### C. Sync state file (`data/sync-state.json`)
```json
{
  "last_modified": "2024-06-15T14:30:00"
}
```

### D. Semantic backend HTTP contract summary

| Call | Method | URL | Body | Response |
|---|---|---|---|---|
| Upsert | `POST` | `{SEMANTIC_BACKEND_URL}/index` | `{ id: string, content: string, metadata: object }` | `{ id, action, reembedded }` |
| Delete | `DELETE` | `{SEMANTIC_BACKEND_URL}/{id}` | — | `{ id, deleted }` |

### E. Constants

| Constant | Value | Location |
|---|---|---|
| `MAX_RETRIES` | `8` | `wc-client.ts` |
| `RETRY_SLEEP_MS` | `2000` (2 seconds) | `wc-client.ts` |
| `MAX_PAGE_CAP` | `1000` (items) | `wc-client.ts` |
| Axios timeout | `30000` (30 seconds) | `wc-client.ts` |
| Rate limit window | `60000` (1 minute) | `index.ts` |
| Rate limit max | `120` (requests per window per IP) | `index.ts` |
| Upsert HTTP timeout | `30000` (30 seconds) | `upsert.ts` |
| Delete HTTP timeout | `15000` (15 seconds) | `upsert.ts` |
| Initial delta-sync delay | `5000` (5 seconds) | `index.ts` |
