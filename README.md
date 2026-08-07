# WooCommerce Semantic Commerce System

A three-piece architecture that turns a standard WooCommerce store (iconnect-intl.com) into an AI-driven, Arabic-capable shopping assistant. An **n8n AI agent** (user-built) talks to two Node.js backends over HTTP — a **WooCommerce API Wrapper (B)** for catalog, orders, and tracking, and a **Semantic Search Backend (A)** for vector/keyword/hybrid product search. Backend B syncs product data into backend A automatically (webhook + delta-sync + bulk-load), so the search index stays fresh with zero n8n involvement.

```
                         ┌─────────────────────────────┐
                         │          n8n Agent           │
                         │  (AI Agent node + tools)    │
                         └──────────┬───────┬──────────┘
                    catalog/orders   │       │  semantic search
                         GET /api/*  │       │  POST /search
                                     ▼       ▼
                    ┌────────────────────┐   ┌──────────────────────┐
                    │  WooCommerce API    │   │  Semantic Search     │
                    │  Wrapper  (B)       │   │  Backend  (A)        │
                    │  :8081              │   │  :8080               │
                    │                     │   │                      │
                    │  • GET  /api/products│   │  • POST   /index     │
                    │  • GET  /api/prod/:id│   │  • POST   /search    │
                    │  • GET  /api/categori│   │  • DELETE /:id        │
                    │  • GET  /api/payments│   │  • GET    /health    │
                    │  • POST /api/orders │   │                      │
                    │  • GET  /api/orders  │   │  Supabase + pgvector │
                    │    /track            │   │  + FTS (arabic)       │
                    │  • POST /webhook/wc │   │  + OpenAI embeddings  │
                    │  • POST /sync/bulk   │   │                      │
                    │  • POST /sync/delta   │   └──────────────────────┘
                    └───────┬─────────────┘             ▲
                            │  WC REST API               │  POST /index
                            │  (ck_/cs_ + UA)            │  (B → A sync)
                            ▼                            │
                    ┌────────────────────┐               │
                    │  WooCommerce Store │───────────────┘
                    │  iconnect-intl.com │  webhook: product.created/
                    │  (WP + WC + CF)    │          updated/deleted
                    └────────────────────┘
```

---

## The Three Pieces

### 1. Semantic Search Backend (A) — `semantic-search-backend/`

A **generic** vector-search microservice. It has no knowledge of WooCommerce — it only knows about documents with an `id`, `content`, and `metadata`. Any system can integrate by POSTing to `/index` and querying `/search`.

- **Tech:** Express, Supabase (Postgres + pgvector), OpenAI embeddings SDK, Zod validation.
- **Re-embed gate:** On `POST /index`, backend A computes `md5(content)`. If the hash is unchanged, it updates metadata only (cheap, no OpenAI call). If changed or new, it calls OpenAI to embed, then upserts the embedding + `indexed_at`.
- **Search modes:** `hybrid` (default, RRF fusion of pgvector + FTS), `semantic` (pgvector only), `keyword` (Postgres FTS only, config `arabic`).
- **Embedding model:** `text-embedding-3-large` at 512 dimensions (configurable via env).
- **Endpoints:**
  | Method | Path | Body | Response |
  |--------|------|------|----------|
  | GET | `/health` | — | `{status:"ok"}` |
  | POST | `/index` | `{id, content, metadata}` | `{id, action:"created"\|"updated_metadata"\|"reembedded", reembedded:bool}` |
  | POST | `/search` | `{query, top_k?, mode?, match_threshold?, filters?}` | `{results:[{id, score, metadata}]}` |
  | DELETE | `/:id` | — | `{id, deleted:bool}` |

### 2. WooCommerce API Wrapper (B) — `woocommerce-api-wrapper/`

A trimmed, protected proxy in front of the WooCommerce REST API. It holds the WC keys (`ck_`/`cs_`) and the Cloudflare-bypassing User-Agent so that n8n and other clients never need them. It also bridges product data into backend A.

- **Tech:** Express, Axios, Zod, express-rate-limit. TypeScript ESM, Node 20+.
- **WC routes** (all under `/api`):
  | Method | Path | Notes |
  |--------|------|-------|
  | GET | `/health` | Root-level health check. |
  | GET | `/api/products` | Query: `search, category, per_page, page, orderby, order, min_price, max_price, on_sale, featured, sku` |
  | GET | `/api/products/:id` | Single product by ID. |
  | GET | `/api/categories` | List categories (`?parent=` optional). |
  | GET | `/api/categories/:id` | Single category. |
  | GET | `/api/attributes` | List product attributes. |
  | GET | `/api/payment-gateways` | Enabled/disabled payment methods. |
  | GET | `/api/shipping-zones` | Shipping zones. |
  | GET | `/api/shipping-zones/:id/methods` | Methods for a zone. |
  | GET | `/api/orders` | Query: `per_page, page, status, search`. |
  | GET | `/api/orders/:id` | Single order by ID. |
  | GET | `/api/orders/track` | Query: `order_id+order_key`, or `email`, or `phone`. |
  | POST | `/api/orders` | Body: `{line_items, billing, payment_method?, payment_method_title?, customer_note?}` |
- **Sync bridge (B → A):**
  - `POST /webhook/wc` — receives WC webhooks (`product.created/updated/deleted/restored`), verifies HMAC-SHA256, then upserts/deletes in A.
  - `POST /sync/bulk` — full re-index of all WC products into A.
  - `POST /sync/delta` — incremental sync (products modified since last `date_modified`).
  - Automatic delta-sync on a timer if `SYNC_ENABLED=true` (interval: `SYNC_INTERVAL_MIN`).

### 3. n8n AI Agent (user builds)

An n8n workflow with an **AI Agent** node that has tools wired to HTTP requests against backends A and B. The agent interprets customer messages (Arabic or English), searches products semantically, browses catalog, places orders, and tracks shipments. See **`n8n-tools-setup.md`** for the full tool-by-tool wiring guide.

---

## How They Connect

| Flow | Direction | Purpose |
|------|-----------|---------|
| n8n → B `/api/*` | HTTP GET/POST | Catalog browsing, order placement, order tracking. |
| n8n → A `/search` | HTTP POST | Semantic / hybrid / keyword product search. |
| B → A `/index` | HTTP POST | Upsert product on webhook, delta-sync, or bulk-load. |
| B → A `/:id` | HTTP DELETE | Remove product on `product.deleted` webhook. |
| WC → B `/webhook/wc` | HTTP POST | WooCommerce fires product lifecycle webhooks. |
| B → WC REST API | HTTPS | Wrapper fetches/creates orders, products, etc. (holds ck_/cs_ + UA). |

**n8n never talks to WooCommerce directly** — it goes through B for catalog/orders and through A for search. n8n needs no WC keys, no User-Agent, no Cloudflare workarounds.

---

## Run Order

Follow these steps in sequence:

### Step 1 — Start backend A (Semantic Search)

```bash
cd semantic-search-backend
cp .env.example .env
# Edit .env: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
# Run sql/001_init.sql in Supabase SQL editor (creates table + pgvector + FTS functions)
npm install
npm run dev    # listens on :8080
```

Verify: `curl http://localhost:8080/health` → `{"status":"ok"}`

### Step 2 — Start backend B (WooCommerce Wrapper)

```bash
cd woocommerce-api-wrapper
cp .env.example .env
# Edit .env: set WC_URL, WC_KEY, WC_SECRET, USER_AGENT, SEMANTIC_BACKEND_URL, WC_WEBHOOK_SECRET
npm install
npm run dev    # listens on :8081
```

Verify: `curl http://localhost:8081/health` → `{"status":"ok","service":"woocommerce-api-wrapper"}`

### Step 3 — Register the WooCommerce webhook

In WooCommerce admin (or via REST API), register a webhook:

- **Topic:** `product.updated` (and optionally `product.created`, `product.deleted`, `product.restored`)
- **Delivery URL:** `https://<your-B-host>:8081/webhook/wc`
- **Secret:** the same value as `WC_WEBHOOK_SECRET` in B's `.env`

Alternatively, register one webhook with topic `product.*` to catch all product events.

### Step 4 — Run the bulk load (full re-index)

```bash
curl -X POST http://localhost:8081/sync/bulk
```

This fetches all WC products and pushes them into backend A. Response: `{processed: N, errors: M}`. After this, A has embeddings for every product and search is immediately usable.

### Step 5 — Build the n8n AI Agent

Open `n8n-tools-setup.md` in this repo and follow the guide to wire the seven tools the agent needs. The n8n agent will call:
- **A** `POST /search` for semantic product search.
- **B** `GET /api/products`, `GET /api/products/:id`, `GET /api/categories`, `GET /api/payment-gateways`, `POST /api/orders`, `GET /api/orders/track`.

Once the agent is live, the system is complete. B's automatic delta-sync (every `SYNC_INTERVAL_MIN` minutes) plus the WC webhook keep A's index fresh without any n8n involvement.

---

## Environment Variables Summary

### Backend A — `semantic-search-backend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | — | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service-role key (server-side RPC + table access). |
| `OPENAI_API_KEY` | — | OpenAI API key for embeddings. |
| `EMBEDDING_MODEL` | `text-embedding-3-large` | OpenAI embedding model. |
| `EMBEDDING_DIMS` | `512` | Embedding vector dimensions. |
| `FTS_CONFIG` | `arabic` | Postgres FTS config (baked into SQL, reference only). |
| `DOCUMENTS_TABLE` | `documents` | Postgres table name (must match SQL). |
| `PORT` | `8080` | HTTP server port. |
| `CORS_ORIGIN` | `*` | CORS allow-origin. |

### Backend B — `woocommerce-api-wrapper/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `WC_URL` | — | WooCommerce REST API base URL (`/wp-json/wc/v3`). |
| `WC_KEY` | — | WooCommerce consumer key (`ck_...`). |
| `WC_SECRET` | — | WooCommerce consumer secret (`cs_...`). |
| `USER_AGENT` | — | Browser User-Agent string (bypasses Cloudflare). |
| `SEMANTIC_BACKEND_URL` | `http://localhost:8080` | Backend A base URL (B → A sync). |
| `WC_WEBHOOK_SECRET` | — | Shared secret for WC webhook HMAC verification. |
| `PORT` | `8081` | HTTP server port. |
| `SYNC_ENABLED` | `true` | Enable automatic delta-sync on interval. |
| `SYNC_INTERVAL_MIN` | `5` | Delta-sync interval in minutes. |

### n8n (credentials / environment)

| Placeholder | Description |
|-------------|-------------|
| `{{ $env.SEMANTIC_BACKEND_URL }}` | Base URL of backend A (e.g. `http://localhost:8080`). |
| `{{ $env.WOO_WRAPPER_URL }}` | Base URL of backend B (e.g. `http://localhost:8081`). |

n8n does **not** need WC keys, User-Agent, or any WooCommerce credentials — backend B holds all of those.

---

## Repository Structure

```
woocommerce/
├── README.md                          ← you are here
├── n8n-tools-setup.md                 ← n8n tool wiring guide
├── semantic-search-backend/           ← Backend A
│   ├── src/
│   │   ├── index.ts                   Express app: /health /index /search /:id
│   │   ├── db.ts                      Supabase client
│   │   ├── embeddings.ts              OpenAI embedding generation
│   │   ├── reembed.ts                 md5 content-hash decision gate
│   │   └── schemas.ts                Zod request validation
│   ├── sql/001_init.sql              Table + pgvector + FTS + search functions
│   ├── .env.example
│   └── package.json
├── woocommerce-api-wrapper/           ← Backend B
│   ├── src/
│   │   ├── index.ts                   Express app: /api routes + /webhook + /sync
│   │   ├── routes/index.ts            Trimmed WC endpoints for n8n
│   │   ├── wc-client.ts               WooCommerce REST API client (Axios + UA)
│   │   ├── trim.ts                    Response shape mappers
│   │   └── sync/
│   │       ├── compose.ts             Build content + metadata for A
│   │       ├── upsert.ts              POST /index + DELETE /:id to A
│   │       ├── delta-sync.ts          Periodic + bulk sync logic
│   │       └── webhook.ts             WC webhook handler (HMAC verify)
│   ├── .env.example
│   └── package.json
```
