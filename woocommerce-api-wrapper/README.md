# woocommerce-api-wrapper

WooCommerce REST API wrapper with Cloudflare retry logic, trimmed responses for n8n, and a sync bridge to the generic semantic backend.

## What it does

1. **Wraps the WooCommerce REST API** — proxies all WC endpoints with browser User-Agent, Basic Auth, and retry-until-JSON logic to bypass intermittent Cloudflare challenges.
2. **Trims responses** — maps bloated WC objects into clean, minimal shapes that n8n workflows consume.
3. **Syncs to semantic backend** — pushes product data (content + metadata) to the semantic backend (A) over HTTP for embedding and hybrid search. Supports webhook-driven real-time sync, periodic delta-sync, and bulk re-index.

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `WC_URL` | WooCommerce REST API base URL | `https://iconnect-intl.com/store/wp-json/wc/v3` |
| `WC_KEY` | WC consumer key | `ck_...` |
| `WC_SECRET` | WC consumer secret | `cs_...` |
| `USER_AGENT` | Browser User-Agent (bypasses Cloudflare) | `Mozilla/5.0 ...` |
| `SEMANTIC_BACKEND_URL` | Base URL of semantic backend (A) | `http://localhost:8080` |
| `WC_WEBHOOK_SECRET` | Shared secret for WC webhook signature verification | `your_secret` |
| `PORT` | HTTP port for this wrapper | `8081` |
| `SYNC_ENABLED` | Enable periodic delta-sync | `true` |
| `SYNC_INTERVAL_MIN` | Delta-sync interval in minutes | `5` |

## HTTP Routes for n8n

All routes are prefixed with `/api`.

### Health
- `GET /health` — service health check

### Products
- `GET /products` — list products (query: `search`, `category`, `per_page` [1-50, default 10], `page`, `orderby`, `order`, `min_price`, `max_price`, `on_sale`, `featured`, `sku`) → `{ products, total, page, total_pages }`
- `GET /products/:id` — single product

### Categories
- `GET /categories` — list categories (query: `parent`)
- `GET /categories/:id` — single category

### Attributes
- `GET /attributes` — list product attributes

### Payment Gateways
- `GET /payment-gateways` — list gateways as `[{ id, title, enabled }]`

### Shipping Zones
- `GET /shipping-zones` — list shipping zones
- `GET /shipping-zones/:id/methods` — shipping methods for a zone

### Orders
- `GET /orders` — list orders (query: `per_page`, `status`, `search`) → `{ orders, total, page, total_pages }`
- `GET /orders/:id` — single order
- `GET /orders/track` — track order (query: `order_id` + `order_key`, or `email`, or `phone`)
- `POST /orders` — create order (body: `{ line_items: [{ product_id, quantity }], billing, payment_method }`) → `{ id, status, total, order_key, payment_url }`

### Sync (admin)
- `POST /sync/bulk` — re-index ALL products into the semantic backend
- `POST /sync/delta` — run a single delta-sync pass now

### Webhook
- `POST /webhook/wc` — receives WC webhook events (product.created/updated/deleted/restored)

## Sync Mechanisms

### 1. Webhook (real-time)

Register webhooks in WooCommerce (via REST API or admin UI):

```bash
# Register a webhook for all product events
curl -X POST "$WC_URL/webhooks" \
  -u "$WC_KEY:$WC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Semantic Sync",
    "topic": "product.updated",
    "delivery_url": "https://your-wrapper-host:8081/webhook/wc",
    "secret": "your WC_WEBHOOK_SECRET"
  }'
```

Register separate webhooks for `product.created`, `product.updated`, `product.deleted`, and `product.restored`, or use `product.*`.

The wrapper verifies the HMAC-SHA256 signature in `X-Wc-Webhook-Signature` and routes by `X-Wc-Webhook-Topic`.

### 2. Delta-sync (periodic)

If `SYNC_ENABLED=true`, the wrapper runs a delta-sync every `SYNC_INTERVAL_MIN` minutes:
1. Reads `last_modified` timestamp from `data/sync-state.json`
2. Fetches all WC products modified after that timestamp (paginated)
3. Upserts each into the semantic backend via `POST /index`
4. Updates `last_modified` to the max `date_modified` seen

An initial delta-sync runs 5 seconds after startup.

### 3. Bulk load (manual)

Call `POST /sync/bulk` to re-index ALL products. This is the full nuclear option — it walks every product in WooCommerce and upserts it.

## How to Run

```bash
# Install dependencies
npm install

# Copy and fill in .env
cp .env.example .env
# Edit .env with your WC keys and semantic backend URL

# Development (auto-reload)
npm run dev

# Production
npm run build
npm start
```

## Cloudflare Retry Logic

The WC store sits behind Cloudflare, which intermittently returns challenge pages (HTML) or 403 responses. The `request()` wrapper in `src/wc-client.ts`:

1. Sends a browser User-Agent header
2. On each attempt, checks if the response body starts with `[` or `{` (JSON)
3. If HTML or 403, sleeps 2 seconds and retries
4. Up to 8 attempts before failing

This makes the wrapper resilient to Cloudflare bot-protection challenges without human intervention.

## HTTP Contract with Semantic Backend (A)

The wrapper pushes to the semantic backend over HTTP only (no shared code):

- **POST /index** `{ id: string, content: string, metadata: object }` → `200 { id, action, reembedded }`
  - `content`: searchable text (name + description + categories + brand + attributes + sku)
  - `metadata`: structured product fields (name, price, sku, category_ids, etc.)
  - Backend A computes `md5(content)` and only re-embeds if content changed.

- **DELETE /:id** → `200 { id, deleted }`

The wrapper never calls OpenAI or Postgres directly — all embedding/search is delegated to backend A.
