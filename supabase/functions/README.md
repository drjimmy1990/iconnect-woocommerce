# Supabase Edge Functions — Semantic Search (Deno)

This is the **serverless deployment** of the semantic-search layer, matching the original plan ([SUPABASE-SEMANTIC-SEARCH.md](../../SUPABASE-SEMANTIC-SEARCH.md)). It is an **alternative** to the standalone Node/Express backends in [`semantic-search-backend/`](../../semantic-search-backend/) and [`woocommerce-api-wrapper/`](../../woocommerce-api-wrapper/). **Both versions are kept** so you can decide which to deploy.

The **Postgres + pgvector layer is shared** (run [`semantic-search-backend/sql/001_init.sql`](../../semantic-search-backend/sql/001_init.sql) in Supabase once). Only the HTTP layer differs.

## Functions

| Function | Path | Purpose |
|---|---|---|
| `semantic-search` | `POST /functions/v1/semantic-search` | Query path: embed query → RPC hybrid_search_documents → ranked results. Called by n8n/chatbot. |
| `wc-sync-webhook` | `POST /functions/v1/wc-sync-webhook` | WooCommerce webhook receiver (HMAC-verified) → upsert/delete product with re-embed gate. Real-time. |
| `wc-delta-sync` | `POST /functions/v1/wc-delta-sync` | Scheduled fallback: fetch `modified_after` products → upsert. 5-min cron. |

Shared code lives in `_shared/` (imported by all three): `embeddings.ts`, `supabase.ts`, `wc.ts`, `product.ts`, `upsert.ts`.

## ⚠️ Custom embedding endpoint (important)

The embedding layer is **OpenAI-compatible but endpoint-agnostic**. Set these secrets to point at any `/v1/embeddings` endpoint — official OpenAI, Azure OpenAI, a proxy, vLLM, Ollama's openai shim, or the custom endpoint whose details you'll provide later:

```
EMBEDDING_API_KEY=sk-...
EMBEDDING_BASE_URL=https://api.openai.com/v1   # or your custom endpoint
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMS=512   # MUST match the vector(512) in 001_init.sql
```

Rule: **the same model + base URL + dims for indexing AND query.** Don't mix. The Express backend uses the same env names, so swapping your custom endpoint in is a secret change, not a code change.

## All secrets (set as Supabase secrets)

```
supabase secrets set SUPABASE_URL=https://<project>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...        # service-role key
supabase secrets set EMBEDDING_API_KEY=sk-...
supabase secrets set EMBEDDING_BASE_URL=https://api.openai.com/v1
supabase secrets set EMBEDDING_MODEL=text-embedding-3-large
supabase secrets set EMBEDDING_DIMS=512

# only needed by the sync functions:
supabase secrets set WC_URL=https://iconnect-intl.com/store/wp-json/wc/v3
supabase secrets set WC_KEY=ck_...
supabase secrets set WC_SECRET=cs_...
supabase secrets set WC_WEBHOOK_SECRET=<random-string>
supabase secrets set USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
```

## Deploy

```bash
# 1. from the supabase/ folder (Supabase CLI installed + linked to your project)
cd supabase

# 2. run the SQL migrations in the Supabase SQL editor:
#    - ../semantic-search-backend/sql/001_init.sql
#    - sql/002_sync_state.sql   (only if you use wc-delta-sync)

# 3. set the secrets (above)

# 4. deploy the functions
supabase functions deploy semantic-search --no-verify-jwt
supabase functions deploy wc-sync-webhook --no-verify-jwt
supabase functions deploy wc-delta-sync  --no-verify-jwt

# 5. (optional) schedule the delta-sync every 5 min:
#    uncomment `schedule = "*/5 * * * *"` in supabase/config.toml and redeploy wc-delta-sync
#    or use the Supabase dashboard -> scheduled functions.
```

## Test

```bash
# health of the query function
curl -X POST 'https://<project>.functions.supabase.co/semantic-search' \
  -H 'Content-Type: application/json' \
  -d '{"query":"كاميرا خارجية مقاومة للمطر","top_k":5,"mode":"hybrid"}'

# register the WC webhook (real-time sync)
curl -X POST 'https://iconnect-intl.com/store/wp-json/wc/v3/webhooks' \
  -H 'User-Agent: Mozilla/5.0 ... Chrome/126.0.0.0 Safari/537.36' \
  --user 'ck_...:cs_...' -H 'Content-Type: application/json' \
  -d '{"name":"Supabase sync","topic":"product.updated","delivery_url":"https://<project>.functions.supabase.co/wc-sync-webhook","secret":"<same-as-WC_WEBHOOK_SECRET>"}'
# repeat for product.created, product.deleted, product.restored

# manual delta-sync run
curl -X POST 'https://<project>.functions.supabase.co/wc-delta-sync'
```

For a one-time full load when first enabling the Edge-Function sync, call `wc-delta-sync` with no `modified_after` (it fetches all `status=publish` products since last_modified is null).

## Express vs Edge Functions — which when

| | Express backends (`semantic-search-backend/` + `woocommerce-api-wrapper/`) | These Edge Functions |
|---|---|---|
| Runtime | Node 20, Express | Deno, Supabase-hosted |
| Hosting | You run/host 2 Node processes (or Docker) | Serverless, no host needed |
| Portability | Points at any Supabase project (reusable) | Deployed into one Supabase project |
| Local dev | `npm run dev` on :8080 / :8081 | `supabase functions serve` |
| Best for | Reusable/generic, local dev, custom long-running needs | Serverless, no infra, matches the original plan |

Both talk to the **same** Supabase Postgres + pgvector (same `documents` table, same SQL functions, same `content_hash` SHA-256 algorithm), so the indexed data and search behavior are identical. You can even run both against the same project while deciding.

## Notes

- The query path (`semantic-search`) and the webhook path (`wc-sync-webhook`) **never touch Cloudflare** (Supabase hosts them; webhooks are delivered *to* Supabase by WooCommerce). Only `wc-delta-sync` fetches *from* WooCommerce and thus traverses Cloudflare — it retries automatically; for full reliability apply the WAF bypass in [`SETUP-cloudflare-bypass.md`](../../SETUP-cloudflare-bypass.md).
- `verify_jwt = false` for all three — they're called by your backend/n8n/WooCommerce, not by Supabase-authenticated browser users. In production, put them behind your own auth gateway or restrict by IP if exposed.
