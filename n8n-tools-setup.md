# n8n Tools Setup Guide

This guide walks you through wiring every tool the n8n AI Agent needs. The agent calls two backends:

- **Backend A (Semantic Search)** — base URL stored in n8n env as `SEMANTIC_BACKEND_URL` (e.g. `http://localhost:8080`).
- **Backend B (WooCommerce Wrapper)** — base URL stored in n8n env as `WOO_WRAPPER_URL` (e.g. `http://localhost:8081`).

Use the HTTP Request node (or the AI Tool node's built-in HTTP action) for each tool below. In the URL field, use the placeholders `{{ $env.SEMANTIC_BACKEND_URL }}` and `{{ $env.WOO_WRAPPER_URL }}` exactly as shown — n8n resolves them at runtime from your environment variables.

---

## Credentials & Headers

### Backend A (Semantic Search)

Backend A has **no authentication** — it is an internal service. No headers are required beyond `Content-Type: application/json` on POST requests (the HTTP Request node sets this automatically when you choose "JSON" as the body content type).

### Backend B (WooCommerce Wrapper)

Backend B also requires **no auth headers** for its `/api` routes. B holds the WooCommerce keys (`ck_`/`cs_`) and the Cloudflare-bypassing User-Agent internally, so n8n does **not** need:

- WooCommerce consumer key / secret
- A browser User-Agent
- Any Authorization header

Just call the endpoints. B handles everything downstream.

### Setting n8n Environment Variables

In n8n, go to **Settings → Variables** (or your `.env` if self-hosted) and add:

| Variable | Example Value |
|----------|---------------|
| `SEMANTIC_BACKEND_URL` | `http://localhost:8080` |
| `WOO_WRAPPER_URL` | `http://localhost:8081` |

These are referenced as `{{ $env.SEMANTIC_BACKEND_URL }}` and `{{ $env.WOO_WRAPPER_URL }}` in tool URLs.

---

## Tool 1: `semantic_search`

Search products by natural-language meaning (Arabic or English). This calls backend A.

| Field | Value |
|-------|-------|
| **Tool name** | `semantic_search` |
| **Method** | `POST` |
| **URL** | `{{ $env.SEMANTIC_BACKEND_URL }}/search` |
| **Headers** | `Content-Type: application/json` (auto) |
| **Body (JSON)** | see below |
| **Description for AI** | "Search the product catalog by meaning. Use Arabic or English natural-language queries. Returns ranked results with product metadata (name, price, SKU, image, etc.). Prefer this over keyword search for intent-based queries." |

### Request body

```json
{
  "query": "أحذية رياضية للجري",
  "top_k": 5,
  "mode": "hybrid",
  "match_threshold": 0.3
}
```

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `query` | string | — | Required. Natural-language or keyword text. Arabic supported. |
| `top_k` | int | `5` | Max results (1–100). |
| `mode` | enum | `"hybrid"` | `"hybrid"` (RRF fusion), `"semantic"` (vector only), or `"keyword"` (FTS only). |
| `match_threshold` | float | `0.3` | Minimum similarity score for semantic results (0–1). |
| `filters` | object | omitted | Optional jsonb filter, e.g. `{"brand":"Nike"}`. Applied via `metadata @> filter` in SQL. |

### Expected response (200)

```json
{
  "results": [
    {
      "id": "12345",
      "score": 0.87,
      "metadata": {
        "name": "حذاء رياضي للجري",
        "price": "299",
        "regular_price": "349",
        "sale_price": "299",
        "currency": "SAR",
        "sku": "SHOE-123",
        "stock_status": "instock",
        "type": "simple",
        "category_ids": [15, 22],
        "category_names": ["أحذية", "رياضية"],
        "brand": "Nike",
        "image_url": "https://iconnect-intl.com/store/wp-content/uploads/2024/01/shoe.jpg",
        "permalink": "https://iconnect-intl.com/store/product/shoe-123",
        "date_modified": "2024-06-15T10:30:00"
      }
    }
  ]
}
```

The `metadata` object is exactly what backend B composed and sent to A during sync (see the PRODUCT METADATA shape in the contract). `score` is a relevance score (higher = more relevant).

---

## Tool 2: `search_products`

Browse or filter the WooCommerce product catalog. This calls backend B.

| Field | Value |
|-------|-------|
| **Tool name** | `search_products` |
| **Method** | `GET` |
| **URL** | `{{ $env.WOO_WRAPPER_URL }}/api/products` |
| **Query parameters** | see below |
| **Description for AI** | "List or filter WooCommerce products by keyword, category, price range, sale status, or SKU. Use for structured browsing when the user wants specific filters. Returns paginated results." |

### Query parameters (all optional)

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `search` | string | — | WooCommerce keyword search. |
| `category` | string | — | Category ID or slug. |
| `per_page` | int | `10` | Results per page (1–50). |
| `page` | int | `1` | Page number. |
| `orderby` | enum | — | `date`, `id`, `title`, `slug`, `price`, `popularity`. |
| `order` | enum | — | `asc` or `desc`. |
| `min_price` | number | — | Minimum price. |
| `max_price` | number | — | Maximum price. |
| `on_sale` | boolean | — | Only sale items. |
| `featured` | boolean | — | Only featured products. |
| `sku` | string | — | Filter by SKU. |

### Example URL with query

```
{{ $env.WOO_WRAPPER_URL }}/api/products?search=running&per_page=5&orderby=price&order=asc
```

### Expected response (200)

```json
{
  "products": [
    {
      "id": 123,
      "name": "Running Shoe Pro",
      "price": "299",
      "regular_price": "349",
      "sale_price": "299",
      "currency": "SAR",
      "sku": "SHOE-123",
      "stock_status": "instock",
      "type": "simple",
      "status": "publish",
      "image_url": "https://iconnect-intl.com/store/wp-content/uploads/2024/01/shoe.jpg",
      "permalink": "https://iconnect-intl.com/store/product/shoe-123",
      "category_ids": [15, 22],
      "category_names": ["Shoes", "Sports"],
      "brand": "Nike",
      "attributes": { "Brand": "Nike", "Size": "42, 43, 44" },
      "short_desc": "Lightweight running shoe with breathable mesh upper..."
    }
  ],
  "total": 47,
  "page": 1,
  "total_pages": 5
}
```

---

## Tool 3: `get_product`

Fetch a single product by its WooCommerce ID. Calls backend B.

| Field | Value |
|-------|-------|
| **Tool name** | `get_product` |
| **Method** | `GET` |
| **URL** | `{{ $env.WOO_WRAPPER_URL }}/api/products/{{ $json.product_id }}` |
| **Description for AI** | "Get full details for a single product by its numeric ID. Use after search or when the user references a specific product." |

The `:id` in the path is the product's WooCommerce numeric ID (e.g. `123`). In an n8n HTTP Request node, set the URL to:

```
{{ $env.WOO_WRAPPER_URL }}/api/products/{{ $json.product_id }}
```

where `product_id` comes from a previous tool's output or the user's message.

### Expected response (200)

Same shape as a single element of the `products` array from `search_products` — the trimmed product object:

```json
{
  "id": 123,
  "name": "Running Shoe Pro",
  "price": "299",
  "regular_price": "349",
  "sale_price": "299",
  "currency": "SAR",
  "sku": "SHOE-123",
  "stock_status": "instock",
  "type": "simple",
  "status": "publish",
  "image_url": "https://...",
  "permalink": "https://...",
  "category_ids": [15, 22],
  "category_names": ["Shoes", "Sports"],
  "brand": "Nike",
  "attributes": { "Brand": "Nike", "Size": "42, 43, 44" },
  "short_desc": "Lightweight running shoe..."
}
```

---

## Tool 4: `list_categories`

List all WooCommerce product categories. Calls backend B.

| Field | Value |
|-------|-------|
| **Tool name** | `list_categories` |
| **Method** | `GET` |
| **URL** | `{{ $env.WOO_WRAPPER_URL }}/api/categories` |
| **Query parameters** | `parent` (optional) — category ID to list children only |
| **Description for AI** | "List product categories. Use to help the user browse by category or to find a category ID for filtering products." |

### Example URL

```
{{ $env.WOO_WRAPPER_URL }}/api/categories
```

Or to list children of a specific category:

```
{{ $env.WOO_WRAPPER_URL }}/api/categories?parent=15
```

### Expected response (200)

```json
[
  {
    "id": 15,
    "name": "إلكترونيات",
    "slug": "electronics",
    "parent": 0,
    "count": 120,
    "image": "https://iconnect-intl.com/store/wp-content/uploads/2023/12/electronics.jpg"
  },
  {
    "id": 22,
    "name": "أحذية",
    "slug": "shoes",
    "parent": 0,
    "count": 47,
    "image": null
  }
]
```

The response is a flat JSON array of trimmed category objects.

---

## Tool 5: `get_payment_gateways`

List available payment methods. Calls backend B.

| Field | Value |
|-------|-------|
| **Tool name** | `get_payment_gateways` |
| **Method** | `GET` |
| **URL** | `{{ $env.WOO_WRAPPER_URL }}/api/payment-gateways` |
| **Description for AI** | "List available payment methods. Use when the user asks about payment options or before placing an order." |

### Expected response (200)

```json
[
  {
    "id": "telr",
    "title": "Telr",
    "enabled": true
  },
  {
    "id": "cod",
    "title": "Cash on Delivery",
    "enabled": false
  }
]
```

Each gateway has an `id` (use as `payment_method` when placing an order), a `title` (display name), and `enabled` (whether it is active in the store).

---

## Tool 6: `place_order`

Create a new WooCommerce order. Calls backend B.

| Field | Value |
|-------|-------|
| **Tool name** | `place_order` |
| **Method** | `POST` |
| **URL** | `{{ $env.WOO_WRAPPER_URL }}/api/orders` |
| **Headers** | `Content-Type: application/json` (auto) |
| **Body (JSON)** | see below |
| **Description for AI** | "Place an order for the customer. Requires line_items (product_id + quantity) and billing info (name, phone, and optionally email and address). Optionally specify payment_method. Returns order ID, status, total, and payment URL." |

### Request body

```json
{
  "line_items": [
    {
      "product_id": 123,
      "quantity": 2
    }
  ],
  "billing": {
    "first_name": "محمد",
    "last_name": "العلي",
    "phone": "+966501234567",
    "email": "customer@example.com",
    "address_1": "حي النخيل، شارع الملك فهد",
    "city": "الرياض",
    "country": "SA"
  },
  "payment_method": "telr",
  "payment_method_title": "Telr",
  "customer_note": "يرجى التوصيل بعد العصر"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `line_items` | array | Yes | Min 1 item. Each: `{product_id: int, quantity: int (≥1)}`. |
| `billing.first_name` | string | Yes | Customer first name. |
| `billing.last_name` | string | No | Customer last name. |
| `billing.phone` | string | Yes | Phone number. |
| `billing.email` | string | No | Valid email. |
| `billing.address_1` | string | No | Street address. |
| `billing.city` | string | No | City. |
| `billing.country` | string | No | Country code (e.g. `SA` for KSA). |
| `payment_method` | string | No | Gateway ID from `get_payment_gateways` (e.g. `telr`). |
| `payment_method_title` | string | No | Display title (e.g. `Telr`). |
| `customer_note` | string | No | Customer note (Arabic supported). |

### Expected response (200)

```json
{
  "id": 9876,
  "status": "pending",
  "total": "598.00",
  "order_key": "wc_order_abc123def456",
  "payment_url": "https://iconnect-intl.com/store/checkout/order-pay/9876/?pay_for_order=true&key=wc_order_abc123def456"
}
```

- `id` — the WooCommerce order ID. Save this; the user will need it for tracking.
- `status` — initial order status (typically `pending`).
- `total` — order total in SAR.
- `order_key` — the order key (use with `track_order`).
- `payment_url` — checkout URL for the customer to complete payment (Telr or other gateway).

---

## Tool 7: `track_order`

Track an order by order ID + key, email, or phone. Calls backend B.

| Field | Value |
|-------|-------|
| **Tool name** | `track_order` |
| **Method** | `GET` |
| **URL** | `{{ $env.WOO_WRAPPER_URL }}/api/orders/track` |
| **Query parameters** | see below |
| **Description for AI** | "Track an order. Provide order_id + order_key, or email, or phone. Returns order status, items, and totals. Use when the customer wants to know their order status." |

### Query parameters

You must provide **one** of:

| Combination | Parameters |
|-------------|------------|
| Order ID + key | `order_id` (int) + `order_key` (string) |
| Email | `email` (valid email) |
| Phone | `phone` (string) |

### Example URLs

```
{{ $env.WOO_WRAPPER_URL }}/api/orders/track?order_id=9876&order_key=wc_order_abc123def456
{{ $env.WOO_WRAPPER_URL }}/api/orders/track?email=customer@example.com
{{ $env.WOO_WRAPPER_URL }}/api/orders/track?phone=+966501234567
```

### Expected response (200)

```json
{
  "id": 9876,
  "status": "processing",
  "total": "598.00",
  "currency": "SAR",
  "payment_method": "telr",
  "payment_method_title": "Telr",
  "customer_note": "يرجى التوصيل بعد العصر",
  "date_created": "2024-06-15T14:22:00",
  "order_key": "wc_order_abc123def456",
  "billing": {
    "first_name": "محمد",
    "phone": "+966501234567",
    "email": "m***@example.com"
  },
  "line_items": [
    {
      "product_id": 123,
      "name": "Running Shoe Pro",
      "quantity": 2,
      "total": "598.00"
    }
  ]
}
```

If not found, returns `404` with `{"error":"Order not found"}`.

Note: `billing.email` is masked for privacy (`m***@example.com`).

---

## n8n AI Agent Node — System Prompt Essentials

In the AI Agent node's system message, include these essentials so the agent operates correctly within the store context:

### Store Context

```
You are a shopping assistant for iConnect Intl., an online store based in Saudi Arabia.

LANGUAGE: Communicate in the customer's language. The store serves Arabic and English speakers.
  - Detect the customer's language and respond in the same language.
  - Product names, categories, and search support Arabic natively.

CURRENCY: All prices are in SAR (Saudi Riyal). Always display prices with "SAR" or "ر.س".

SHIPPING: The store ships within KSA (Kingdom of Saudi Arabia). Default country code is "SA".
  - Major cities: Riyadh (الرياض), Jeddah (جدة), Dammam (الدمام), Mecca (مكة), Medina (المدينة).

PAYMENT: The primary payment gateway is Telr (online card payment).
  - Use get_payment_gateways to check available methods before placing an order.
  - When placing an order with payment_method "telr", share the returned payment_url with the customer.

SEARCH: Use semantic_search for intent-based or natural-language queries (e.g. "أحذية رياضية", "shoes for running").
  - Use search_products for structured filtering (price range, category, sale items, SKU).
  - Semantic search returns ranked results with metadata — present the top results with name, price, image_url, and permalink.

ORDER FLOW:
  1. Confirm the product(s) and quantity with the customer.
  2. Collect billing info: first name, phone number, and optionally email and address.
  3. Call place_order with line_items + billing + payment_method.
  4. Share the order ID, total, and payment_url (if returned) with the customer.
  5. To track later, call track_order with the order_id + order_key, or the customer's email/phone.
```

### Important Reminders for the Agent

- **Never ask for WooCommerce keys** — the agent does not need them. Backend B handles WC authentication internally.
- **Never set a User-Agent header** — backend B handles the Cloudflare bypass. The agent's HTTP requests go to B, not to WooCommerce directly.
- **Prices are strings** (e.g. `"299"`) — not numbers. Display them with the SAR currency suffix.
- **`product_id` is an integer** (e.g. `123`), not a string. When passing from `semantic_search` results (where `id` is a string) to `get_product` or `place_order`, convert to integer.

---

## Sync Keeps Search Fresh — No n8n Needed

Backend B automatically keeps backend A's search index up to date through two mechanisms, **neither of which involves n8n**:

1. **Webhook (real-time):** When a product is created, updated, or deleted in WooCommerce, WC fires a webhook to `POST /webhook/wc` on backend B. B verifies the HMAC signature, then immediately upserts (or deletes) the product in A via `POST /index` (or `DELETE /:id`).

2. **Delta-sync (periodic):** If `SYNC_ENABLED=true`, B polls WooCommerce every `SYNC_INTERVAL_MIN` minutes for products modified since the last sync, and upserts each into A. This catches changes even if a webhook delivery fails.

You can also trigger a manual full re-index at any time:

```
curl -X POST {{ $env.WOO_WRAPPER_URL }}/sync/bulk
```

Or a one-shot delta sync:

```
curl -X POST {{ $env.WOO_WRAPPER_URL }}/sync/delta
```

Because of this automatic sync, the n8n agent can always call `semantic_search` and get fresh results — there is no need for n8n to trigger indexing.

---

## Quick Reference: All Tools

| # | Tool name | Method | URL | Purpose |
|---|-----------|--------|-----|---------|
| 1 | `semantic_search` | POST | `{{ $env.SEMANTIC_BACKEND_URL }}/search` | Semantic/hybrid/keyword product search |
| 2 | `search_products` | GET | `{{ $env.WOO_WRAPPER_URL }}/api/products` | List/filter WC products |
| 3 | `get_product` | GET | `{{ $env.WOO_WRAPPER_URL }}/api/products/:id` | Single product details |
| 4 | `list_categories` | GET | `{{ $env.WOO_WRAPPER_URL }}/api/categories` | List product categories |
| 5 | `get_payment_gateways` | GET | `{{ $env.WOO_WRAPPER_URL }}/api/payment-gateways` | Available payment methods |
| 6 | `place_order` | POST | `{{ $env.WOO_WRAPPER_URL }}/api/orders` | Create a new order |
| 7 | `track_order` | GET | `{{ $env.WOO_WRAPPER_URL }}/api/orders/track` | Track order by ID+key, email, or phone |
