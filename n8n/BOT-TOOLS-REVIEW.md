# Backend API Review + Bot Tool Set (for manual n8n setup)

Reviewed against the actual source: `woocommerce-api-wrapper/src/routes/index.ts`,
`src/trim.ts`, `src/wc-client.ts`, and `semantic-search-backend/src/index.ts`.

All URLs use **Docker service names** — they resolve only from inside a container on
`iconnect-network` (n8n does). Placeholders `{...}` are what the AI fills via `$fromAI`.

---

## 🔴 Bug found and fixed — `track_order` was completely broken

`GET /api/orders/:id` was registered **before** `GET /api/orders/track`. Express matches in
registration order, so `/api/orders/track?phone=...` matched `/orders/:id` with `id="track"`,
hit `isNaN(Number("track"))`, and returned:

```json
{"error":"Invalid order ID"}
```

**Fixed** by moving the literal `/orders/track` route above the `/orders/:id` param route.
Requires a rebuild to take effect:

```bash
cd /www/wwwroot/iconnect && git pull && docker compose up -d --build woocommerce-wrapper
```

---

## Complete endpoint inventory

### Backend B — WooCommerce wrapper (`http://woocommerce-wrapper:8081`)
| Method | Path | Params | Use for the bot? |
|---|---|---|---|
| GET | `/health` | — | monitoring |
| GET | `/api/products` | `search` `category` `per_page`(≤50) `page` `orderby` `order` `min_price` `max_price` `on_sale` `featured` `sku` | ✅ **core** |
| GET | `/api/products/:id` | — | ✅ **core** |
| GET | `/api/categories` | `parent` | ✅ **core** |
| GET | `/api/categories/:id` | — | ➖ rarely |
| GET | `/api/attributes` | — | ➖ no |
| GET | `/api/payment-gateways` | — | ➖ put in the prompt instead |
| GET | `/api/shipping-zones` | — | ➖ put in the prompt instead |
| GET | `/api/shipping-zones/:id/methods` | — | ➖ no |
| GET | `/api/orders` | `per_page` `page` `status` `search` | ⛔ **never expose** — lists *all* customers' orders |
| GET | `/api/orders/:id` | — | ⛔ **never expose** — any ID reads any customer's order |
| GET | `/api/orders/track` | `phone` \| `email` \| `order_id`+`order_key` | ✅ **core** |
| POST | `/api/orders` | JSON body | ✅ **core** |

### Backend A — semantic search (`http://semantic-search:8080`)
| Method | Path | Use for the bot? |
|---|---|---|
| GET | `/health` | monitoring |
| POST | `/search` | ✅ **core** |
| POST | `/index` | ⛔ admin only |
| DELETE | `/:id` | ⛔ admin only |

> ⛔ **Privacy:** never wire `/api/orders` or `/api/orders/:id` as agent tools. They have no
> ownership check — a customer could enumerate other people's orders. Only `/api/orders/track`
> is safe, because it filters by the caller's own phone.

---

## Recommended tool set — 7 tools

### 1. `semantic_search`
**Description (EN):** Semantic natural-language product search in Arabic. Use for descriptive or vague requests ("a cable that works outdoors", "something for a home office network") where the customer does not name an exact product. Input: `query` — the customer's request in natural Arabic. Returns up to 5 ranked products using hybrid vector + keyword search.
```bash
curl -X POST http://semantic-search:8080/search -H "Content-Type: application/json" \
  -d '{"query":"{query}","top_k":5,"mode":"hybrid"}'
```

### 2. `list_categories`
**Description (EN):** Get all product categories in the store with their id, name, and product count. Call this when the customer asks what the store sells, asks to browse, or when you need a `category_id` before calling `browse_category`. No input required.
```bash
curl "http://woocommerce-wrapper:8081/api/categories"
```

### 3. `browse_category`
**Description (EN):** List products inside a specific category. Use after `list_categories` when the customer wants to see what is available in a category. Input: `category_id` — the numeric category id returned by `list_categories`.
```bash
curl "http://woocommerce-wrapper:8081/api/products?category={category_id}&per_page=5"
```

### 4. `search_catalog`
**Description (EN):** Exact keyword or SKU catalog search. Use when the customer names a specific product, model, brand, or SKU. Input: `search` — the keyword or SKU. Returns up to 5 matching products with id, name, price, and stock status.
```bash
curl "http://woocommerce-wrapper:8081/api/products?search={search}&per_page=5"
```

### 5. `get_product`
**Description (EN):** Get full details for one product, including its current image URL, price, SKU, stock status, and attributes. Input: `id` — the numeric product id from a previous search. Always call this before returning `send_product_image` so the image link is current.
```bash
curl "http://woocommerce-wrapper:8081/api/products/{id}"
```

### 6. `place_order`
**Description (EN):** Create a WooCommerce order. Only call after the product, quantity, customer name, phone, address, and city have all been collected AND the customer has explicitly confirmed the purchase. Shipping is Saudi Arabia only; payment is Telr only. Inputs: `product_id`, `quantity`, `name`, `address`, `city`, `phone`, `email`. Returns the order id, total, and a `payment_url` — give that link to the customer verbatim.
```bash
curl -X POST http://woocommerce-wrapper:8081/api/orders -H "Content-Type: application/json" \
  -d '{"line_items":[{"product_id":{product_id},"quantity":{quantity}}],"billing":{"first_name":"{name}","last_name":"-","address_1":"{address}","city":"{city}","country":"SA","phone":"{phone}","email":"{email}"},"payment_method":"wctelr","payment_method_title":"Telr","status":"pending"}'
```
> `{product_id}` and `{quantity}` are **numbers** (no quotes). Everything else is a quoted string.

### 7. `track_order`
**Description (EN):** Look up the status of an existing order using the customer's own phone number. Input: `phone` — the customer's WhatsApp number. Returns order status, total, and line items, or 404 if nothing is found. Never ask for another person's phone number.
```bash
curl "http://woocommerce-wrapper:8081/api/orders/track?phone={phone}"
```

### Optional 8th — `list_offers`
**Description (EN):** List products currently on sale. Use when the customer asks about discounts, offers, or deals. No input required.
```bash
curl "http://woocommerce-wrapper:8081/api/products?on_sale=true&per_page=5"
```

---

---

## ⚠️ Wiring the tools in n8n — mistakes that make the agent skip tools

Observed 2026-08-11: the agent answered *"ما عندنا كاميرات"* without ever calling a
search tool. Three causes, all fixed by the rules below.

### 1. Every model-supplied value must be a `$fromAI()` expression
A plain `{search}` string is **not** a placeholder in `httpRequestTool` — it is sent
literally, so the API receives `?search={search}` and returns nothing.

```
❌  "value": "{search}"
✅  "value": "={{ $fromAI('search', 'Product keyword, model or SKU', 'string') }}"
```
(note the leading `=` — without it the field is not an expression at all)

### 2. Name the parameter properly — the model reads that name
`$fromAI`'s **first argument is the parameter name exposed to the model**. n8n
auto-fills placeholders like `parameters0_Value` / `parameters0_Name`; leaving them
means the model is offered a parameter called "parameters0_Value" and tool-calling
accuracy drops sharply.

| Tool | Correct expression |
|---|---|
| `semantic_search` (body `query`) | `={{ $fromAI('query', 'The customer product request in natural Arabic', 'string') }}` |
| `search_catalog` (query `search`) | `={{ $fromAI('search', 'Product keyword, model or SKU', 'string') }}` |
| `browse_category` (query `category`) | `={{ $fromAI('category_id', 'Numeric category ID from list_categories', 'number') }}` |
| `get_product` (URL path) | `=http://woocommerce-wrapper:8081/api/products/{{ $fromAI('product_id', 'The numeric product ID', 'number') }}` |
| `track_order` (query `phone`) | `={{ $('Normalize').first().json.phone }}` — **session-bound, not `$fromAI`** |

Use type `'number'` for ids so the model doesn't send `"482"` as a string.

### 3. `track_order` must NOT take the phone from the model
There is no ownership check on the endpoint. If the model supplies the phone, a
customer can ask to "track the order for 05xxxxxxxx" and receive a stranger's order.
Bind it to the verified WhatsApp sender and describe the tool as taking no input.

### 4. Model choice
`gpt-4o-mini` is weak at multi-step tool use and was a contributing cause. Use `gpt-4o`
or another strong tool-using model for the agent's chat model.

**How to confirm it's fixed:** send "عندكم كاميرات؟" and open the n8n execution view —
you must see a `semantic_search` / `search_catalog` call *before* the final JSON.

---

## Running these by hand

The service names don't resolve from the host shell. Run from inside the n8n container:
```bash
docker exec -it iconnect-n8n sh
```
n8n's image ships `wget`, not `curl`:
```bash
wget -qO- "http://woocommerce-wrapper:8081/api/categories"
```
```bash
wget -qO- --header='Content-Type: application/json' --post-data='{"query":"كابل شبكة","top_k":5,"mode":"hybrid"}' http://semantic-search:8080/search
```

---

## Logic review — other findings

| # | Finding | Severity | Notes |
|---|---|---|---|
| 1 | `/orders/track` shadowed by `/orders/:id` | 🔴 critical | **Fixed** — rebuild required |
| 2 | `/api/orders` + `/api/orders/:id` have no ownership check | 🟠 privacy | Safe today (not wired as tools) — keep it that way |
| 3 | `trackOrder()` matches phone via WooCommerce's order `search` param | 🟠 verify | Phone stored as `05xxxxxxxx` won't match a search for `9665xxxxxxxx`. Test both formats; may need normalisation |
| 4 | `createOrder` sends only `billing`, no `shipping` object | 🟠 verify | WooCommerce may leave the shipping address blank on the order. Confirm with a test order before launch |
| 5 | `country` is optional in the schema but shipping is SA-only | 🟡 minor | The tool template hardcodes `"SA"` — good. Consider defaulting it server-side |
| 6 | `trimProduct` exposes `stock_status` but not `stock_quantity` | 🟡 minor | Bot can say "in stock" but not "only 3 left" |
| 7 | `/categories` hardcodes `per_page: 100`, no pagination | 🟡 minor | Fine unless the store exceeds 100 categories |
| 8 | `trimOrder` masks the email (`a***@domain`) | ✅ good | Sensible privacy default |
| 9 | `set_paid: false` + `checkout_payment_url` | ✅ correct | Right pattern for a Telr payment link |
| 10 | `per_page` capped at 50 (products) / 100 (orders) | ✅ good | Prevents the agent pulling huge payloads |

### What the bot gets back (`trimProduct`)
`id` · `name` · `price` · `regular_price` · `sale_price` · `currency:"SAR"` · `sku` ·
`stock_status` · `type` · `status` · `image_url` · `permalink` · `category_ids` ·
`category_names` · `brand` · `attributes` · `short_desc` (140 chars, HTML stripped)

`/api/products` wraps these as `{products:[...], total, page, total_pages}` —
`/api/products/:id` returns the bare object.
