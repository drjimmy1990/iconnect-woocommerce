# Semantic Search — Getting Started (make it work & ready to run)

Goal: get the Arabic semantic search working end-to-end so a query like `"كاميرا خارجية مقاومة للمطر"` returns ranked products. Two backends must run; the data must be indexed once; then `/search` works.

**Two backends:**
- **A** = `semantic-search-backend/` (port 8080) — the vector DB + embeddings + search.
- **B** = `woocommerce-api-wrapper/` (port 8081) — pulls products from WooCommerce and pushes them into A.

> n8n only talks to A's `/search` and B's `/api/*`. n8n never touches Cloudflare or the WC keys.

---

## Step 1 — Prerequisites (one-time)

1. **Supabase project** (free tier is fine for ~180 products). Note down:
   - `Project URL` (e.g. `https://xxxx.supabase.co`)
   - `service_role` secret key (Settings → API → `service_role`)
2. **OpenAI API key** with access to `text-embedding-3-large` (Settings → API keys). This is the one external dependency — needed because the catalog is Arabic and `gte-small` is English-only.
3. **WooCommerce keys** (already have): `ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b` / `cs_234e5af2614e76e372b33675fbcc3ea80eedba3e`.
4. **Node.js 20+** installed.

---

## Step 2 — Set up the database (in Supabase)

1. Supabase dashboard → **SQL Editor** → New query.
2. Open `semantic-search-backend/sql/001_init.sql`, paste the whole file, **Run**.
3. This creates: the `documents` table (with `embedding vector(512)`, generated Arabic `fts` column, `content_hash`), the GIN + HNSW indexes, and the 3 search functions (`match_documents`, `keyword_search_documents`, `hybrid_search_documents`).

✅ Verify: `select count(*) from documents;` returns `0`.

---

## Step 3 — Configure & run Backend A (semantic search)

```bash
cd semantic-search-backend
cp .env.example .env
```

Edit `.env`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
OPENAI_API_KEY=sk-...your-openai-key
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMS=512
FTS_CONFIG=arabic
DOCUMENTS_TABLE=documents
PORT=8080
```

Install + run:
```bash
npm install
npm run dev
```

✅ Verify it's up:
```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

---

## Step 4 — Configure & run Backend B (feeds products into A)

```bash
cd ../woocommerce-api-wrapper
cp .env.example .env
```

Edit `.env`:
```
WC_URL=https://iconnect-intl.com/store/wp-json/wc/v3
WC_KEY=ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b
WC_SECRET=cs_234e5af2614e76e372b33675fbcc3ea80eedba3e
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36
SEMANTIC_BACKEND_URL=http://localhost:8080
WC_WEBHOOK_SECRET=any-random-string-here
PORT=8081
SYNC_ENABLED=true
SYNC_INTERVAL_MIN=5
```

Install + run:
```bash
npm install
npm run dev
```

✅ Verify:
```bash
curl http://localhost:8081/health
# {"status":"ok"}
curl "http://localhost:8081/api/products?per_page=2&search=cat6"
# returns 2 trimmed products from WooCommerce
```

---

## Step 5 — Index the catalog (the important one-time step)

Run the bulk load — B fetches all products from WooCommerce and pushes each to A, which embeds them and stores in Supabase:

```bash
curl -X POST http://localhost:8081/sync/bulk
```

This takes ~1–2 minutes for ~180 products (one OpenAI embeddings batch per ~100 products). Watch B's logs for progress.

✅ Verify the index has data:
```bash
# in Supabase SQL editor:
select count(*) from documents;
# should be ~180

# or via A:
curl -X POST http://localhost:8080/search -H "Content-Type: application/json" \
  -d '{"query":"كاميرا","top_k":3,"mode":"hybrid"}'
# returns 3 ranked products with scores
```

---

## Step 6 — Test semantic search (the "it works" moment)

```bash
# Arabic: small-shop night-vision camera, reasonable price
curl -X POST http://localhost:8080/search -H "Content-Type: application/json" \
  -d '{"query":"كاميرا مناسبة لمحل صغير تشوف واضح بالليل سعر معقول","top_k":5,"mode":"hybrid"}'

# English against the Arabic catalog (keyword search would return 0 — semantic returns matches)
curl -X POST http://localhost:8080/search -H "Content-Type: application/json" \
  -d '{"query":"outdoor weatherproof camera for the dark under 600 SAR","top_k":5,"mode":"hybrid"}'
```

✅ If you get ranked products (ColorVu cameras, NVRs, etc.) → **semantic search is working.**

---

## Step 7 — Keep it fresh (recommended, after it works)

- **Delta-sync** runs automatically every 5 min (SYNC_ENABLED=true) — fetches products changed since the last sync and re-indexes them. Price/stock changes are free (A's re-embed gate skips embedding when only price/stock changed).
- **Webhook (real-time)** — register it in WooCommerce for instant updates on product edits:
  ```bash
  # create a product.update webhook pointing at B
  curl -X POST "https://iconnect-intl.com/store/wp-json/wc/v3/webhooks" \
    -H "User-Agent: Mozilla/5.0 ... Chrome/126.0.0.0 Safari/537.36" \
    --user "ck_...:cs_..." -H "Content-Type: application/json" \
    -d '{"name":"Supabase sync","topic":"product.updated","delivery_url":"https://YOUR-B-PUBLIC-URL/webhook/wc","secret":"same-as-WC_WEBHOOK_SECRET"}'
  ```
  Repeat for `product.created`, `product.deleted`, `product.restored`. (B must be publicly reachable for delivery — use a tunnel/ngrok in dev.)
- **Cloudflare WAF bypass** — only B's delta-sync fetcher hits Cloudflare. To make it fully reliable, apply the rule in [SETUP-cloudflare-bypass.md](SETUP-cloudflare-bypass.md) (whitelist `/store/wp-json/wc/v3/*`). Until then, B retries automatically.

---

## Step 8 — Wire n8n (last)

Follow [`n8n-tools-setup.md`](n8n-tools-setup.md). The one tool that uses semantic search:

| Tool | Method | URL | Body |
|------|--------|-----|------|
| `semantic_search` | POST | `{{ $env.SEMANTIC_BACKEND_URL }}/search` | `{query, top_k=5, mode="hybrid", max_price?, filters?}` |

Set n8n env: `SEMANTIC_BACKEND_URL=http://localhost:8080` and `WOO_WRAPPER_URL=http://localhost:8081`. The AI Agent node calls this tool for natural-language/fuzzy/cross-language intent; it calls B's `/api/*` for exact product/order actions.

---

## Quick troubleshooting

| Symptom | Fix |
|---|---|
| `POST /search` returns `[]` | Run Step 5 (bulk load). Check `select count(*) from documents` > 0. |
| `function match_documents does not exist` | You skipped Step 2 — run `sql/001_init.sql` in Supabase. |
| `dimensions must be 512` error | `EMBEDDING_DIMS` doesn't match the SQL `vector(512)` — re-run the migration with the matching dim, or set `EMBEDDING_DIMS=512`. |
| OpenAI 401 | Wrong/missing `OPENAI_API_KEY` in A's `.env`. |
| `/sync/bulk` returns 403 / HTML | Cloudflare challenged B's fetch — B retries 8×; if it still fails, apply the WAF bypass or check the WC keys. |
| Results are garbage / wrong language | FTS config or model mismatch — must be `FTS_CONFIG=arabic` + `text-embedding-3-large` (multilingual). Same model for index + query. |
| n8n can't reach the backends | They're on localhost — for cloud n8n, deploy A & B to a host and use that URL, or tunnel. |

---

## One-line summary

Supabase + SQL → run A (`:8080`) → run B (`:8081`) → `POST /sync/bulk` → `POST :8080/search` returns ranked products. Done.
