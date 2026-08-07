# WooCommerce Chatbot — Comprehensive Implementation Plan

**Store:** https://iconnect-intl.com/store
**Document Date:** 2026-08-02
**WooCommerce Version:** 10.9.4 | WordPress | Language: ar (Arabic) | Currency: SAR

---

## 1. Executive Summary

This document is the complete specification for a Claude-powered conversational chatbot for the iConnect International WooCommerce store. The chatbot enables customers to browse a catalog of **704 products** (all simple-type), add items to a cart, complete checkout with shipping and payment, and track orders — all through natural-language conversation in Arabic or English.

The store operates on WooCommerce 10.9.4 with a Saudi Arabia-focused storefront (Arabic language, SAR currency). It uses guest checkout (no registered customers), a single active payment gateway (**Telr — `wctelr`** for online credit/debit card payments), and two shipping methods for Saudi Arabia (free shipping + flat rate). Orders auto-sync to the **OTO** shipping/logistics platform via six active webhooks.

The recommended architecture is a **hybrid API approach**: the **Store API** (`/wc/store/`) powers the cart-and-checkout pipeline (session cart, automatic shipping/tax calculation, payment gateway integration), while the **Classic REST API** (`/wc/v3/`) handles product reads with advanced filtering, order management, payment gateway listing, and admin operations. The chatbot brain is the **Claude API** (Anthropic) using function-calling (tool use), with an **Node.js/Express backend proxy** that executes all WooCommerce HTTP calls server-side, keeping API keys and cart tokens entirely off the client.

### Store & Credentials Summary

| Item | Value |
|---|---|
| Store URL | `https://iconnect-intl.com/store` |
| Classic REST API base | `https://iconnect-intl.com/store/wp-json/wc/v3` |
| Store API base | `https://iconnect-intl.com/store/wp-json/wc/store` |
| API key (consumer key) | `ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b` |
| API secret (consumer secret) | `cs_234e5af2614e76e372b33675fbcc3ea80eedba3e` |
| Key permissions | **Read/Write** (can create orders, update products, etc.) |
| Currency | SAR (Saudi Riyal), symbol ر.س |
| Store language | `ar` (Arabic, RTL) |
| Total products | 704 (Classic API) / 703 (Store API — minor count discrepancy) |
| Product types | All simple (1,320 per reports/totals — includes trashed/drafts; 704 published) |
| Shipping zones | Zone 1 = Saudi Arabia (2 methods); Zone 0 = Rest of World (no methods) |
| Active payment gateway | `wctelr` (Telr — online credit/debit card) |
| Disabled gateways | `cod` (Cash on Delivery — used historically, now disabled), `bacs` (bank transfer), `cheque`, `wc_telr_apple_pay` |
| Tax | No tax rates configured (all orders show `total_tax=0.00`) |
| Coupons | None configured |
| Customers | None registered (guest checkout store) |
| Webhooks | 6 active — all OTO (tryoto.com) shipping integration |

### Cloudflare Caveat & Mitigation

Cloudflare bot protection is **ACTIVE and INTERMITTENT** on this store. Requests may receive an HTML "Just a moment..." challenge page (HTTP 200 or 403) instead of JSON.

**Mitigation (two options):**

1. **Preferred (infrastructure-level):** Whitelist the API paths `/store/wp-json/wc/v3/*` and `/store/wp-json/wc/store/*` from Cloudflare challenge rules in the Cloudflare dashboard. This eliminates challenges entirely for server-to-server API traffic.

2. **Fallback (application-level):** Every HTTP request must include:
   - `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36`
   - `Accept: application/json`
   - A retry loop: up to 6 attempts, sleeping 2 seconds between tries. If the response body starts with `<!DOCTYPE` or `<html` (Cloudflare challenge), retry. Only accept responses whose body starts with `[` or `{` (real JSON).

---

## 2. Full Endpoint Inventory — Master Table

All endpoints were probed live against the store. Statuses and notes reflect actual probe results.

### Classic REST API (`/wc/v3/`) — requires Basic Auth (`ck_`/`cs_` keys)

| Family | Endpoint | Method | Auth | Live Status | Chatbot Use |
|---|---|---|---|---|---|
| Products | `products` | GET | ck_/cs_ | **200** — 704 total products (`X-WP-Total: 704`). Supports `search`, `category`, `orderby`/`order`, `featured`, `on_sale`, `per_page`/`page` pagination. | Primary product search (richer filtering than Store API) |
| Products | `products/{id}` | GET | ck_/cs_ | **200** — e.g. product 8825 (Hikvision CAT6 cable, 468.63 SAR, simple, instock). Fields: `id`, `name`, `price`, `regular_price`, `sale_price`, `sku`, `stock_status`, `images`, `categories`, `attributes`, `short_description`, `description`, `permalink`, `type`. | Full product detail retrieval |
| Products | `products/{id}/variations` | GET | ck_/cs_ | **200** — empty `[]` for product 8825 (simple product). Endpoint valid. | Fetch variations for variable products (none currently exist) |
| Products | `products/{id}/reviews` | GET | ck_/cs_ | **404** — `rest_no_route`. Reviews sub-route not registered. | Unavailable — skip or use alternative |
| Products | `products/{id}/downloads` | GET | ck_/cs_ | **404** — `rest_no_route`. Downloads are in the product object's `downloads` field. | N/A |
| Categories | `products/categories` | GET | ck_/cs_ | **200** — 32 categories (Store API count). First: id 392 ("Access Control Devices"). Fields: `id`, `name`, `slug`, `parent`, `description`, `image`, `count`. | Category browsing & filtering |
| Tags | `products/tags` | GET | ck_/cs_ | **200** — Fields: `id`, `name`, `slug`, `count`. First tag: id 1858. | Tag-based filtering (low priority) |
| Attributes | `products/attributes` | GET | ck_/cs_ | **200** — Attributes: id 9 (Audio), 57 (Authentication Method), 4 (Camera Type), 30 (Channels), 1 (Color), 46 (Connectivity), 12 (Dimensions), 59 (Direction), and more. | Attribute-based product filtering |
| Attributes | `products/attributes/{id}/terms` | GET | ck_/cs_ | **200** — e.g. attribute 9 terms: first term id 2541 ("16 CH Input / 1 CH Output", count 2). | Attribute term listing for filters |
| Brands | `products/brands` | GET | ck_/cs_ | **200** — Brands endpoint works (plugin installed). First brand: id 104 ("Acer"). Fields: `id`, `name`, `slug`, `parent`, `count`. | Brand-based browsing & filtering |
| Shipping Classes | `products/shipping_classes` | GET | ck_/cs_ | **200** — One class: id 238 ("Free Shipping Product"). | Shipping class reference (low priority) |
| Orders | `orders` | GET | ck_/cs_ | **200** — Returns full order data. Fields: `id`, `status`, `total`, `currency`, `customer_id`, `payment_method`, `billing`, `shipping`, `line_items`, `customer_note`, `date_created`, `order_key`. | Order tracking (by ID, email, customer_id) |
| Orders | `orders/{id}` | GET | ck_/cs_ | **200** — e.g. order 6587: status=processing, total=13728.00 SAR, payment=cod, customer_id=2, 1 line item (HUAWEI IdeaHub B3 65", product_id=4509). | Single-order lookup |
| Orders | `orders` | POST | ck_/cs_ | Available (not tested — would create order). | Alternative order creation (no payment processing) |
| Orders | `orders/{id}` | PUT | ck_/cs_ | Available (not tested — would update order). | Order status updates (admin) |
| Order Notes | `orders/{id}/notes` | GET | ck_/cs_ | **200** — e.g. order 6587 has 1 note (Arabic: "Payment to be made upon delivery. Order status changed from awaiting payment to processing."). | Order status timeline/history |
| Order Refunds | `orders/{id}/refunds` | GET | ck_/cs_ | **200** — empty `[]` for order 6587. | Check for refunds on an order |
| Customers | `customers` | GET | ck_/cs_ | **200** — empty `[]`. Store uses guest checkout. No registered customers. | N/A — use orders endpoint with `customer_id` filter instead |
| Coupons | `coupons` | GET | ck_/cs_ | **200** — empty `[]`. No coupons configured. | N/A — no coupons exist |
| Payment Gateways | `payment_gateways` | GET | ck_/cs_ | **200** — 5 gateways. Only `wctelr` enabled. Others: `cod` (disabled), `bacs` (disabled), `cheque` (disabled), `wc_telr_apple_pay` (disabled). | List available payment methods for checkout |
| Shipping Zones | `shipping/zones` | GET | ck_/cs_ | **200** — Zone 0 (Rest of World, no methods), Zone 1 (Saudi Arabia, 2 methods: free_shipping + flat_rate). | Shipping zone configuration reference |
| Shipping Methods | `shipping/zones/{id}/methods` | GET | ck_/cs_ | **200** — Zone 1: instance 1 (free_shipping, enabled), instance 2 (flat_rate, enabled). | Shipping method listing for checkout |
| Taxes | `taxes/classes` | GET | ck_/cs_ | **200** — 3 classes: `standard`, `reduced-rate`, `zero-rate`. | Low priority — no rates configured |
| Taxes | `taxes/rates` | GET | ck_/cs_ | **404** — `rest_no_route`. Endpoint does not exist. Correct path is `/taxes` (not `/taxes/rates`). | N/A |
| Settings | `settings` | GET | ck_/cs_ | **200** — 33 setting groups (general, products, tax, shipping, checkout, account, email, integration, etc.). | Store configuration reads (low priority) |
| Data | `data/continents` | GET | ck_/cs_ | **200** — 188 KB. Continent/country/state lists with Arabic names. | Checkout address form population |
| Data | `data/countries` | GET | ck_/cs_ | **200** — 218 KB. Country codes, Arabic names, state subdivisions. | Address validation for checkout |
| Data | `data/currencies` | GET | ck_/cs_ | **200** — 57 KB. Currency codes, names, symbols. | Reference data |
| Reports | `reports` | GET | ck_/cs_ | **200** — 10 report types (sales, top_sellers, orders/totals, products/totals, customers/totals, coupons/totals, reviews/totals, categories/totals, tags/totals, attributes/totals). | Admin analytics (low chatbot priority) |
| Reports | `reports/sales` | GET | ck_/cs_ | **200** — total_sales=0, total_orders=0 (today). | Low priority |
| Reports | `reports/orders/totals` | GET | ck_/cs_ | **200** — processing: 3, cancelled: 2, failed: 1, pending: 0, completed: 0. | Order status overview |
| Reports | `reports/products/totals` | GET | ck_/cs_ | **200** — simple: 1320 products, variable: 0. | Catalog composition |
| Reports | `reports/products` | GET | ck_/cs_ | **404** — `rest_no_route`. Legacy endpoint. Use `/reports/products/totals` instead. | N/A |
| Reports | `reports/orders` | GET | ck_/cs_ | **404** — `rest_no_route`. Legacy endpoint. Use `/reports/orders/totals` instead. | N/A |
| Webhooks | `webhooks` | GET | ck_/cs_ | **200** — 6 active webhooks, all OTO (tryoto.com) shipping integration. | Reference — orders auto-sync to OTO |

### Store API (`/wc/store/`) — customer-facing, uses Cart-Token + Nonce

| Family | Endpoint | Method | Auth | Live Status | Chatbot Use |
|---|---|---|---|---|---|
| Products | `products` | GET | Public (no auth) | **200** — 703 products (`X-WP-Total: 703`). Returns storefront-optimized fields: `id`, `name`, `prices` (minor units), `images`, `categories`, `tags`, `brands`, `attributes`, `is_in_stock`, `add_to_cart`, `average_rating`, `review_count`. | Product browsing (public, no keys needed) |
| Products | `products/{id}` | GET | Public (no auth) | **200** — e.g. product 8825. Prices in minor units (46863 = 468.63 SAR). Includes `add_to_cart` object with `url`, `minimum`, `maximum`. | Product detail for customers |
| Categories | `products/categories` | GET | Public (no auth) | **200** — 32 categories. Fields: `id`, `name`, `slug`, `description`, `parent`, `count`, `image`, `permalink`. | Category browsing (public) |
| Cart | `cart` | GET | Cart-Token (optional for first call) | **200** — Returns empty cart with `totals`, `shipping_address`, `billing_address`, `payment_methods: ["wctelr"]`, `needs_payment: false`, `needs_shipping: false`. Response headers: `nonce`, `cart-token` (JWT), `user-id: 0`. | Initialize cart session, retrieve cart state |
| Cart | `cart/add-item` | POST | Cart-Token + Nonce | **201 Created** — Body: `{"id":8825,"quantity":1}`. Returns full cart with item added. Sets `wp_woocommerce_session_*` cookie (48h). Returns updated `cart-token` and `cart-hash`. | Add product to cart |
| Cart | `cart/update-item` | POST | Cart-Token + Nonce | Available (standard Store API endpoint). | Update cart item quantity |
| Cart | `cart/remove-item` | POST | Cart-Token + Nonce | Available (standard Store API endpoint). | Remove cart item |
| Cart | `cart/apply-coupon` | POST | Cart-Token + Nonce | Available (standard Store API endpoint). No coupons configured on store. | Apply coupon (currently N/A) |
| Cart | `cart/coupons` | DELETE | Cart-Token + Nonce | Available (standard Store API endpoint). | Remove coupon (currently N/A) |
| Cart | `cart/update-customer` | POST | Cart-Token + Nonce | Available (standard Store API endpoint). Sets billing/shipping address, triggers shipping/tax recalculation. | Set customer address for checkout |
| Cart | `cart/select-shipping` | POST | Cart-Token + Nonce | Available (standard Store API endpoint). Selects a shipping rate. | Choose shipping method |
| Checkout | `checkout` | GET | Nonce required | **200** with Nonce (401 without). Returns draft checkout: `order_id: 0`, `status: "checkout-draft"`, `payment_method: "wctelr"`, embedded cart. | Retrieve checkout state |
| Checkout | `checkout` | POST | Cart-Token + Nonce | Available (standard Store API endpoint). Processes payment via active gateway, creates order, sends emails. | Place order (primary checkout path) |
| Checkout | `checkout` | PUT/PATCH | Cart-Token + Nonce | Available (standard Store API endpoint). Update checkout fields. | Update checkout before placing |
| Orders | `order/{id}` | GET | Order key (+ billing email) | Available (Store API endpoint). Requires `?key={order_key}` parameter. | Track order by ID + key (no admin auth needed) |

---

## 3. Store API vs Classic `/wc/v3/` API — When to Use Which

### Comparison

| Dimension | Classic API (`/wc/v3/`) | Store API (`/wc/store/`) |
|---|---|---|
| **Auth model** | Basic Auth (ck_/cs_ keys), server-side only | Cart-Token (JWT) + WordPress nonce, customer-facing |
| **Product prices** | Major units as strings (`"468.63"`) | Minor units as integers (`46863`) with inline currency metadata |
| **Product fields** | Admin-level: `status`, `catalog_visibility`, `total_sales`, `manage_stock`, `stock_quantity`, `meta_data`, `cross_sell_ids`, `upsell_ids`, `tax_status`, etc. | Storefront-level: `is_in_stock`, `is_purchasable`, `add_to_cart` (url, minimum, maximum), `stock_availability`, `prices` (with currency context) |
| **Cart** | **No cart endpoints.** No session cart, no cart totals engine, no stock hold. | Full session cart: add, update, remove items, apply coupons, calculate shipping/tax, select shipping rate. |
| **Checkout** | **No checkout endpoint.** `POST /orders` creates an order record but does NOT process payment through any gateway. | `POST /checkout` processes payment via active gateway (Telr), creates proper order, sends emails, decrements stock. |
| **Payment gateway** | Can list gateways (`GET /payment_gateways`) but cannot process payments. | Natively integrates with active gateways at checkout. Returns `payment_result` with redirect URL or success/failure. |
| **Shipping** | Can list configured zones/methods (admin config) but cannot calculate live rates for a cart. | Calculates live shipping rates for the cart based on customer address and configured zones. |
| **Tax** | No tax calculation engine. Must hardcode amounts. | Automatic tax calculation (though this store currently has 0% tax). |
| **Coupons** | Can list/create coupon definitions (admin CRUD) but cannot apply to a cart. | Applies coupons to cart, recalculates discounts. |
| **Order management** | Full CRUD: create, read, update, delete orders. Admin-level access. | Read-only: `GET /order/{id}` with order key for customer tracking. No list/update. |
| **Product filtering** | Rich: `search`, `category`, `attribute`, `attribute_term`, `min_price`, `max_price`, `on_sale`, `featured`, `orderby`, `slug`, `sku`. | More limited: `search`, `category`, `min_price`, `max_price`, `on_sale`, `featured`, `orderby`. No `sku` or `slug` filters. |
| **Reviews** | `GET products/{id}/reviews` — **404 on this store** (not registered). | Not available as separate endpoint. |

### Final Recommendation for Order Placement

**Use the Store API cart-to-checkout pipeline (`POST /wc/store/checkout`) for order placement.** This is the correct and only path that:

1. **Processes real payment** through the active Telr (`wctelr`) gateway — the classic API cannot do this.
2. **Automatically calculates** shipping rates, tax (currently 0%), and totals — no manual amount hardcoding.
3. **Holds stock** during cart assembly and finalizes decrement at checkout — prevents overselling.
4. **Triggers WooCommerce emails** (order confirmation, customer invoice) as part of the normal checkout flow.
5. **Supports guest checkout** natively (cart-token JWT identifies the session, `user_id: 0`).

**The classic API (`POST /wc/v3/orders`) should only be used as a fallback** for specific scenarios:
- Creating COD-only orders where payment processing is not needed (but note: `cod` is currently **disabled** on this store).
- Admin-level order management after the order exists (status updates, refunds, note additions).

**Hybrid approach (best of both worlds for cart totals + direct order):** Use the Store API cart flow up through step 5 (get calculated totals with shipping), then if a specific gateway integration requires it, create the order via classic API using those calculated totals. This is an edge-case fallback; the primary path should always be `POST /wc/store/checkout`.

---

## 4. Chatbot Capabilities (Intent List) Mapped to Endpoints

| # | Chatbot Intent | User Utterance Example | Tool Name | API Surface | Endpoint(s) |
|---|---|---|---|---|---|
| 1 | Browse categories | "أشوف الأقسام" / "Show me categories" | `list_categories` | Store API | `GET /wc/store/products/categories?parent={p}` |
| 2 | Search products | "أبغى سماعات بلوتوث" / "I want Bluetooth headphones" | `search_products` | Store API (primary), Classic (fallback) | `GET /wc/store/products?search=...` or `GET /wc/v3/products?search=...` |
| 3 | View product details | "أرني تفاصيل المنتج" / "Show me product details" | `get_product` | Store API + Classic | `GET /wc/store/products/{id}` + `GET /wc/v3/products/{id}/variations` |
| 4 | Get recommendations | "اقترح لي منتجات" / "Recommend products" | `get_recommendations` | Store API | `GET /wc/store/products/{id}` → `GET /wc/store/products?include={ids}` |
| 5 | Add to cart | "ضيفه للسلة" / "Add to cart" | `add_to_cart` | Store API | `POST /wc/store/cart/add-item` |
| 6 | View cart | "أشوف سلتي" / "Show my cart" | `get_cart` | Store API | `GET /wc/store/cart` |
| 7 | Update quantity | "غيّر الكمية لـ ٢" / "Change quantity to 2" | `update_cart_item` | Store API | `POST /wc/store/cart/update-item` |
| 8 | Remove item | "احذف المنتج" / "Remove this item" | `remove_cart_item` | Store API | `POST /wc/store/cart/remove-item` |
| 9 | Apply coupon | "عندي كوبون" / "I have a coupon" | `apply_coupon` | Store API | `POST /wc/store/cart/apply-coupon` |
| 10 | Remove coupon | "شيل الكوبون" / "Remove the coupon" | `remove_coupon` | Store API | `DELETE /wc/store/cart/coupons?code={code}` |
| 11 | Set delivery address | "عنواني..." / "My address is..." | `update_cart_customer_address` | Store API | `POST /wc/store/cart/update-customer` |
| 12 | View shipping options | "كم الشحن؟" / "What are shipping options?" | `get_shipping_methods` | Store API | `GET /wc/store/cart` (extract `shipping_rates`) |
| 13 | Select shipping | "الشحن العادي" / "Standard shipping" | `select_shipping_method` | Store API | `POST /wc/store/cart/select-shipping` |
| 14 | View payment methods | "طرق الدفع؟" / "Payment methods?" | `get_payment_methods` | Classic API | `GET /wc/v3/payment_gateways?enabled=true` |
| 15 | Place order / checkout | "أكمل الدفع" / "Checkout" | `place_order` | Store API | `POST /wc/store/checkout` |
| 16 | Track order | "تتبع طلبي" / "Track my order" | `track_order` | Store API / Classic | `GET /wc/store/order/{id}?key={key}` or `GET /wc/v3/orders?billing_email=...` |
| 17 | View order history | "طلباتي السابقة" / "My past orders" | `get_order_history` | Classic API | `GET /wc/v3/orders?customer={id}` (requires WP auth) |
| 18 | List product reviews | "المراجعات؟" / "Reviews?" | `list_product_reviews` | Classic API | `GET /wc/v3/products/{id}/reviews` (note: 404 on this store) |

**Note on reviews:** The `products/{id}/reviews` endpoint returns 404 (`rest_no_route`) on this store. Reviews are not available via the API. The `get_product` tool can still surface `average_rating` and `review_count` from the Store API product response, but individual review text is unavailable.

---

## 5. LLM Tool (Function-Calling) Definitions

These are the complete JSON function specifications for Claude's tool-use interface. Each tool is what Claude sees; the backend proxy executes the actual HTTP call internally. Copy-paste ready.

### 5.1 `list_categories`

```json
{
  "name": "list_categories",
  "description": "Browse the store's category tree. Returns category names, IDs, image URLs, and product counts. Use parent=0 (or omit) for top-level; pass a parent ID to drill into subcategories.",
  "input_schema": {
    "type": "object",
    "properties": {
      "parent": {
        "type": "integer",
        "description": "Parent category ID. 0 = top-level. Omit to list all.",
        "default": 0
      },
      "per_page": {
        "type": "integer",
        "default": 50,
        "maximum": 100
      }
    }
  }
}
```

**Internal endpoint:** `GET /wc/store/products/categories?parent={parent}&per_page={per_page}` (Store API, public). Fallback: `GET /wc/v3/products/categories?parent={parent}` (Classic, with keys).

---

### 5.2 `search_products`

```json
{
  "name": "search_products",
  "description": "Search the product catalog by keyword, category, attributes (e.g. color, size), price range, on-sale status, or featured status. Returns product name, ID, price, image thumbnail, rating, and stock status. At least one filter should be provided.",
  "input_schema": {
    "type": "object",
    "properties": {
      "search": {
        "type": "string",
        "description": "Free-text search term (Arabic or English)"
      },
      "category": {
        "type": "string",
        "description": "Category slug (e.g. 'electronics', 'clothing') or numeric ID"
      },
      "attribute": {
        "type": "object",
        "description": "Attribute filter. Key = attribute slug, Value = term slug(s).",
        "properties": {
          "name": {
            "type": "string",
            "description": "Attribute slug (e.g. 'color', 'size')"
          },
          "terms": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Term slugs (e.g. ['red','blue'])"
          }
        }
      },
      "min_price": {
        "type": "number",
        "description": "Minimum price in SAR"
      },
      "max_price": {
        "type": "number",
        "description": "Maximum price in SAR"
      },
      "on_sale": {
        "type": "boolean",
        "description": "Only products currently on sale"
      },
      "featured": {
        "type": "boolean",
        "description": "Only featured products"
      },
      "orderby": {
        "type": "string",
        "enum": ["relevance", "price-asc", "price-desc", "popularity", "rating", "date", "title"],
        "default": "relevance"
      },
      "page": {
        "type": "integer",
        "default": 1
      },
      "per_page": {
        "type": "integer",
        "default": 12,
        "maximum": 50
      }
    }
  }
}
```

**Internal endpoint:** `GET /wc/store/products?search={search}&category={category}&min_price={min}&max_price={max}&on_sale={on_sale}&featured={featured}&orderby={orderby}&page={page}&per_page={per_page}` (Store API, public). Fallback to `GET /wc/v3/products?...` (Classic, with keys) for attribute filtering.

---

### 5.3 `get_product`

```json
{
  "name": "get_product",
  "description": "Get complete product details including description, all images, available variations (for variable products), stock status, attributes, and related product IDs. Use this when the user asks about a specific product or wants more details.",
  "input_schema": {
    "type": "object",
    "properties": {
      "product_id": {
        "type": "integer",
        "description": "WooCommerce product ID"
      },
      "include_reviews": {
        "type": "boolean",
        "default": true
      },
      "include_variations": {
        "type": "boolean",
        "default": true
      },
      "include_related": {
        "type": "boolean",
        "default": true
      }
    },
    "required": ["product_id"]
  }
}
```

**Internal endpoints (parallel):**
- `GET /wc/store/products/{id}` — product data (Store API, public)
- `GET /wc/v3/products/{id}/variations` — variation data (Classic, with keys; only if variable product)
- `GET /wc/v3/products?include={related_ids}` — related products (from product response)

---

### 5.4 `get_recommendations`

```json
{
  "name": "get_recommendations",
  "description": "Get product recommendations. Can be based on: (a) products in the same category as a given product, (b) related products as defined by WooCommerce, or (c) a natural-language recommendation query that the LLM reasons about using search results. Returns 3-6 recommended products with name, price, and thumbnail.",
  "input_schema": {
    "type": "object",
    "properties": {
      "type": {
        "type": "string",
        "enum": ["related", "category", "llm-driven"],
        "default": "related"
      },
      "product_id": {
        "type": "integer",
        "description": "Source product ID (required for 'related' and 'category' types)"
      },
      "query": {
        "type": "string",
        "description": "Natural-language recommendation intent (for 'llm-driven' type), e.g. 'gifts under 200 SAR for a teenager'"
      },
      "limit": {
        "type": "integer",
        "default": 4,
        "maximum": 10
      }
    }
  }
}
```

**Internal endpoints:**
- `related`: `GET /wc/store/products/{id}` → extract `related_ids` → `GET /wc/store/products?include={ids}`
- `category`: `GET /wc/store/products/{id}` → extract `categories[0].id` → `GET /wc/store/products?category={id}&orderby=popularity&per_page={limit}`
- `llm-driven`: Backend calls `search_products` internally with parsed filters from the query, then Claude ranks/summarizes results.

---

### 5.5 `add_to_cart`

```json
{
  "name": "add_to_cart",
  "description": "Add a product or a specific variation of a product to the shopping cart. For variable products, a variation_id and selected attributes are required. If this is the first cart action, a new cart session is created automatically.",
  "input_schema": {
    "type": "object",
    "properties": {
      "product_id": {
        "type": "integer",
        "description": "Product ID"
      },
      "variation_id": {
        "type": "integer",
        "description": "Variation ID (for variable products only)"
      },
      "variation_attributes": {
        "type": "object",
        "description": "Selected attributes for the variation, e.g. {\"color\":\"red\",\"size\":\"M\"}",
        "additionalProperties": { "type": "string" }
      },
      "quantity": {
        "type": "integer",
        "default": 1,
        "minimum": 1,
        "maximum": 99
      }
    },
    "required": ["product_id"]
  }
}
```

**Internal endpoint:** `POST /wc/store/cart/add-item`
- Body: `{"id": product_id, "variation": [{"attribute": "color", "value": "red"}], "quantity": qty}`
- Headers: `Cart-Token: <jwt>` (from session), `Nonce: <nonce>`, `User-Agent`, `Accept`
- Response: updated cart object + new `cart-token` header (saved to session)

---

### 5.6 `get_cart`

```json
{
  "name": "get_cart",
  "description": "Retrieve the full cart: line items (name, qty, price, image), subtotal, discount, shipping, tax, total, applied coupons, available shipping methods, and payment methods. If the cart is empty, returns a message indicating so.",
  "input_schema": {
    "type": "object",
    "properties": {}
  }
}
```

**Internal endpoint:** `GET /wc/store/cart`
- Headers: `Cart-Token: <jwt>` (from session)
- Response includes: `items[]`, `totals`, `coupons[]`, `shipping_rates[]`, `payment_methods[]`, `cross_sells[]`

---

### 5.7 `update_cart_item`

```json
{
  "name": "update_cart_item",
  "description": "Change the quantity of an item in the cart. Set quantity to 0 to remove the item. Returns updated cart summary.",
  "input_schema": {
    "type": "object",
    "properties": {
      "cart_item_key": {
        "type": "string",
        "description": "Line item key from the cart (e.g. 'a1b2c3...')"
      },
      "quantity": {
        "type": "integer",
        "minimum": 0,
        "maximum": 99
      }
    },
    "required": ["cart_item_key", "quantity"]
  }
}
```

**Internal endpoint:** `POST /wc/store/cart/update-item`
- Body: `{"key": cart_item_key, "quantity": qty}`
- Headers: `Cart-Token: <jwt>`, `Nonce: <nonce>`

---

### 5.8 `remove_cart_item`

```json
{
  "name": "remove_cart_item",
  "description": "Remove an item from the cart completely.",
  "input_schema": {
    "type": "object",
    "properties": {
      "cart_item_key": {
        "type": "string"
      }
    },
    "required": ["cart_item_key"]
  }
}
```

**Internal endpoint:** `POST /wc/store/cart/remove-item`
- Body: `{"key": cart_item_key}`
- Headers: `Cart-Token: <jwt>`, `Nonce: <nonce>`

---

### 5.9 `apply_coupon`

```json
{
  "name": "apply_coupon",
  "description": "Apply a discount coupon code to the cart. Returns updated totals.",
  "input_schema": {
    "type": "object",
    "properties": {
      "coupon_code": {
        "type": "string",
        "description": "Coupon code (case-sensitive)"
      }
    },
    "required": ["coupon_code"]
  }
}
```

**Internal endpoint:** `POST /wc/store/cart/apply-coupon`
- Body: `{"code": coupon_code}`
- Headers: `Cart-Token: <jwt>`, `Nonce: <nonce>`

---

### 5.10 `remove_coupon`

```json
{
  "name": "remove_coupon",
  "description": "Remove an applied coupon from the cart.",
  "input_schema": {
    "type": "object",
    "properties": {
      "coupon_code": {
        "type": "string"
      }
    },
    "required": ["coupon_code"]
  }
}
```

**Internal endpoint:** `DELETE /wc/store/cart/coupons?code={coupon_code}`
- Headers: `Cart-Token: <jwt>`, `Nonce: <nonce>`

---

### 5.11 `update_cart_customer_address`

```json
{
  "name": "update_cart_customer_address",
  "description": "Set the customer's billing and/or shipping address on the cart. This is required before shipping methods can be retrieved and before checkout. Also accepts email and phone.",
  "input_schema": {
    "type": "object",
    "properties": {
      "first_name": { "type": "string" },
      "last_name": { "type": "string" },
      "email": { "type": "string", "format": "email" },
      "phone": { "type": "string" },
      "address_1": { "type": "string" },
      "address_2": { "type": "string" },
      "city": { "type": "string" },
      "state": { "type": "string" },
      "postcode": { "type": "string" },
      "country": {
        "type": "string",
        "description": "ISO 3166-1 alpha-2 country code, e.g. SA",
        "default": "SA"
      }
    },
    "required": ["first_name", "last_name", "email", "address_1", "city", "country", "phone"]
  }
}
```

**Internal endpoint:** `POST /wc/store/cart/update-customer`
- Body:
  ```json
  {
    "billing_address": {
      "first_name": "...", "last_name": "...", "email": "...",
      "phone": "...", "address_1": "...", "city": "...",
      "country": "SA", "state": "..."
    },
    "shipping_address": { "...same or different..." }
  }
  ```
- Headers: `Cart-Token: <jwt>`, `Nonce: <nonce>`

---

### 5.12 `get_shipping_methods`

```json
{
  "name": "get_shipping_methods",
  "description": "Retrieve available shipping methods and rates for the current cart, given the shipping address already set on the cart. Returns method IDs, titles, and costs. Call update_cart_customer_address first.",
  "input_schema": {
    "type": "object",
    "properties": {}
  }
}
```

**Internal endpoint:** `GET /wc/store/cart` → extract `shipping_rates[]` from the cart response. Each rate has `rate_id`, `name`, `price`, `currency`.
- Alternative reference: `GET /wc/v3/shipping/zones` → `GET /wc/v3/shipping/zones/{id}/methods` (Classic, to list all configured shipping zones/methods).

---

### 5.13 `select_shipping_method`

```json
{
  "name": "select_shipping_method",
  "description": "Select a shipping method for the current cart. Use the rate_id from get_shipping_methods.",
  "input_schema": {
    "type": "object",
    "properties": {
      "rate_id": {
        "type": "string",
        "description": "Shipping rate ID from get_shipping_methods"
      }
    },
    "required": ["rate_id"]
  }
}
```

**Internal endpoint:** `POST /wc/store/cart/select-shipping`
- Body: `{"rate_id": rate_id}`
- Headers: `Cart-Token: <jwt>`, `Nonce: <nonce>`

---

### 5.14 `get_payment_methods`

```json
{
  "name": "get_payment_methods",
  "description": "List all enabled payment gateways on the store. Returns method ID, title, description, and whether it supports inline payment or redirect.",
  "input_schema": {
    "type": "object",
    "properties": {}
  }
}
```

**Internal endpoint:** `GET /wc/v3/payment_gateways?enabled=true` (Classic, with keys)

---

### 5.15 `place_order`

```json
{
  "name": "place_order",
  "description": "Place the order from the current cart contents. Requires shipping address to be set and a shipping method selected. Returns order ID, order key, order total, and payment instructions/redirect URL if the payment gateway requires off-site redirect. For Cash on Delivery, the order is immediately confirmed.",
  "input_schema": {
    "type": "object",
    "properties": {
      "payment_method": {
        "type": "string",
        "description": "Payment method ID from get_payment_methods (e.g. 'wctelr', 'cod')"
      },
      "create_account": {
        "type": "boolean",
        "description": "If true and the email is not registered, create a customer account. Guest checkout if false.",
        "default": false
      }
    },
    "required": ["payment_method"]
  }
}
```

**Internal endpoint:** `POST /wc/store/checkout`
- Body: `{"payment_method": payment_method, "create_account": create_account}`
- Headers: `Cart-Token: <jwt>`, `Nonce: <nonce>`
- Response: `order_id`, `order_key`, `status`, `payment_redirect` (URL for off-site payment like Telr)

---

### 5.16 `track_order`

```json
{
  "name": "track_order",
  "description": "Track an existing order. Provide the order ID and order key (from the order confirmation), or the billing email and phone used at checkout. Returns order status, items, totals, shipping method, and tracking info if available. Does NOT expose full PII unless the caller can prove identity (key or email+phone match).",
  "input_schema": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "integer",
        "description": "Order ID"
      },
      "order_key": {
        "type": "string",
        "description": "Order key (e.g. 'wc_order_abc123')"
      },
      "email": {
        "type": "string",
        "format": "email",
        "description": "Billing email (alternative to order_key)"
      },
      "phone": {
        "type": "string",
        "description": "Billing phone (used with email for verification)"
      }
    }
  }
}
```

**Internal endpoints:**
- If `order_id` + `order_key`: `GET /wc/store/order/{id}?key={key}` (Store API, no admin auth needed — the key proves ownership)
- If `email` + `phone`: `GET /wc/v3/orders?billing_email={email}` (Classic, backend verifies phone match, then returns status summary)
- If logged-in customer: `GET /wc/v3/orders?customer={customer_id}` (Classic, with keys + WP auth)

**Security:** Backend never returns full billing address or email to the user unless (a) order_key matches, or (b) both email AND phone match. Only status, items, totals, and shipping are returned.

---

### 5.17 `get_order_history`

```json
{
  "name": "get_order_history",
  "description": "List past orders for the authenticated customer. Requires the user to be logged in (WordPress customer account). Returns order ID, date, status, items, and total for each order.",
  "input_schema": {
    "type": "object",
    "properties": {
      "page": {
        "type": "integer",
        "default": 1
      },
      "per_page": {
        "type": "integer",
        "default": 10,
        "maximum": 50
      },
      "status": {
        "type": "string",
        "description": "Filter by status: completed, processing, on-hold, cancelled, etc."
      }
    }
  }
}
```

**Internal endpoint:** `GET /wc/v3/orders?customer={wp_customer_id}&page={page}&per_page={per_page}&status={status}` (Classic, with keys + customer auth). Returns error if user is a guest (not logged in).

---

### 5.18 `list_product_reviews`

```json
{
  "name": "list_product_reviews",
  "description": "List reviews for a specific product. Returns reviewer name, rating, date, and review text.",
  "input_schema": {
    "type": "object",
    "properties": {
      "product_id": {
        "type": "integer"
      },
      "per_page": {
        "type": "integer",
        "default": 10,
        "maximum": 30
      }
    },
    "required": ["product_id"]
  }
}
```

**Internal endpoint:** `GET /wc/v3/products/{id}/reviews?per_page={per_page}` (Classic, with keys).
**Note:** This endpoint returns **404** on this store (`rest_no_route`). The tool should gracefully handle the error and inform the user that reviews are not available. The `get_product` tool can still surface `average_rating` and `review_count` from the Store API.

---

### Tool-to-Endpoint Mapping Summary

| Tool | API Surface | Method | Path | Auth |
|---|---|---|---|---|
| `list_categories` | Store API | GET | `/wc/store/products/categories?parent={p}` | Public |
| `search_products` | Store API (fallback: Classic) | GET | `/wc/store/products?...` or `/wc/v3/products?...` | Public (fallback: ck_/cs_) |
| `get_product` | Store API + Classic | GET | `/wc/store/products/{id}` + `/wc/v3/products/{id}/variations` | Public + ck_/cs_ |
| `get_recommendations` | Store API | GET | `/wc/store/products/{id}` → `/wc/store/products?include={ids}` | Public |
| `add_to_cart` | Store API | POST | `/wc/store/cart/add-item` | Cart-Token + Nonce |
| `get_cart` | Store API | GET | `/wc/store/cart` | Cart-Token |
| `update_cart_item` | Store API | POST | `/wc/store/cart/update-item` | Cart-Token + Nonce |
| `remove_cart_item` | Store API | POST | `/wc/store/cart/remove-item` | Cart-Token + Nonce |
| `apply_coupon` | Store API | POST | `/wc/store/cart/apply-coupon` | Cart-Token + Nonce |
| `remove_coupon` | Store API | DELETE | `/wc/store/cart/coupons?code={code}` | Cart-Token + Nonce |
| `update_cart_customer_address` | Store API | POST | `/wc/store/cart/update-customer` | Cart-Token + Nonce |
| `get_shipping_methods` | Store API | GET | `/wc/store/cart` (extract shipping_rates) | Cart-Token |
| `select_shipping_method` | Store API | POST | `/wc/store/cart/select-shipping` | Cart-Token + Nonce |
| `get_payment_methods` | Classic | GET | `/wc/v3/payment_gateways?enabled=true` | ck_/cs_ |
| `place_order` | Store API | POST | `/wc/store/checkout` | Cart-Token + Nonce |
| `track_order` | Store API / Classic | GET | `/wc/store/order/{id}?key={key}` or `/wc/v3/orders?...` | Key / ck_/cs_ |
| `get_order_history` | Classic | GET | `/wc/v3/orders?customer={id}` | ck_/cs_ + WP auth |
| `list_product_reviews` | Classic | GET | `/wc/v3/products/{id}/reviews` (404 on this store) | ck_/cs_ |

---

## 6. Backend Architecture

### Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| Backend language | Node.js (TypeScript recommended) | Tool executor, session management, API proxy |
| Web framework | Express.js | HTTP endpoint, SSE streaming |
| LLM | Claude API (Anthropic) — `claude-opus-5` or `claude-sonnet-4` | Conversation brain, function-calling (tool use) |
| Session/cart-token store | Redis (production) or in-memory map (dev) | Per-session: cart-token JWT, nonce, customer ID, language, conversation history, checkout state |
| HTTP client | axios | WooCommerce API calls (Classic + Store API) |
| Chat transport | Server-Sent Events (SSE) or WebSocket | Streaming Claude responses to client |
| Client | Any frontend (web, mobile, WhatsApp) | Sends `{ session_id, message }` only — no keys/tokens exposed |

### ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Chat UI)                            │
│                                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐       │
│  │ Chat Input   │  │ Message Log  │  │ Cart/Order Quick-view    │       │
│  │ (Ar/EN)      │  │ (streaming)   │  │ (rendered from get_cart) │       │
│  └──────┬───────┘  └──────────────┘  └──────────────────────────┘       │
│         │                                                                │
│         │  HTTPS (WebSocket or POST)                                     │
│         │  Body: { session_id, message, language?: "ar"|"en" }          │
│         │  No API keys ever leave the client.                            │
│         │                                                                │
└─────────┼────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CHATBOT BACKEND PROXY (Node.js + Express)              │
│                                                                          │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────┐  │
│  │ /chat endpoint   │  │ Session Store      │  │ WooCommerce API     │  │
│  │ (streaming SSE)  │  │ (Redis or in-mem)  │  │ Client (axios)       │  │
│  │                  │  │                    │  │                      │  │
│  │ - Receives msg   │  │ session_id → {     │  │ - Classic API calls  │  │
│  │ - Loads session  │  │   cart_token: jwt, │  │   (ck_/cs_ keys)     │  │
│  │ - Calls Claude   │  │   wp_customer_id,  │  │   stored in env only  │  │
│  │   API w/ tools   │  │   wp_auth_token,   │  │                      │  │
│  │ - Executes tool  │  │   language: "ar",  │  │ - Store API calls    │  │
│  │   calls back     │  │   history: [...],  │  │   (cart-token from   │  │
│  │   via WC client  │  │   last_product_id,│  │   session store)     │  │
│  │ - Returns text   │  │   pending_checkout│  │                      │  │
│  │   to client      │  │ }                  │  │ - Cloudflare retry   │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────────┘  │
│         │                       │                      │                 │
│         ▼                       ▼                      ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                    TOOL EXECUTOR LAYER                          │    │
│  │                                                                  │    │
│  │  Each tool function maps to 1-N HTTP calls. The executor:       │    │
│  │  1. Reads cart_token from session store                          │    │
│  │  2. Injects Cart-Token header on Store API calls                 │    │
│  │  3. Injects Basic Auth (ck_/cs_) on Classic API calls            │    │
│  │  4. Injects User-Agent + Accept headers (Cloudflare bypass)      │    │
│  │  5. Retries on Cloudflare challenge (up to 6x, 2s sleep)         │    │
│  │  6. Strips PII from responses before returning to LLM context   │    │
│  │  7. Saves any new cart_token to session store                    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Claude API (Anthropic)                                          │    │
│  │  - System prompt: store context, language detection, persona    │    │
│  │  - Tools: the 18 tool definitions above                          │    │
│  │  - Streaming responses to client                                 │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │
                           │  HTTPS to WooCommerce
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              WORDPRESS / WOOCOMMERCE STORE (iconnect-intl.com/store)    │
│                                                                          │
│  ┌─────────────────────┐    ┌──────────────────────┐                    │
│  │ /wc/v3/ (Classic)   │    │ /wc/store/ (Store API)│                    │
│  │ Basic Auth: ck_/cs_ │    │ Cart-Token: <jwt>     │                    │
│  │ Read/Write (admin)  │    │ Customer-facing       │                    │
│  └─────────────────────┘    └──────────────────────┘                    │
│         Cloudflare Bot Protection (intermittent challenges)             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Request Flow (Step-by-Step)

1. **Client sends message:** `POST /chat { session_id: "uuid", message: "أبغى سماعات بلوتوث" }`
2. **Backend loads session** from Redis: retrieves cart-token, nonce, language, conversation history, checkout state.
3. **Backend calls Claude API** with: system prompt (store context, persona, language instructions), conversation history, the 18 tool definitions, and the new user message.
4. **Claude responds** with either:
   - **Text response** → streamed to client via SSE. Done.
   - **Tool call** (e.g., `search_products({search: "بلوتوث"})`) → backend executes:
     a. Read cart-token from session (if needed for this tool).
     b. Construct HTTP request to appropriate WooCommerce endpoint.
     c. Inject auth headers (Basic Auth for Classic, Cart-Token+Nonce for Store API).
     d. Inject Cloudflare bypass headers (User-Agent, Accept).
     e. Execute request with retry loop (up to 6 attempts, 2s sleep on Cloudflare challenge).
     f. Capture new cart-token from response headers (if present), save to session.
     g. Sanitize PII from response data.
     h. Return tool result to Claude.
5. **Claude processes tool result** and either calls another tool or generates a text response.
6. **Text response streamed to client** via SSE.
7. **Session updated** in Redis: conversation history appended, cart-token refreshed, checkout state transitioned if applicable.

### Cart-Token Lifecycle

```
TIMELINE:
─────────────────────────────────────────────────────────────────────────►

  [User says "I want to buy headphones"]
        │
        ▼
  Claude calls search_products → user picks one
        │
        ▼
  User: "Add it to my cart"
        │
        ▼
  Backend: POST /wc/store/cart/add-item
  ──────────────────────────────────────────
  Response header: Cart-Token: eyJhbGciOi...
  Backend saves: session["cart_token"] = "eyJ..."
  ──────────────────────────────────────────
        │
        ▼
  User: "Change quantity to 2"
        │
        ▼
  Backend: POST /wc/store/cart/update-item
  Header: Cart-Token: eyJhbGciOi...  ← from session
        │
        ▼
  User: "I want to checkout"
        │
        ▼
  Backend: POST /wc/store/cart/update-customer  (sets address)
  Header: Cart-Token: eyJhbGciOi...
        │
        ▼
  Backend: POST /wc/store/cart/select-shipping
  Header: Cart-Token: eyJhbGciOi...
        │
        ▼
  Backend: POST /wc/store/checkout
  Header: Cart-Token: eyJhbGciOi...
  Response: { order_id: 7890, order_key: "wc_order_abc", status: "processing" }
        │
        ▼
  Cart token consumed. Session marks checkout_state = "placed".
  Order tracked by order_id + order_key.
```

### Checkout State Machine

```
                    ┌──────────┐
          ┌────────>│ BROWSING │<──────────────────────────┐
          │         └────┬─────┘                            │
          │              │ user adds to cart                │
          │              ▼                                  │
          │         ┌──────────┐                            │
          │         │   CART   │──── remove last item ──────┘
          │         └────┬─────┘
          │              │ user: "checkout" / "deliver to..."
          │              ▼
          │    ┌─────────────────┐
          │    │ ADDRESS COLLECTION│
          │    │ (tool: update_   │
          │    │  cart_customer_  │
          │    │  address)        │
          │    └────────┬────────┘
          │              │ address validated
          │              ▼
          │    ┌─────────────────┐
          │    │ SHIPPING SELECT  │
          │    │ (tool: get_ship  │
          │    │  _methods,       │
          │    │  select_shipping)│
          │    └────────┬────────┘
          │              │ method selected
          │              ▼
          │    ┌─────────────────┐
          │    │ PAYMENT SELECT   │
          │    │ (tool: get_      │
          │    │  payment_methods,│
          │    │  place_order)    │
          │    └────────┬────────┘
          │              │ order placed
          │              ▼
          │    ┌─────────────────┐
          │    │   ORDER PLACED   │
          │    │ (order_id, key)  │
          │    └────────┬────────┘
          │              │ user: "track my order"
          │              ▼
          │    ┌─────────────────┐
          │    │ TRACKING / DONE  │
          │    └─────────────────┘
          │
          └────────── (user: "I want to keep shopping" → back to BROWSING)
```

---

## 7. Security & Compliance

### Key & Secret Management

| Secret | Storage | Exposed to client? |
|---|---|---|
| WooCommerce `ck_` / `cs_` API keys | Server environment variables (`process.env.WC_CK` / `WC_CS`) | **Never.** All Classic API calls happen server-side. |
| Store API cart-token (JWT) | Server session store (Redis), keyed by `session_id` | **Never.** Backend reads from session, injects into headers. |
| WordPress customer auth token | Server session store | **Never.** |
| Anthropic API key | Server environment variable | **Never.** Claude API calls happen server-side. |

The client only ever sends `{ session_id, message }`. No keys, no tokens, no auth headers cross the client boundary.

### PII Protection

| Data | Source | Handling |
|---|---|---|
| Customer email | Checkout address, order tracking | Stored server-side only. Never echoed back in full; Claude instructed to show partial mask: `m***@gmail.com` |
| Phone number | Checkout address | Partial mask: `055XXXXX67` |
| Shipping address | Checkout | Shown back for confirmation during checkout, but not in order history summaries |
| Order billing details | Classic API order response | Backend strips `billing.email`, `billing.phone` from order data before passing to Claude's context, unless user authenticated |

**Tool-level PII stripping:** The tool executor has a `sanitizePII(data)` function that:
- Masks emails: `user@example.com` → `u***@e******.com`
- Masks phones: `+966512345678` → `+9665XXXXX678`
- Removes `billing.address_1` from order history list responses
- Only reveals full PII in `track_order` when key or email+phone verification passed

### Rate Limiting

| Scope | Limit | Purpose |
|---|---|---|
| Per session (per user) | 30 messages / 5 min (sliding window) | Prevent chat flooding |
| Tool calls per Claude turn | Max 5 tool calls per turn | Prevent API flooding |
| Cart mutations | Max 20 / 10 min per session | Prevent cart flooding |
| Checkout | Max 3 order placements / hour per session | Prevent fake orders |
| Global | 100 RPS total across all sessions | Protect WooCommerce store |
| Cloudflare backoff | If >50% of requests in 1-min window are challenges, enable 5s cooldown | Cloudflare circuit breaker |

Implementation: token-bucket in Redis (or in-memory for single-instance).

### Guest vs Authenticated Order Tracking

| Provided credentials | What the user can see |
|---|---|
| order_id + order_key (key matches) | Full order status, items, totals, shipping method, tracking. No PII. |
| email + phone (both must match) | Order IDs + status only for matching orders. No address, no full name. |
| Logged-in customer (WP auth token) | Full order history + individual order details (they own these orders). |
| order_id only (no key, no email, not auth'd) | **REJECTED.** "Please provide your order key or the email+phone used at checkout." |
| email only (no phone) | **REJECTED.** "Please also provide the phone number used at checkout." |

### Input Validation

| Input | Validation Rule |
|---|---|
| `quantity` | Integer, 1-99. Reject 0, negative, or >99. |
| `min_price` / `max_price` | Float >= 0. max_price >= min_price. Hard cap at 1,000,000 SAR. |
| `email` | RFC 5322 format check via regex. |
| `phone` | E.164 or local format. Strip non-numeric except `+`. Length 7-15 digits. |
| `address_1` | Non-empty string, max 200 chars. Strip HTML/script tags. |
| `city`, `state`, `postcode` | Non-empty, max 100 chars. Alpha+space+hyphen only for city/state. |
| `country` | Must be ISO 3166-1 alpha-2 (2 uppercase letters). Default "SA". |
| `coupon_code` | Alphanumeric + dash/underscore, max 50 chars. No spaces/special chars. |
| `search` query | Max 200 chars. Strip SQL-like patterns (`%`, `_`, `--`). |
| `product_id`, `order_id` | Positive integer. Must exist (API will 404 if not). |
| `order_key` | Format `wc_order_` prefix + alphanumeric, max 50 chars. |

All string inputs are HTML-escaped and length-capped before being sent to WooCommerce APIs.

### Additional Security Measures

1. **Session fixation prevention:** `session_id` is a random UUID generated server-side. Never derived from user input. Rotated on login.
2. **CSRF:** The `/chat` endpoint requires a custom header (`X-Chat-Session`) that the browser must set, preventing cross-origin form posts.
3. **Output sanitization:** Claude's responses rendered as text (not HTML) in the chat UI. Product images loaded from WooCommerce CDN URLs only.
4. **Cart token expiry:** WooCommerce cart tokens expire after ~48h. Backend detects 401/403 on cart calls and clears session cart_token, prompting user to restart.
5. **Payment security:** Backend never handles credit card data. Payment is always delegated to the payment gateway's hosted checkout (Telr redirect). The chatbot only surfaces the redirect URL.

---

## 8. Step-by-Step Implementation Plan

### Phase 1: Catalog Browsing (Weeks 1-2)

**Goal:** Users can browse categories, search products, view details, and get recommendations.

**Tasks:**
- Set up Node.js/Express backend with session store (Redis or in-memory).
- Implement WooCommerce API client (axios) with Cloudflare retry wrapper.
- Implement Claude API integration with tool-use (system prompt, tool definitions, SSE streaming).
- Implement tools: `list_categories`, `search_products`, `get_product`, `get_recommendations`.
- Implement language detection (Arabic Unicode range regex) and bilingual system prompt.
- Build minimal chat UI (text input, message log, streaming via SSE).

**Acceptance Criteria:**
- User can type in Arabic or English and receive responses in the same language.
- User can browse top-level categories and drill into subcategories.
- User can search by keyword (e.g., "cat6" returns product 8825).
- User can filter by category (e.g., category 392 returns Access Control Devices products).
- User can view full product details for a given product ID (e.g., 8825 — name, price 468.63 SAR, stock status, images, attributes).
- Product names and prices are displayed correctly in Arabic with SAR currency.
- Cloudflare challenges are retried automatically and do not surface to the user.

---

### Phase 2: Cart Management (Weeks 3-4)

**Goal:** Users can add products to cart, view cart, update quantities, and remove items.

**Tasks:**
- Implement Store API cart-token capture and session storage.
- Implement tools: `add_to_cart`, `get_cart`, `update_cart_item`, `remove_cart_item`.
- Implement nonce capture from Store API responses and injection on mutating requests.
- Handle cart-token refresh (new tokens returned on each mutating call).
- Add cart quick-view to chat UI (line items, subtotal).
- Implement cart expiry handling (401/403 → clear token, prompt user to restart).

**Acceptance Criteria:**
- User can add a product to cart (e.g., "Add product 8825 to my cart") and receive confirmation with item name, quantity, and price.
- First cart action initializes a cart session (cart-token JWT captured from response header).
- User can view cart contents with all line items, quantities, and running total.
- User can update quantity (e.g., "Change quantity to 2") and see updated total.
- User can remove an item (e.g., "Remove that from my cart") and see updated cart.
- Cart state persists across messages within the same session.
- Cart-token is automatically refreshed when the Store API returns a new one.

---

### Phase 3: Checkout + Payment (Weeks 5-7)

**Goal:** Users can complete a full checkout flow: address, shipping, payment, order placement.

**Tasks:**
- Implement tools: `update_cart_customer_address`, `get_shipping_methods`, `select_shipping_method`, `get_payment_methods`, `place_order`.
- Implement checkout state machine (browsing → cart → address → shipping → payment → placed).
- Integrate with `/data/countries` for address validation (Arabic country/state names).
- Handle payment redirect flow (Telr `wctelr` returns a redirect URL for online card payment).
- Display order summary (items, subtotal, shipping, tax, total) before confirming order.
- Implement order confirmation message with order ID, order key, and payment instructions.
- Handle checkout errors (missing address, out-of-stock, payment failure).
- Implement rate limiting (max 3 order placements / hour per session).

**Acceptance Criteria:**
- User can provide delivery address in natural language (name, email, phone, address, city).
- Address is validated and confirmed back to user (with PII masking: `m***@gmail.com`, `055XXXXX67`).
- Shipping methods are retrieved and displayed (e.g., "1. شحن مجاني (Free Shipping) 2. تكلفة الشحن (Flat Rate)").
- User can select a shipping method and see updated cart total.
- Payment methods are displayed (currently only `wctelr` — Telr online card payment is enabled).
- User can place an order via `POST /wc/store/checkout`.
- For online payment (Telr), the chatbot returns a secure payment redirect URL.
- Order confirmation includes: order ID, order key, status, total, payment method.
- Order auto-syncs to OTO shipping platform via existing webhooks (no additional action needed).

---

### Phase 4: Order Tracking (Weeks 8-9)

**Goal:** Users can track existing orders by ID + key or by email + phone.

**Tasks:**
- Implement tools: `track_order`, `get_order_history`.
- Implement order key verification (Store API `GET /wc/store/order/{id}?key={key}`).
- Implement email+phone verification (Classic API `GET /wc/v3/orders?billing_email={email}`, verify phone match).
- Implement WordPress customer login flow (JWT auth or Application Passwords) for order history.
- Display order status timeline (from `GET /wc/v3/orders/{id}/notes`).
- Handle order not found, invalid key, and email/phone mismatch gracefully.
- Implement PII stripping for order responses.

**Acceptance Criteria:**
- User can track an order by providing order ID + order key (e.g., order 6587 + `wc_order_...`).
- User can track an order by providing email + phone (both must match billing record).
- Order status is displayed in Arabic (e.g., "قيد المعالجة" for `processing`).
- Order items, totals, payment method, and shipping method are shown.
- Order status history/timeline is available (from order notes).
- Logged-in customers can view their full order history.
- Guest users cannot access orders without proper verification (key or email+phone).
- No PII (full email, full phone, full address) is exposed without verification.

---

### Phase 5: Polish & Arabic Optimization (Weeks 10-11)

**Goal:** Production-ready polish, Arabic language excellence, and edge case handling.

**Tasks:**
- Refine Arabic system prompt with store-specific context (product names are Arabic, store currency is SAR, store ships to Saudi Arabia).
- Implement dynamic language switching (detect language change mid-conversation).
- Add RTL/LTR handling in chat UI (`dir="rtl"` for Arabic, `dir="ltr"` for English).
- Format prices consistently (e.g., "468.63 ﷼" or "468.63 SAR" with Western Arabic numerals).
- Add `list_product_reviews` tool (even though it returns 404 — graceful error message).
- Add `apply_coupon` / `remove_coupon` tools (even though no coupons exist — future-proof).
- Implement `get_recommendations` with LLM-driven mode (Claude reasons over search results).
- Add typing indicators and streaming text for better UX.
- Implement session timeout (48h cart-token expiry handling).
- Add error recovery flows (network errors, Cloudflare persistent challenges, WooCommerce downtime).
- Performance: cache category tree and product attributes (rarely change).
- Add analytics logging (tool call counts, conversation length, order conversion rate).

**Acceptance Criteria:**
- Chatbot responds seamlessly in both Arabic and English, switching dynamically.
- Arabic text renders RTL in the chat UI; English renders LTR.
- Prices are formatted with SAR currency symbol (﷼ or SAR).
- Product names from the store (Arabic) are preserved; Claude can translate descriptions for English-speaking users.
- Recommendations work for all three types (related, category, LLM-driven).
- Session timeout is handled gracefully ("Your cart session has expired. Please start a new order.").
- Cloudflare persistent challenges (6 retries exhausted) show a friendly error message.
- Overall response time: <3 seconds for catalog browsing, <5 seconds for cart operations, <10 seconds for checkout.

---

## 9. Example Conversation Flows

### Flow 1: Arabic (RTL) — Search → Add to Cart → Checkout → Track

```
User:     السلام عليكم، أبغى أشتري كابل شبكة
          [Peace be upon you, I want to buy a network cable]

Chatbot:  وعليكم السلام! أهلاً بك في متجر iConnect. دعني أبحث عن كابلات
          الشبكة لك.
          [And peace be upon you! Welcome to iConnect. Let me search for
          network cables for you.]

  → TOOL CALL: search_products({ "search": "network cable", "per_page": 6 })
  → INTERNAL: GET /wc/store/products?search=network%20cable
  → RESULT: products found

Chatbot:  وجدت لك عدة خيارات من كابلات الشبكة:
          1. كابل شبكة هيكفيجن CAT6 UTP نحاس DS-1LN6-UU — 468.63 ﷼
          2. كابل شبكة CAT6Shielded — 320.00 ﷼
          3. كابل شبكة CAT5e — 85.00 ﷼
          ...
          أي واحد تبي تفاصيله؟
          [I found several network cable options. Which one do you want
          details for?]

User:     الأول، الهيكفيجن
          [The first one, the Hikvision]

  → TOOL CALL: get_product({ "product_id": 8825 })
  → INTERNAL: GET /wc/store/products/8825
  → INTERNAL: GET /wc/v3/products/8825/variations (Classic)

Chatbot:  📦 كابل شبكة هيكفيجن CAT6 UTP نحاس DS-1LN6-UU
          السعر: 468.63 ﷼
          SKU: DS-1LN6-UU
          الحالة: متوفر في المخزون ✓
          الفئات: أنظمة المراقبة، اكسسوارات كاميرات المراقبة
          المواصفات: 12 مواصفة (الأبعاد، الدقة، نوع الكاميرا، التقنية،
                     مقاس العدسة، مكان الاستخدام، الصوت، تقنية PoE،
                     اللون، التخزين، عدد القنوات، الميزات الذكية)

          تبي أضيفه للسلة؟
          [Want me to add it to the cart?]

User:     أيوه، أضفه
          [Yes, add it]

  → TOOL CALL: add_to_cart({ "product_id": 8825, "quantity": 1 })
  → INTERNAL: POST /wc/store/cart/add-item
     Body: { "id": 8825, "quantity": 1 }
  → RESPONSE HEADER: Cart-Token: eyJhbGciOiJIUzI1NiIs...
  → BACKEND SAVES cart_token to session

Chatbot:  تمام! أضفت كابل شبكة هيكفيجن CAT6 UTP إلى سلتك. ✅
          الكمية: 1
          السعر: 468.63 ﷼

          تبي تكمل الدفع ولا تضيف شي ثاني؟
          [Done! Added the Hikvision CAT6 cable to your cart. Want to
          proceed to checkout or add something else?]

User:     أبغى أكمل الدفع
          [I want to checkout]

Chatbot:  تمام، نحتاج معلومات التوصيل. وش اسمك ووش عنوانك؟
          [OK, we need delivery info. What's your name and address?]

User:     محمد العتيبي، بريد mohammed@gmail.com، جوال 0551234567
          شارع الملك فهد، حي العليا، الرياض

Chatbot:  خلني أأكد العنوان:
          الاسم: محمد العتيبي
          البريد: m***@gmail.com
          الجوال: 055XXXXX67
          العنوان: شارع الملك فهد، حي العليا، الرياض، السعودية

          صحيح؟
          [Let me confirm the address... Correct?]

User:     أيوه

  → TOOL CALL: update_cart_customer_address({
      "first_name": "محمد", "last_name": "العتيبي",
      "email": "mohammed@gmail.com", "phone": "0551234567",
      "address_1": "شارع الملك فهد", "city": "الرياض",
      "country": "SA"
    })
  → INTERNAL: POST /wc/store/cart/update-customer
     Headers: Cart-Token: eyJ...
  → TOOL CALL: get_shipping_methods({})
  → INTERNAL: GET /wc/store/cart (extract shipping_rates)

Chatbot:  عنوانك محفوظ ✓
          خيارات الشحن المتاحة:
          1. شحن مجاني — 0.00 ﷼
          2. تكلفة الشحن (سعر ثابت) — حسب الوزن

          أي طريقة شحن تفضّل؟
          [Your address is saved. Shipping options: 1. Free Shipping
          2. Flat Rate. Which do you prefer?]

User:     الشحن المجاني

  → TOOL CALL: select_shipping_method({ "rate_id": "free_shipping:1" })
  → INTERNAL: POST /wc/store/cart/select-shipping
     Headers: Cart-Token: eyJ...
  → TOOL CALL: get_payment_methods({})
  → INTERNAL: GET /wc/v3/payment_gateways?enabled=true

Chatbot:  تمام، اخترت الشحن المجاني ✓

          ملخص الطلب:
          - كابل شبكة هيكفيجن CAT6 UTP نحاس DS-1LN6-UU ×1 — 468.63 ﷼
          - الشحن: مجاني — 0.00 ﷼
          - الضريبة — 0.00 ﷼
          الإجمالي — 468.63 ﷼

          طرق الدفع المتاحة:
          1. ادفع باستخدام بطاقة ائتمان أو خصم عبر المدفوعات عبر الإنترنت (Telr)

          كيف تبي تدفع؟
          [OK, free shipping selected. Order summary: ... Total: 468.63
          SAR. Payment: Telr online card payment. How do you want to pay?]

User:     بطاقة
          [Card]

  → TOOL CALL: place_order({ "payment_method": "wctelr" })
  → INTERNAL: POST /wc/store/checkout
     Headers: Cart-Token: eyJ...
     Body: { "payment_method": "wctelr" }
  → RESPONSE: {
      "order_id": 7890,
      "order_key": "wc_order_abc123def",
      "status": "pending_payment",
      "payment_redirect": "https://iconnect-intl.com/store/checkout/order-pay/7890/?key=wc_order_abc123def"
    }

Chatbot:  تم إنشاء طلبك بنجاح! 🎉

          رقم الطلب: 7890
          مفتاح الطلب: wc_order_abc123def
          الحالة: بانتظار الدفع
          الإجمالي: 468.63 ﷼
          طريقة الدفع: بطاقة ائتمان/خصم (Telr)

          لإتمام الدفع، يرجى الضغط على هذا الرابط الآمن:
          https://iconnect-intl.com/store/checkout/order-pay/7890/?key=wc_order_abc123def

          بعد تأكيد الدفع، سيتحول الطلب إلى "قيد المعالجة".
          تتبع الطلب في أي وقت برقم الطلب والمفتاح.
          [Your order has been created! Complete payment via the secure
          link. After payment, order moves to "processing".]
```

### Flow 2: English — Search → Add to Cart → Checkout → Track

```
User:     Hi, I'm looking for a network cable

Chatbot:  Hello! Welcome to iConnect. Let me search for network cables.

  → TOOL CALL: search_products({ "search": "network cable", "per_page": 6 })
  → INTERNAL: GET /wc/store/products?search=network%20cable

Chatbot:  Here are the network cables I found:
          1. Hikvision CAT6 UTP Copper Network Cable DS-1LN6-UU — 468.63 SAR
          2. CAT6 Shielded Cable — 320.00 SAR
          3. CAT5e Network Cable — 85.00 SAR
          
          Which one would you like to know more about?

User:     The first one, the Hikvision

  → TOOL CALL: get_product({ "product_id": 8825 })
  → INTERNAL: GET /wc/store/products/8825

Chatbot:  📦 Hikvision CAT6 UTP Copper Network Cable DS-1LN6-UU
          Price: 468.63 SAR
          SKU: DS-1LN6-UU
          Stock: In stock ✓
          Categories: Surveillance Systems, Security Camera Accessories
          
          Would you like to add it to your cart?

User:     Yes, add it

  → TOOL CALL: add_to_cart({ "product_id": 8825, "quantity": 1 })
  → INTERNAL: POST /wc/store/cart/add-item
     Body: { "id": 8825, "quantity": 1 }
  → RESPONSE HEADER: Cart-Token: eyJhbGciOiJIUzI1NiIs...
  → SAVED to session

Chatbot:  Added Hikvision CAT6 UTP Cable to your cart. ✅
          Cart total: 468.63 SAR
          
          Anything else, or shall we check out?

User:     Let's check out

Chatbot:  Great! I'll need your delivery details. Please share:
          - Full name
          - Email
          - Phone number
          - Delivery address (street, city)

User:     John Smith, john@email.com, +966559876543
          King Fahd Road, Olaya, Riyadh

  → TOOL CALL: update_cart_customer_address({
      "first_name": "John", "last_name": "Smith",
      "email": "john@email.com", "phone": "+966559876543",
      "address_1": "King Fahd Road", "city": "Riyadh",
      "country": "SA"
    })
  → INTERNAL: POST /wc/store/cart/update-customer
     Headers: Cart-Token: eyJ...
  → TOOL CALL: get_shipping_methods({})

Chatbot:  Address saved ✓
          
          Shipping options:
          1. Free Shipping — 0.00 SAR
          2. Flat Rate — calculated by weight
          
          Which shipping method?

User:     Free shipping

  → TOOL CALL: select_shipping_method({ "rate_id": "free_shipping:1" })
  → TOOL CALL: get_payment_methods({})

Chatbot:  Free shipping selected ✓
          
          Order Summary:
          - Hikvision CAT6 UTP Cable ×1 — 468.63 SAR
          Shipping: Free — 0.00 SAR
          Tax: 0.00 SAR
          ────────────────────────
          Total: 468.63 SAR
          
          Payment methods:
          1. Credit/Debit Card (Telr)
          
          How would you like to pay?

User:     Credit card

  → TOOL CALL: place_order({ "payment_method": "wctelr" })
  → INTERNAL: POST /wc/store/checkout
     Headers: Cart-Token: eyJ...
     Body: { "payment_method": "wctelr" }
  → RESPONSE: {
      "order_id": 7892,
      "order_key": "wc_order_xyz789abc",
      "status": "pending_payment",
      "payment_redirect": "https://iconnect-intl.com/store/checkout/order-pay/7892/?key=wc_order_xyz789abc"
    }

Chatbot:  Your order has been created! 🎉
          
          Order ID: 7892
          Order Key: wc_order_xyz789abc
          Total: 468.63 SAR
          Payment: Credit Card (Telr)
          
          To complete payment, please tap this secure link:
          https://iconnect-intl.com/store/checkout/order-pay/7892/?key=wc_order_xyz789abc
          
          Once payment is confirmed, your order will move to "Processing."
          You can track it anytime by asking me with your order ID and key.

User:     Great, thanks! Let me track it

  → TOOL CALL: track_order({ "order_id": 7892, "order_key": "wc_order_xyz789abc" })
  → INTERNAL: GET /wc/store/order/7892?key=wc_order_xyz789abc

Chatbot:  Order #7892:
          Status: Pending Payment
          Items:
          - Hikvision CAT6 UTP Cable ×1 — 468.63 SAR
          Shipping: Free — 0.00 SAR
          Total: 468.63 SAR
          
          Your order is awaiting payment. Once you complete the payment
          via the Telr link, it will move to "Processing" and then
          "Shipped." Check back here anytime!
```

---

## 10. Appendix: Ready-to-Use curl Examples

**Note:** The live API keys are **read/write** (not read-only). Exercise caution with POST/PUT/DELETE operations. The examples below are read-only GET requests for safety.

All examples include the Cloudflare bypass headers and the retry note. For production, wrap in a retry loop (up to 6 attempts, 2s sleep on HTML challenge response).

### A. Search Products (Classic API, with auth)

```bash
# Search for "cat6" products — returns product 8825
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products?search=cat6&per_page=10" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
# Retry if body starts with <!DOCTYPE or <html
```

### B. Get Product Detail (Classic API, with auth)

```bash
# Get product 8825 (Hikvision CAT6 cable, 468.63 SAR)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/products/8825" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
# Retry if body starts with <!DOCTYPE or <html
```

### C. List Categories (Store API, public — no auth)

```bash
# List top-level categories (32 total, first: id 392 "Access Control Devices")
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/products/categories?per_page=50" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json"
# Retry if body starts with <!DOCTYPE or <html
```

### D. Search Products (Store API, public — no auth)

```bash
# Search products via Store API (703 total products)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/products?search=cat6&per_page=10" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json"
# Retry if body starts with <!DOCTYPE or <html
```

### E. Get Cart + Capture Cart-Token and Nonce (Store API, public)

```bash
# Initialize cart session — captures cart-token (JWT) and nonce from response headers
# Use -D - to dump headers, -s for silent
curl -s -D - -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json"
# Look for headers: cart-token, nonce, nonce-timestamp, user-id
# Save cart-token and nonce for subsequent cart mutations
# Retry if body starts with <!DOCTYPE or <html
```

### F. Add Item to Cart (Store API, requires cart-token + nonce)

```bash
# Add product 8825 (Hikvision CAT6 cable) to cart
# Replace CART_TOKEN and NONCE with values from step E
curl -s -X POST \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart/add-item" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Cart-Token: CART_TOKEN_HERE" \
  -H "Nonce: NONCE_HERE" \
  -d '{"id": 8825, "quantity": 1}'
# Expect HTTP 201, full cart object with item added
# Capture new cart-token from response headers
# Retry if body starts with <!DOCTYPE or <html
```

### G. Update Customer Address (Store API, requires cart-token + nonce)

```bash
# Set billing/shipping address on cart (triggers shipping/tax recalculation)
curl -s -X POST \
  "https://iconnect-intl.com/store/wp-json/wc/store/cart/update-customer" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Cart-Token: CART_TOKEN_HERE" \
  -H "Nonce: NONCE_HERE" \
  -d '{
    "billing_address": {
      "first_name": "محمد",
      "last_name": "العتيبي",
      "email": "mohammed@example.com",
      "phone": "0551234567",
      "address_1": "شارع الملك فهد",
      "city": "الرياض",
      "country": "SA"
    },
    "shipping_address": {
      "first_name": "محمد",
      "last_name": "العتيبي",
      "address_1": "شارع الملك فهد",
      "city": "الرياض",
      "country": "SA"
    }
  }'
# Retry if body starts with <!DOCTYPE or <html
```

### H. Place Order / Checkout (Store API, requires cart-token + nonce)

```bash
# Place order with Telr payment gateway
curl -s -X POST \
  "https://iconnect-intl.com/store/wp-json/wc/store/checkout" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Cart-Token: CART_TOKEN_HERE" \
  -H "Nonce: NONCE_HERE" \
  -d '{"payment_method": "wctelr"}'
# Expect: order_id, order_key, status, payment_redirect URL
# Retry if body starts with <!DOCTYPE or <html
```

### I. Track Order (Store API, public — needs order key)

```bash
# Track order by ID + order key (no admin auth needed)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/store/order/6587?key=wc_order_examplekey" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json"
# Retry if body starts with <!DOCTYPE or <html
```

### J. Get Order Detail (Classic API, with auth)

```bash
# Get order 6587 (status: processing, total: 13728.00 SAR, payment: cod)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/orders/6587" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
# Retry if body starts with <!DOCTYPE or <html
```

### K. List Payment Gateways (Classic API, with auth)

```bash
# List all payment gateways (only wctelr is enabled)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/payment_gateways" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
# Retry if body starts with <!DOCTYPE or <html
```

### L. List Shipping Zones + Methods (Classic API, with auth)

```bash
# List shipping zones (Zone 1 = Saudi Arabia with 2 methods)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/shipping/zones" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"

# List methods for Zone 1 (Saudi Arabia)
curl -s -X GET \
  "https://iconnect-intl.com/store/wp-json/wc/v3/shipping/zones/1/methods" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  --user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"
# Retry if body starts with <!DOCTYPE or <html
```

### M. Bash Retry Wrapper (for all curl calls)

```bash
#!/bin/bash
# Retry wrapper for WooCommerce API calls (Cloudflare mitigation)
wc_curl() {
  local url="$1"
  local auth="$2"  # "basic" for classic, "none" for store API
  local method="${3:-GET}"
  local data="$4"
  
  local auth_args=""
  if [ "$auth" = "basic" ]; then
    auth_args='--user "ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b:cs_234e5af2614e76e372b33675fbcc3ea80eedba3e"'
  fi
  
  for i in $(seq 1 6); do
    local body
    if [ "$method" = "GET" ]; then
      body=$(eval curl -s -X GET "$url" \
        -H '"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"' \
        -H '"Accept: application/json"' \
        $auth_args)
    else
      body=$(eval curl -s -X "$method" "$url" \
        -H '"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"' \
        -H '"Accept: application/json"' \
        -H '"Content-Type: application/json"' \
        $auth_args \
        -d "'$data'")
    fi
    
    # Check if response is real JSON (starts with [ or {)
    if echo "$body" | grep -qE '^\s*[\[\{]'; then
      echo "$body"
      return 0
    fi
    
    # Cloudflare challenge detected, retry
    echo "Attempt $i: Cloudflare challenge detected, retrying in 2s..." >&2
    sleep 2
  done
  
  echo "ERROR: Cloudflare challenge could not be bypassed after 6 retries" >&2
  return 1
}
```

---

### Important Notes

1. **API keys are read/write.** The credentials (`ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b` / `cs_234e5af2614e76e372b33675fbcc3ea80eedba3e`) can create, update, and delete resources. Only use POST/PUT/DELETE in production after thorough testing.

2. **Store API prices are in minor units.** The Store API returns prices as integers in cents (e.g., `46863` = 468.63 SAR). The Classic API returns prices as strings in major units (`"468.63"`). The backend must normalize before displaying to the user.

3. **Reviews endpoint is 404.** `GET /wc/v3/products/{id}/reviews` returns `rest_no_route` on this store. Reviews are not available via the API. The `average_rating` and `review_count` fields are still available in product responses.

4. **No coupons, no taxes, no registered customers.** The store operates with guest checkout, zero tax, and no configured coupons. These features are future-proofed in the tool definitions but will return empty results.

5. **OTO shipping integration is active.** Six webhooks sync all order events (create, update, delete) to tryoto.com. Orders placed through the chatbot will automatically be forwarded to OTO for fulfillment — no additional integration needed.

6. **Only one active payment gateway.** Telr (`wctelr`) for online credit/debit card payments. Cash on Delivery (`cod`) was used historically (order 6587) but is currently disabled in gateway settings. The chatbot should check `GET /wc/v3/payment_gateways` live to know current options rather than hardcoding.

7. **Shipping is Saudi Arabia only.** Zone 1 (Saudi Arabia) has `free_shipping` and `flat_rate` enabled. Zone 0 (Rest of World) has no shipping methods. The chatbot should inform non-SA users that delivery is only available within Saudi Arabia.
