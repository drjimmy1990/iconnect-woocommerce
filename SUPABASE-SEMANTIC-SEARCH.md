# Supabase Semantic Search for the Arabic WooCommerce Catalog

**Store:** iconnect-intl.com/store (Arabic, RTL, SAR, Hikvision CCTV/security gear)
**WC version:** 10.9.4 | ~180 simple-type products, growing
**Date:** 2026-08-02

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Embedding Model Choice](#3-embedding-model-choice)
4. [Schema DDL](#4-schema-ddl)
5. [SQL Functions](#5-sql-functions)
6. [Query Edge Function](#6-query-edge-function)
7. [Sync Strategy](#7-sync-strategy)
8. [Chatbot Integration](#8-chatbot-integration)
9. [Scaling & Cost](#9-scaling--cost)
10. [Setup Checklist](#10-setup-checklist)
11. [Appendix: Key Code Blocks](#11-appendix-key-code-blocks)

---

## 1. Executive Summary

We are building a **Supabase + pgvector hybrid semantic search layer** for the Arabic WooCommerce catalog at `iconnect-intl.com/store`. The store sells Hikvision CCTV, security, network, and access-control gear. Product names are Arabic; many contain English model codes (e.g., "DS-2CE70KF0T-LPFS").

**Why:** WooCommerce's built-in keyword search scored **0/15** in our test suite — it cannot match natural-language intent, fuzzy descriptions, or cross-language queries. A semantic search prototype scored **15/15** on the same suite. The store's Cloudflare bot protection blocks direct browser-to-WC API writes, and the Store-API is unreliable for the chatbot path. A Supabase-hosted search layer decouples the chatbot from the store's WAF entirely.

**What:** A Postgres table `wc_products` that mirrors the WooCommerce product catalog, with:
- A 512-dimensional `embedding` column (OpenAI `text-embedding-3-large` @ 512 dims, **multilingual** for Arabic)
- A generated `fts` tsvector column using the **`arabic`** Postgres FTS config (not `english`)
- Hybrid search via Reciprocal Ranked Fusion (RRF) combining semantic + full-text results
- A sync pipeline (WC webhooks + cron delta-sync) that keeps the mirror current
- A re-embed decision gate using `content_hash = md5(content_for_embedding)` to skip costly API calls on price/stock-only changes

**Arabic-specific gotchas (called out prominently):**
- The FTS config **must** be `arabic`, not the default `english`. `to_tsvector('arabic', ...)` applies Arabic-specific stemming and normalization. Using `english` would silently degrade keyword search quality.
- The embedding model **must** be multilingual. Supabase's built-in `gte-small` is **English-only** and would produce garbage embeddings for Arabic text. Use OpenAI `text-embedding-3-large` (multilingual, supports Arabic + Latin script in one vector space).
- The same model + dimensions **must** be used at index time and query time. A mismatch produces a dimension error or silently poor recall.

---

## 2. Architecture Overview

```
┌──────────┐                                                          
│  User    │  Arabic natural-language message                         
│ (chatbot │  "أحتاج كاميرا خارجية مقاومة للمطر 5 ميجابكسل"           
│  user)   │                                                          
└────┬─────┘                                                          
     │                                                                  
     ▼                                                                  
┌──────────────────┐                                                   
│  Claude (LLM)    │  Decides: semantic_search tool call              
│  + Node backend  │  (descriptive intent → semantic, not lexical)    
│  proxy           │                                                   
└────────┬─────────┘                                                   
         │  POST /functions/v1/semantic-search                          
         │  { query, top_k, max_price?, category?, mode, in_stock_only }
         ▼                                                              
┌──────────────────────────────────────────────────┐                   
│  Supabase Edge Function: semantic-search         │                   
│  (Deno runtime, Supabase-hosted)                  │                   
│                                                    │                   
│  1. embedQuery(query) → OpenAI API                │                   
│     model: text-embedding-3-large, dims: 512       │                   
│  2. supabase.rpc('hybrid_search_products', {...}) │                   
│     filters pushed INTO the SQL function           │                   
│  3. trim rows → compact JSON                      │                   
└────────┬──────────────────────────┬───────────────┘                   
         │                          │                                   
         │  RPC (internal)          │  fetch (outbound)                 
         ▼                          ▼                                   
┌────────────────────┐    ┌──────────────────┐                          
│  Supabase Postgres │    │  OpenAI API      │                          
│  + pgvector        │    │  (embeddings)    │                          
│                    │    └──────────────────┘                          
│  hybrid_search_    │                                                  
│    products (RRF)  │                                                  
│  match_products    │                                                  
│  keyword_search_   │                                                  
│    products        │                                                  
│                    │                                                  
│  wc_products table │                                                  
│  embedding(512)    │                                                  
│  fts (arabic)      │                                                  
└────────────────────┘                                                  
```

**Separately — the data-ingestion path:**

```
                    WOOCOMMERCE STORE
                    (iconnect-intl.com/store)
                    WP server behind Cloudflare
                           │
              ┌────────────┼────────────┐
              │            │            │
         Webhooks      (no CF)      REST API
         (outbound)              (inbound, CF-protected)
              │                        │
              │ product.created        │ GET /wc/v3/products
              │ product.updated        │ ?modified_after=...
              │ product.deleted         │
              │ product.restored       │
              ▼                        ▼
     ┌─────────────────┐    ┌───────────────────┐
     │ wc-sync-webhook │    │ wc-delta-sync     │
     │ (Edge Function) │    │ (Edge Function,   │
     │                 │    │  cron */5 * * * *) │
     │ 1. HMAC verify  │    │ 1. CF retry fetch  │
     │ 2. Route topic   │    │ 2. Paginate       │
     │ 3. upsert/delete │    │ 3. upsert each    │
     └────────┬────────┘    │ 4. del sweep (1h) │
              │              └─────────┬─────────┘
              │                        │
              ▼                        ▼
     ┌──────────────────────────────────────────┐
     │           upsertProduct()                │
     │   (shared helper, imported by both)      │
     │                                          │
     │  1. build content_for_embedding          │
     │  2. compute content_hash = md5()         │
     │  3. compare to stored hash               │
     │                                          │
     │  ┌─ HASH SAME ──→ cheap update           │
     │  │   (price/stock/image/status only)     │
     │  │   NO OpenAI call → FREE               │
     │  │                                      │
     │  └─ HASH CHANGED → full update           │
     │      + OpenAI embeddings API             │
     │      (text-embedding-3-large @ 512)      │
     │      + set embedding, indexed_at         │
     └────────────────────┬─────────────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │   public.wc_products    │
              │   (Supabase Postgres   │
              │    + pgvector)         │
              └────────────────────────┘
```

**Key architectural properties:**
- The **query path** (chatbot → Node proxy → Supabase Edge Function → Postgres + OpenAI) **never touches `iconnect-intl.com`** — Cloudflare is irrelevant.
- The **ingestion path** has two mechanisms: webhooks (real-time, no Cloudflare) and cron delta-sync (every 5 min, needs CF retry).
- Both ingestion mechanisms converge on the same `upsertProduct()` helper with the `content_hash` re-embed decision.

---

## 3. Embedding Model Choice

### Comparison Table

| Criterion | gte-small (Supabase built-in) | OpenAI text-embedding-3-small | OpenAI text-embedding-3-large @ 512 | Local Transformers.js (e.g. paraphrase-multilingual) |
|---|---|---|---|---|
| Dimensions | 384 | 1536 | 512 (selectable) | varies (384–768) |
| Language coverage | English only | Multilingual (Arabic supported) | Multilingual (Arabic supported) | Depends on model; multilingual variants exist |
| Arabic quality | Poor — trained on English corpus | Good | Best — largest model, strongest cross-lingual recall | Moderate; smaller multilingual models trail OpenAI on Arabic |
| English model codes (e.g. DS-2CE70KF0T-LPFS) | OK for ASCII tokens but English-only context | Good | Good — same multilingual space, ASCII tokens embed cleanly | Fair |
| Cost per 1M tokens | Free (built-in) | $0.02 / 1M input | $0.13 / 1M input | Free (self-hosted CPU) |
| Latency (query embed) | ~ms (local) | ~100–200 ms (API) | ~150–250 ms (API) | 100–500 ms (CPU bound) |
| HNSW index size (180 rows, N dims) | 384 × 180 — tiny | 1536 × 180 — 4× larger, slower distance | 512 × 180 — small, fast | model-dependent |
| HNSW build/query cost | low | higher (1536-dim distance) | low (512-dim distance) | low |
| Self-hosting burden | none | none (API) | none (API) | must bundle model weights in Edge Function or separate container |
| Cloudflare impact | none (Supabase-hosted) | none (OpenAI API call from Edge Function) | none | none if run inside Supabase; Docker if too heavy |
| Verdict | **REJECTED** — English-only, Arabic search would fail | Acceptable but 1536 dims is overkill for ~180 products; 3× the cost of @512 | **RECOMMENDED** | Fallback only if OpenAI API is blocked; weaker Arabic recall |

### Recommendation: OpenAI `text-embedding-3-large` at 512 dimensions

**Justification:**

1. **Arabic + English + model codes in one vector space.** The store's product names are Arabic, but many contain English/Hikvision model codes (e.g., "كاميرا DS-2CE70KF0T-LPFS"). A multilingual model is mandatory — `gte-small` is English-only and would produce garbage embeddings for Arabic text, making semantic search useless. `text-embedding-3-large` is OpenAI's strongest multilingual embedding model and handles Arabic + Latin-script tokens in the same space.

2. **512 dims, not 1536.** The `dimensions` parameter lets us halve the vector from the default 1536. For ~180 (growing) products, 512 dims gives excellent recall at half the storage and distance-computation cost. HNSW query latency scales with `dims`, so 512 keeps p95 low.

3. **Cost is negligible at this scale.** At $0.13/1M tokens, embedding all 180 products (~200 tokens each = 36K tokens) costs <$0.01. Query embeddings are ~10 tokens each — effectively free. Even at 10K products, re-indexing costs ~$0.30.

4. **HNSW index at 512 dims** is the right choice — read-heavy, low-latency, works well below 100K rows. If the catalog ever exceeds 100K, revisit IVFFlat, but that is far beyond current trajectory.

### The non-negotiable rule: same model for index + query

> Vectors from different models are not comparable; the distance operator would be meaningless. The sync pipeline must use `text-embedding-3-large` with `dimensions: 512` when building `content_for_embedding`, and the query Edge Function must use the identical model/dims when embedding the user query. Pin the model string and dims in a shared config / env var so both sides agree.

### `content_for_embedding` composition

The `content_for_embedding` column is the single text blob that gets embedded for each product. It contains every signal a shopper might use in natural language.

**Formula:**
```
content_for_embedding =
  name
  + ' ' + strip_html(short_description)
  + ' ' + join(category_names, ' ')
  + ' ' + brand
  + ' ' + flatten_attributes(attributes)
  + ' ' + sku
```

**Example (before strip / after strip):**

Raw WooCommerce product fields:
```json
{
  "name": "كاميرا مراقبة Hikvision DS-2CE70KF0T-LPFS",
  "short_description": "<p>كاميرا دوم بدقة <strong>5 ميجابكسل</strong> مع رؤية ليلية حتى 20 متر</p>",
  "categories": ["كاميرات المراقبة", "كاميرات دوم"],
  "brand": "Hikvision",
  "attributes": {
    "Camera Type": ["Dome"],
    "Resolution": ["5MP"],
    "Night Vision Range": ["20m"]
  },
  "sku": "DS-2CE70KF0T-LPFS"
}
```

After HTML strip + entity decode + flattening:
```
كاميرا مراقبة Hikvision DS-2CE70KF0T-LPFS كاميرا دوم بدقة 5 ميجابكسل مع رؤية ليلية حتى 20 متر كاميرات المراقبة كاميرات دوم Hikvision Camera Type: Dome Resolution: 5MP Night Vision Range: 20m DS-2CE70KF0T-LPFS
```

**Composition rules (for the sync pipeline, NOT the Edge Function):**

| Step | Detail |
|---|---|
| Strip HTML | Remove all tags from `short_description` and `description`. Use a sanitizer (e.g., `DOMPurify` or regex `<[^>]+>`) then trim. |
| Decode HTML entities | `&amp;` → `&`, `&lt;` → `<`, `&nbsp;` → space, `&#x627;` → Arabic letter, etc. Use `he` (npm) or `decode-entities`. |
| Category names | Join array with spaces, not commas (embedding models treat commas as noise). |
| Attribute flattening | For each `{key: [values]}`, emit `"key: value1 value2"`. Keys are English (WC attribute slugs); values may be Arabic or English. Both are useful for search. |
| Brand | Append as-is. Hikvision / Ezviz / etc. are English tokens that users type verbatim. |
| SKU | Append — model codes aid English/technical search. |
| `content_hash` | `md5(content_for_embedding)`. On product update, if hash is unchanged, skip re-embedding (saves API calls). |
| `fts` column | `to_tsvector('arabic', content_for_embedding)` — generated column, no manual computation. Uses the same text so FTS and semantic search cover identical content. |

**What is deliberately excluded from `content_for_embedding`** (and therefore from the re-embed trigger):
`price`, `regular_price`, `sale_price`, `stock_status`, `stock_quantity`, `image_url`, `permalink`, `status`.

These change frequently but do not affect semantic meaning. Excluding them from the content blob is what makes the `content_hash` skip path effective.

---

## 4. Schema DDL

```sql
-- ============================================================================
-- Enable pgvector (Supabase installs it under the extensions schema)
-- ============================================================================
create extension if not exists vector schema extensions;

-- ============================================================================
-- Table: public.wc_products
-- Canonical schema with CHECK constraints for data integrity.
-- ============================================================================
create table if not exists public.wc_products (
  product_id          bigint primary key,            -- WooCommerce product id
  name                text not null,
  price               numeric(12,2),                   -- current sale price (SAR)
  regular_price       numeric(12,2),
  sale_price          numeric(12,2),
  currency            text default 'SAR',
  sku                 text,
  stock_status        text,                            -- instock | outofstock | onbackorder
  stock_quantity      int,
  type                text,                            -- simple | variable ...
  status              text,                            -- publish | draft | pending ...
  category_ids        bigint[],
  category_names      text[],
  brand               text,
  attributes          jsonb,                           -- {"Camera Type":["Dome"],"Resolution":["5MP"]}
  image_url           text,                            -- first image thumbnail
  permalink           text,
  date_created        timestamptz,
  date_modified       timestamptz not null,             -- from WC; used for delta sync
  content_for_embedding text not null,                 -- name + short_desc + cats + attrs + brand + sku
  content_hash        text not null,                   -- md5(content_for_embedding); skip re-embed if unchanged

  -- Generated Arabic full-text-search column.
  -- to_tsvector('arabic', ...) stems and normalizes Arabic text so that
  -- websearch_to_tsquery('arabic', <user input>) can match it via the @@ operator.
  -- 'stored' materializes the tsvector on disk so we can build a GIN index on it.
  fts tsvector generated always as (to_tsvector('arabic', content_for_embedding)) stored,

  -- 512-dimensional vector matching OpenAI text-embedding-3-large @512.
  -- MUST use the same model at index time and query time.
  embedding           extensions.vector(512),

  indexed_at          timestamptz,                     -- when embedding was last generated
  updated_at          timestamptz default now(),

  -- Sanity checks
  check (price          is null or price          >= 0),
  check (regular_price  is null or regular_price  >= 0),
  check (sale_price     is null or sale_price     >= 0),
  check (stock_status   is null or stock_status in ('instock','outofstock','onbackorder')),
  check (stock_quantity is null or stock_quantity >= 0)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- GIN index on the generated Arabic tsvector — accelerates the @@ operator
-- used by websearch_to_tsquery('arabic', ...) in both match and hybrid search.
create index if not exists idx_wc_products_fts
  on public.wc_products using gin (fts);

-- HNSW index on embedding using vector_ip_ops (inner-product opclass).
--
-- Why HNSW over IVFFlat for this catalog:
--   - HNSW offers superior recall-at-low-latency for read-heavy workloads.
--   - It builds incrementally — new rows are inserted without a full rebuild
--     (critical as the catalog grows from ~180 products).
--   - No tuning knobs like lists/nprobes required at build time.
--   - For ~180 rows (and moderate growth to low-thousands), HNSW is ideal.
--
-- When to switch to IVFFlat:
--   - 100k+ rows where build time and memory footprint dominate.
--   - IVFFlat lets you trade recall for speed by tuning nprobes at query time.
--   - Until then, HNSW is the right default.
--
-- OpenAI embeddings are L2-normalized (unit length), so inner product <#>
-- is mathematically equivalent to cosine similarity. vector_ip_ops is the
-- correct opclass for the <#> operator.
create index if not exists idx_wc_products_embedding_hnsw
  on public.wc_products using hnsw (embedding extensions.vector_ip_ops)
  with (m = 16, ef_construction = 64);

-- Supporting indexes for the filter pushdowns used in both search functions.
create index if not exists idx_wc_products_stock_status
  on public.wc_products (stock_status);
create index if not exists idx_wc_products_category_ids
  on public.wc_products using gin (category_ids);
-- A partial index on in-stock products speeds the most common filter path.
create index if not exists idx_wc_products_instock
  on public.wc_products (product_id)
  where stock_status = 'instock';
```

**Index design notes:**
- The GIN index on `fts` accelerates the `@@` (tsvector match) operator.
- The HNSW index with `vector_ip_ops` is chosen because: (a) HNSW gives better recall-at-latency for read-heavy catalogs; (b) it builds incrementally — no rebuild needed as products are added; (c) OpenAI embeddings are L2-normalized, so inner product (`<#>`) equals cosine similarity, making `vector_ip_ops` the correct opclass.
- IVFFlat becomes preferable at 100k+ rows where build-time and memory dominate and you want the `nprobes` speed/recall trade-off.
- Supporting B-tree/GIN indexes on `stock_status` and `category_ids` ensure the pushed-down filters use indexes rather than full scans.

---

## 5. SQL Functions

Three functions are defined: pure semantic (`match_products`), pure keyword (`keyword_search_products`), and hybrid RRF (`hybrid_search_products`). All filters are pushed inside the WHERE clause — never chained after an RPC call — so the query planner can combine them with the HNSW and GIN index scans.

### 5.1 `match_products` (semantic-only)

```sql
-- ============================================================================
-- Semantic search function: match_products
-- Returns the most semantically similar products to a query embedding.
-- Uses <#> (inner product / negative dot product) for distance.
--
-- Threshold semantics for <#>:
--   <#> returns -(dot product). For L2-normalized vectors:
--     identical vectors  → <#> = -1   (most similar)
--     unrelated vectors  → <#> ≈  0
--     opposite vectors   → <#> = +1   (least similar)
--   Therefore: MORE NEGATIVE = MORE SIMILAR.
--   match_threshold (default -0.5) keeps results whose dot product > 0.5,
--   i.e. cosine similarity > 0.5. Tune toward 0 for more recall, toward -1
--   for more precision.
--
-- All filters (in-stock, max-price, category) are pushed INSIDE the WHERE
-- clause — never chained after rpc() — so the planner can combine them with
-- the HNSW index scan instead of scanning the full table first.
--
-- Tip: raise recall at query time with  set hnsw.ef_search = 100;  (default 40)
-- ============================================================================
create or replace function public.match_products(
  query_embedding  extensions.vector(512),
  match_threshold float      default -0.5,
  match_count      int        default 10,
  in_stock_only    bool       default true,
  max_price        numeric    default null,
  filter_category  bigint    default null
)
returns setof public.wc_products
language sql stable
as $$
  select p.*
  from public.wc_products p
  where p.embedding is not null
    and (p.embedding <#> query_embedding) < match_threshold
    and (not in_stock_only or p.stock_status = 'instock')
    and (max_price is null or p.price <= max_price)
    and (filter_category is null or filter_category = any(p.category_ids))
  order by p.embedding <#> query_embedding asc   -- most similar (most negative) first
  limit match_count;
$$;
```

### 5.2 `keyword_search_products` (FTS-only)

```sql
-- ============================================================================
-- Keyword search function: keyword_search_products
-- Arabic full-text search using websearch_to_tsquery('arabic', ...).
-- websearch_to_tsquery accepts natural search syntax (quoted phrases, OR, - exclusion).
-- The 'arabic' config stems/normalizes Arabic consistently with the generated fts column.
-- ============================================================================
create or replace function public.keyword_search_products(
  query_text       text,
  match_count      int     default 10,
  in_stock_only    bool    default true,
  max_price        numeric default null,
  filter_category  bigint  default null
)
returns setof public.wc_products
language sql stable
as $$
  select p.*
  from public.wc_products p
  where p.fts @@ websearch_to_tsquery('arabic', query_text)
    and (not in_stock_only or p.stock_status = 'instock')
    and (max_price is null or p.price <= max_price)
    and (filter_category is null or filter_category = any(p.category_ids))
  order by ts_rank_cd(p.fts, websearch_to_tsquery('arabic', query_text)) desc
  limit match_count;
$$;
```

### 5.3 `hybrid_search_products` (RRF fusion)

```sql
-- ============================================================================
-- Hybrid search function: hybrid_search_products (RRF fusion)
-- Combines Arabic full-text search with semantic search using Reciprocal
-- Ranked Fusion (RRF). Two CTEs produce independently ranked lists; their
-- ranks are fused into a single rrf_score.
--
-- RRF formula:
--   rrf_score = Σ  weight_i × 1 / (rrf_k + rank_i)
--   rrf_k (default 50) dampens the advantage of top-ranked items so that
--   lower-ranked but still-relevant results contribute meaningfully.
--
-- The same business filters (in-stock, max-price, category) are pushed into
-- BOTH CTEs. This ensures neither CTE is over-filtered: a product that
-- matches semantically but not by keyword still receives a semantic rank, and
-- vice-versa. The full outer join preserves products appearing in only one
-- list, with zero contribution from the missing list.
--
-- websearch_to_tsquery('arabic', query_text) is used for user input because:
--   - It accepts natural search syntax (quoted phrases, OR, - exclusion).
--   - The 'arabic' config stems/normalizes Arabic consistently with the
--     generated fts column.
--
-- Each CTE is capped at 100 candidates (ORDER BY ... LIMIT 100) so the HNSW
-- and GIN indexes are used efficiently. For catalogs exceeding ~10k rows,
-- consider raising the candidate cap or adding a permissive semantic threshold.
-- ============================================================================
create or replace function public.hybrid_search_products(
  query_text         text,
  query_embedding    extensions.vector(512),
  match_count        int    default 10,
  in_stock_only      bool   default true,
  max_price          numeric default null,
  filter_category    bigint default null,
  full_text_weight   float  default 1,
  semantic_weight    float  default 1,
  rrf_k              int    default 50
)
returns table (
  product_id           bigint,
  name                 text,
  price                numeric(12,2),
  regular_price        numeric(12,2),
  sale_price           numeric(12,2),
  currency             text,
  sku                  text,
  stock_status         text,
  stock_quantity       int,
  type                 text,
  status               text,
  category_ids         bigint[],
  category_names       text[],
  brand                text,
  attributes           jsonb,
  image_url            text,
  permalink            text,
  date_created         timestamptz,
  date_modified        timestamptz,
  content_for_embedding text,
  content_hash         text,
  fts                  tsvector,
  embedding            extensions.vector(512),
  indexed_at           timestamptz,
  updated_at           timestamptz,
  rrf_score            float
)
language sql stable
as $$
  with full_text as (
    select
      p.product_id,
      row_number() over (
        order by ts_rank_cd(p.fts, websearch_to_tsquery('arabic', query_text)) desc
      ) as rank_ix
    from public.wc_products p
    where p.fts @@ websearch_to_tsquery('arabic', query_text)
      and (not in_stock_only or p.stock_status = 'instock')
      and (max_price is null or p.price <= max_price)
      and (filter_category is null or filter_category = any(p.category_ids))
    order by ts_rank_cd(p.fts, websearch_to_tsquery('arabic', query_text)) desc
    limit 100
  ),
  semantic as (
    select
      p.product_id,
      row_number() over (
        order by p.embedding <#> query_embedding asc
      ) as rank_ix
    from public.wc_products p
    where p.embedding is not null
      and (not in_stock_only or p.stock_status = 'instock')
      and (max_price is null or p.price <= max_price)
      and (filter_category is null or filter_category = any(p.category_ids))
    order by p.embedding <#> query_embedding asc
    limit 100
  ),
  rrf as (
    select
      coalesce(ft.product_id, sem.product_id)                          as product_id,
      coalesce(full_text_weight  * (1.0 / (rrf_k + ft.rank_ix)), 0.0)
        + coalesce(semantic_weight   * (1.0 / (rrf_k + sem.rank_ix)), 0.0) as rrf_score
    from full_text ft
    full outer join semantic sem on ft.product_id = sem.product_id
  )
  select
    p.product_id,
    p.name,
    p.price,
    p.regular_price,
    p.sale_price,
    p.currency,
    p.sku,
    p.stock_status,
    p.stock_quantity,
    p.type,
    p.status,
    p.category_ids,
    p.category_names,
    p.brand,
    p.attributes,
    p.image_url,
    p.permalink,
    p.date_created,
    p.date_modified,
    p.content_for_embedding,
    p.content_hash,
    p.fts,
    p.embedding,
    p.indexed_at,
    p.updated_at,
    r.rrf_score
  from rrf r
  join public.wc_products p on p.product_id = r.product_id
  order by r.rrf_score desc
  limit match_count;
$$;
```

**Key design notes for all three functions:**
- Filters (`in_stock_only`, `max_price`, `filter_category`) are inside the WHERE clause, not chained after `supabase.rpc()`. This lets Postgres use the B-tree/GIN indexes on `price`, `category_ids`, and `stock_status` before the vector distance sort.
- The `<#>` operator returns the negative dot product, so **more negative = more similar**. The default threshold of `-0.5` keeps results with cosine similarity above 0.5.
- `websearch_to_tsquery('arabic', ...)` accepts natural search syntax and uses the Arabic config for consistent stemming.
- The caller can raise recall at query time with `set hnsw.ef_search = 100;` (default 40).

### 5.4 `content_hash` helper

```sql
-- Returns md5(input_text). The sync layer:
--   1. Composes content_for_embedding (name + short_desc + cats + attrs + brand + sku).
--   2. Calls this function (or just uses md5() in SQL) to get the hash.
--   3. Compares to the stored content_hash column.
--   4. If equal → embedding unchanged → SKIP re-embedding (save OpenAI cost).
--   5. If different → re-embed, update embedding + content_hash + indexed_at.
create or replace function public.content_hash(input_text text)
returns text
language sql immutable
as $$
  select md5(input_text);
$$;
```

### 5.5 Sync state table

```sql
CREATE TABLE IF NOT EXISTS public.wc_sync_state (
  id                    int primary key default 1,  -- singleton row
  last_sync_modified_at timestamptz not null default '1970-01-01T00:00:00Z',
  last_sync_run_at      timestamptz not null default now(),
  last_full_sweep_at    timestamptz                 -- last deletion-sweep run
);

INSERT INTO public.wc_sync_state (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;
```

---

## 6. Query Edge Function

The `semantic-search` Edge Function runs on Supabase (Deno runtime). It is called by the **chatbot Node backend**, never by the browser. Supabase hosts it — Cloudflare bot protection does not apply.

### File: `supabase/functions/semantic-search/index.ts`

```typescript
// supabase/functions/semantic-search/index.ts
// Edge Function: semantic-search
// Called by the chatbot backend (Node proxy), NOT by the browser.
// Supabase-hosted — Cloudflare bot protection does not apply.
//
// Env vars (set via Supabase dashboard or `supabase secrets set`):
//   SUPABASE_URL               — project URL, e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  — service role key (bypasses RLS; backend only)
//   OPENAI_API_KEY             — OpenAI API key for text-embedding-3-large

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";
const OPENAI_EMBEDDING_DIMS = 512; // MUST match the dims used at index time

interface SearchRequest {
  query: string;                              // user's natural-language search (Arabic or English)
  top_k?: number;                             // default 5
  max_price?: number;                         // optional price ceiling (SAR)
  filter_category?: number;                   // optional category ID filter
  mode?: "hybrid" | "semantic" | "keyword";  // default "hybrid"
  in_stock_only?: boolean;                    // default true
}

interface ProductResult {
  product_id: number;
  name: string;
  price: number | null;
  regular_price: number | null;
  sale_price: number | null;
  currency: string;
  sku: string | null;
  stock_status: string | null;
  category_names: string[];
  brand: string | null;
  image_url: string | null;
  permalink: string | null;
  rrf_score: number | null;
  match_source: string | null;
}

Deno.serve(async (req: Request) => {
  // --- CORS (only needed if called cross-origin from backend; harmless if same-origin)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed. Use POST.", corsHeaders);
  }

  // --- Parse + validate request body
  let body: SearchRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body.", corsHeaders);
  }

  const {
    query,
    top_k = 5,
    max_price = null,
    filter_category = null,
    mode = "hybrid",
    in_stock_only = true,
  } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return jsonError(400, "Field 'query' is required and must be non-empty.", corsHeaders);
  }

  const env = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY"),
  };

  for (const [k, v] of Object.entries(env)) {
    if (!v) {
      return jsonError(500, `Missing env var: ${k}`, corsHeaders);
    }
  }

  // --- Create Supabase client (service role — bypasses RLS)
  const supabase = createClient(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // --- Embed the query via OpenAI text-embedding-3-large @ 512 dims
  //     CRITICAL: same model + dims as used at index time.
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(query, env.OPENAI_API_KEY!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(502, `Embedding failed: ${msg}`, corsHeaders);
  }

  // --- Build filter object for the SQL RPC functions
  //     Filters are pushed INTO the function call so the query planner can use
  //     indexes (category_ids GIN, price btree, stock_status btree) before the
  //     vector distance sort — not chained after rpc() which would force a
  //     full table scan + filter in JS.
  let rpcName: string;
  let rpcArgs: Record<string, unknown>;

  if (mode === "hybrid") {
    rpcName = "hybrid_search_products";
    rpcArgs = {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: top_k,
      in_stock_only,
      max_price,
      filter_category,
    };
  } else if (mode === "semantic") {
    rpcName = "match_products";
    rpcArgs = {
      query_embedding: queryEmbedding,
      match_count: top_k,
      in_stock_only,
      max_price,
      filter_category,
    };
  } else {
    // keyword mode — no embedding needed, but we already embedded (harmless)
    rpcName = "keyword_search_products";
    rpcArgs = {
      query_text: query,
      match_count: top_k,
      in_stock_only,
      max_price,
      filter_category,
    };
  }

  const { data: rows, error } = await supabase.rpc(rpcName, rpcArgs);

  if (error) {
    return jsonError(
      500,
      `Database error in ${rpcName}: ${error.message}`,
      corsHeaders
    );
  }

  if (!rows || rows.length === 0) {
    return jsonResponse(
      200,
      { query, mode, count: 0, results: [] as ProductResult[] },
      corsHeaders
    );
  }

  // --- Trim to compact schema for the chatbot
  //     The SQL functions return full wc_products rows; we project only the
  //     fields the chatbot needs to avoid leaking embedding/fts/content_hash
  //     and to keep the tool-result payload small for Claude's context window.
  const results: ProductResult[] = rows.map((r: Record<string, unknown>) => ({
    product_id: r.product_id as number,
    name: r.name as string,
    price: r.price != null ? Number(r.price) : null,
    regular_price: r.regular_price != null ? Number(r.regular_price) : null,
    sale_price: r.sale_price != null ? Number(r.sale_price) : null,
    currency: (r.currency as string) ?? "SAR",
    sku: (r.sku as string) ?? null,
    stock_status: (r.stock_status as string) ?? null,
    category_names: (r.category_names as string[]) ?? [],
    brand: (r.brand as string) ?? null,
    image_url: (r.image_url as string) ?? null,
    permalink: (r.permalink as string) ?? null,
    rrf_score: r.rrf_score != null ? Number(r.rrf_score) : null,
    match_source: (r.match_source as string) ?? null,
  }));

  return jsonResponse(
    200,
    { query, mode, count: results.length, results },
    corsHeaders
  );

  // ------------------------------------------------------------------ helpers

  function jsonResponse(status: number, data: unknown, headers: Record<string, string>) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  function jsonError(status: number, message: string, headers: Record<string, string>) {
    return jsonResponse(status, { error: message }, headers);
  }
});

/**
 * Embed the query string via OpenAI text-embedding-3-large at 512 dims.
 * MUST be the same model + dims used when building the index.
 */
async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
      dimensions: OPENAI_EMBEDDING_DIMS, // 512
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`OpenAI embeddings API error ${resp.status}: ${detail}`);
  }

  const json = await resp.json();
  const embedding = json?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length !== OPENAI_EMBEDDING_DIMS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${OPENAI_EMBEDDING_DIMS}, got ${embedding?.length}`
    );
  }

  return embedding as number[];
}
```

### Environment variables

```bash
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
supabase secrets set OPENAI_API_KEY=<your-openai-key>
```

### curl test

```bash
# Hybrid search (default mode) — Arabic query for a 5MP dome camera under 500 SAR
curl -s -X POST \
  https://YOUR-PROJECT.supabase.co/functions/v1/semantic-search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-SUPABASE-ANON-OR-SERVICE-KEY" \
  -d '{
    "query": "كاميرا دوم 5 ميجابكسل رؤية ليلية",
    "top_k": 5,
    "max_price": 500,
    "mode": "hybrid",
    "in_stock_only": true
  }' | jq .

# Expected response shape:
# {
#   "query": "كاميرا دوم 5 ميجابكسل رؤية ليلية",
#   "mode": "hybrid",
#   "count": 3,
#   "results": [
#     {
#       "product_id": 1042,
#       "name": "كاميرا مراقبة Hikvision DS-2CE70KF0T-LPFS",
#       "price": 320.00,
#       "regular_price": 350.00,
#       "sale_price": 320.00,
#       "currency": "SAR",
#       "sku": "DS-2CE70KF0T-LPFS",
#       "stock_status": "instock",
#       "category_names": ["كاميرات المراقبة", "كاميرات دوم"],
#       "brand": "Hikvision",
#       "image_url": "https://iconnect-intl.com/store/wp-content/uploads/.../ds2ce70k.jpg",
#       "permalink": "https://iconnect-intl.com/store/product/ds-2ce70kf0t-lpfs/",
#       "rrf_score": 0.0312,
#       "match_source": null
#     },
#     ...
#   ]
# }

# Semantic-only mode (no FTS component)
curl -s -X POST \
  https://YOUR-PROJECT.supabase.co/functions/v1/semantic-search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-SUPABASE-ANON-OR-SERVICE-KEY" \
  -d '{
    "query": "كاميرا ليلية للمحل",
    "top_k": 3,
    "mode": "semantic"
  }' | jq .

# Keyword-only mode (FTS, no embedding)
curl -s -X POST \
  https://YOUR-PROJECT.supabase.co/functions/v1/semantic-search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-SUPABASE-ANON-OR-SERVICE-KEY" \
  -d '{
    "query": "Hikvision 5MP",
    "top_k": 10,
    "mode": "keyword"
  }' | jq .
```

### Architecture note: who calls this function

| Layer | Calls the Edge Function? | Why |
|---|---|---|
| **Chatbot Node backend** (proxy) | **Yes** | The backend receives the user's message, decides a `semantic_search` tool call is needed, POSTs to the Edge Function, gets JSON results, passes them to Claude as tool-result context. The backend holds the `SUPABASE_SERVICE_ROLE_KEY` / anon key. |
| Browser / storefront JS | **No** | The browser never calls Supabase directly. It only talks to the Node backend. This keeps API keys off the client and keeps the search logic centralized. |
| WooCommerce / Cloudflare | **No** | This Edge Function runs on Supabase's infrastructure (Deno runtime on Deno Deploy / Supabase Edge). It makes one outbound call to `api.openai.com` for the query embedding and one RPC to the Supabase Postgres database — both internal to Supabase. It never touches `iconnect-intl.com`, so Cloudflare bot protection is irrelevant. |
| Sync pipeline (product indexer) | Calls OpenAI directly (not this function) | The sync pipeline embeds product `content_for_embedding` via the same OpenAI model and writes the vector into `wc_products.embedding`. It does not need this query-path function. |

---

## 7. Sync Strategy

Two complementary mechanisms keep `wc_products` in Supabase current with the WooCommerce store.

| Mechanism | Trigger | Latency | Direction | Traverses Cloudflare? |
|---|---|---|---|---|
| **A) Webhooks** | Product create/update/delete/restore in WC admin | Sub-second (push) | WC server → Supabase Edge Function | No (WP initiates outbound) |
| **B) Cron Delta-Sync** | Supabase scheduled function, every 5 min | Up to 5 min (pull) | Supabase → WC REST API | Yes (needs CF retry) |

Webhooks are primary (real-time, no Cloudflare). Cron is the safety net (catches missed webhooks, handles deletions that webhooks might miss). Both converge on the same `upsertProduct()` helper that implements the re-embed decision.

### 7A. Webhooks (Primary, Real-Time)

**Why webhooks are reliable here:** WooCommerce webhooks are delivered by the WordPress server making an outbound HTTP POST to the `delivery_url`. This does **not** traverse the store's Cloudflare bot protection (Cloudflare filters inbound requests to the store; the WP server's outbound POST to Supabase is unrestricted). Confirmed in the store facts: "WC->outbound webhooks are NOT affected by Cloudflare."

#### Registering the webhooks

Register four webhooks via `POST /wc/v3/webhooks` (Classic REST API, works with retry). Each targets the same Supabase Edge Function but carries a different `topic`:

```bash
POST https://iconnect-intl.com/store/wp-json/wc/v3/webhooks
Auth: Basic (ck_4daa... / cs_234e...)
Headers: User-Agent: Mozilla/5.0 ... (browser UA for CF)
Content-Type: application/json

Body:
{
  "name": "wc-sync-product-created",
  "topic": "product.created",
  "delivery_url": "https://<project-ref>.supabase.co/functions/v1/wc-sync-webhook",
  "secret": "<WEBHOOK_SECRET>"
}

# Repeat for:
#   topic: "product.updated"   -> same delivery_url
#   topic: "product.deleted"    -> same delivery_url
#   topic: "product.restored"   -> same delivery_url
```

The `secret` is used by WC to HMAC-sign each delivery with the `X-WC-Webhook-Signature` header. Store it in Supabase as `WC_WEBHOOK_SECRET` (set via `supabase secrets set`).

#### Webhook delivery headers

| Header | Value |
|---|---|
| `X-WC-Webhook-Topic` | `product.created` / `product.updated` / `product.deleted` / `product.restored` |
| `X-WC-Webhook-Source` | `woocommerce` |
| `X-WC-Webhook-Signature` | HMAC-SHA256 of the raw body, base64-encoded, keyed with the secret |
| `X-WC-Webhook-Id` | Webhook ID (for idempotency / dedup) |
| `Content-Type` | `application/json` |

#### HMAC verification (security gate)

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  // constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

If verification fails, return `401 Unauthorized` and do nothing.

#### Webhook payload to upsert/delete mapping

The webhook body is the full WooCommerce product object (same shape as `GET /wc/v3/products/{id}`).

| WC payload field | wc_products column | Notes |
|---|---|---|
| `id` | `product_id` | Primary key |
| `name` | `name` | |
| `price` | `price` | Current sale price (string in WC, cast to numeric) |
| `regular_price` | `regular_price` | |
| `sale_price` | `sale_price` | |
| `currency` | `currency` | Hardcode `'SAR'` (WC returns per-store setting) |
| `sku` | `sku` | |
| `stock_status` | `stock_status` | `instock` / `outofstock` / `onbackorder` |
| `stock_quantity` | `stock_quantity` | May be null for unmanaged stock |
| `type` | `type` | `simple` / `variable` |
| `status` | `status` | `publish` / `draft` / `pending` / `trash` |
| `categories[].id` | `category_ids` | `bigint[]` |
| `categories[].name` | `category_names` | `text[]` |
| `brand` (or from metadata) | `brand` | Extract from `attributes` or a brand taxonomy |
| `attributes` | `attributes` | JSONB, e.g. `{"Camera Type":["Dome"],"Resolution":["5MP"]}` |
| `images[0].src` | `image_url` | First image thumbnail |
| `permalink` | `permalink` | |
| `date_created` | `date_created` | |
| `date_modified` | `date_modified` | Used for delta sync watermarking |
| (computed) | `content_for_embedding` | Composed from name + short_desc + category_names + attributes + brand + sku |
| (computed) | `content_hash` | `md5(content_for_embedding)` |
| (computed on change) | `embedding` | 512-dim vector from OpenAI text-embedding-3-large |
| (computed on change) | `indexed_at` | Timestamp of last embedding |

#### Topic-specific handling

| Topic | Action |
|---|---|
| `product.created` | Compute content + hash, embed once, INSERT full row |
| `product.updated` | Compute content + hash, compare to stored hash, apply re-embed decision (see 7C) |
| `product.deleted` | DELETE from `wc_products` WHERE product_id = payload.id (WC sends a minimal body with just `id`) |
| `product.restored` | Treat like `product.updated` — full upsert with re-embed if content changed |

#### Webhook Edge Function: `wc-sync-webhook`

```typescript
// supabase/functions/wc-sync-webhook/index.ts
// Deno Edge Function — receives WC product webhooks
// No CF retry needed (WP initiates outbound, does not traverse Cloudflare)

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("WC_WEBHOOK_SECRET")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("X-WC-Webhook-Signature") || "";
  const topic = req.headers.get("X-WC-Webhook-Topic") || "";

  // 1. HMAC verification
  const expectedSig = createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");

  if (expectedSig.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
    console.error("HMAC verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 2. Route by topic
  try {
    const payload = JSON.parse(rawBody);
    const productId = payload.id;

    if (topic === "product.deleted") {
      const { error } = await supabase
        .from("wc_products")
        .delete()
        .eq("product_id", productId);

      if (error) throw error;
      console.log(`Deleted product ${productId}`);
      return new Response("OK", { status: 200 });
    }

    // product.created, product.updated, product.restored -> upsert
    await upsertProduct(payload, supabase, OPENAI_API_KEY);
    console.log(`Upserted product ${productId} (topic: ${topic})`);
    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook processing error:", err);
    // Return 500 to trigger WC retry (WC retries up to 3-5 times)
    return new Response("Processing error", { status: 500 });
  }
});

// upsertProduct is imported from _shared/upsert_product.ts (see section 7C)
```

### 7B. Cron Delta-Sync (Fallback, every 5 minutes)

**Why it exists:** Webhooks can be dropped (network blips, Supabase Edge Function cold-start timeouts, WC webhook delivery failures that exceed retry limits). The cron delta-sync is a pull-based safety net that catches any changes the webhooks missed.

**`?modified_after` verification:** Verified during the design session. A `curl` call to `GET /wc/v3/products?per_page=1&modified_after=2025-01-01T00:00:00` returned **HTTP 200** with product JSON including `date_modified` fields (e.g., `"date_modified":"2026-07-09T12:44:43"`). Subsequent calls intermittently received Cloudflare challenge pages (HTTP 403 / "Just a moment..."), confirming that:
- `?modified_after` is supported and returns correctly filtered products
- Cloudflare intermittently challenges Supabase → WC REST API calls
- Retry with browser User-Agent is required

#### Delta-sync algorithm

```
1. Read last_sync_modified_at from wc_sync_state (singleton row, id=1)
2. Fetch GET /wc/v3/products?modified_after=<last_sync_modified_at>&per_page=100&orderby=modified&order=asc
   - Use browser User-Agent
   - Retry on Cloudflare challenge (up to 3 retries with exponential backoff)
3. Paginate: follow X-WP-TotalPages header or increment page param
4. For each product in the response:
   a. Map to wc_products shape
   b. Call upsertProduct() (the shared helper with re-embed decision)
5. After all pages processed:
   - Update last_sync_modified_at = MAX(date_modified) across all fetched products
   - Update last_sync_run_at = now()
6. Deletion sweep (every ~12th run = hourly):
   - Fetch ALL product IDs from WC (per_page=100, paginate, status=any)
   - Compare to SELECT product_id FROM wc_products
   - For IDs in Supabase but NOT in WC: DELETE FROM wc_products WHERE product_id = <missing_id>
   - Update last_full_sweep_at = now()
```

#### Cloudflare retry logic (only in delta-sync, not in webhook receiver)

```typescript
async function fetchWcWithCfRetry(url: string, opts: RequestInit, maxRetries = 3): Promise<Response> {
  const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const headers = {
    ...opts.headers,
    "User-Agent": browserUA,
    "Authorization": `Basic ${btoa(`${WC_CK}:${WC_CS}`)}`,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { ...opts, headers });

    if (res.ok) return res;

    // CF challenge = 403 with "Just a moment" or "challenge" in body
    if (res.status === 403 && attempt < maxRetries) {
      const body = await res.text();
      if (body.includes("Just a moment") || body.includes("challenge")) {
        // Exponential backoff: 2s, 4s, 8s
        await sleep(2000 * Math.pow(2, attempt));
        continue;
      }
    }

    throw new Error(`WC API ${res.status} after ${attempt} retries`);
  }
  throw new Error("Unreachable");
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
```

#### Pagination

WooCommerce returns pagination via the `X-WP-TotalPages` header:

```typescript
let page = 1;
let hasMore = true;
let maxModified = lastSyncModifiedAt;

while (hasMore) {
  const url = `${WC_BASE}/products?modified_after=${encodeURIComponent(lastSyncModifiedAt)}`
    + `&per_page=100&page=${page}&orderby=modified&order=asc&status=any`;
  const res = await fetchWcWithCfRetry(url, {});
  const products: WcProduct[] = await res.json();

  for (const p of products) {
    await upsertProduct(p, supabase, OPENAI_API_KEY);
    if (p.date_modified > maxModified) maxModified = p.date_modified;
  }

  const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "0");
  hasMore = page < totalPages;
  page++;
}
```

#### Handling deleted products

WooCommerce's `?modified_after` does NOT return deleted products (they're gone from the query). The deletion sweep handles this:
- Run every ~12th cron invocation (hourly if cron is every 5 min)
- Fetch all WC product IDs (lightweight: `?per_page=100&status=any`, paginate all)
- `SELECT product_id FROM wc_products` from Supabase
- Set-difference: IDs in Supabase but not in WC = deleted
- `DELETE FROM wc_products WHERE product_id = ANY($missing_ids)`

This is an O(n) scan but with only ~180 products it is trivial. If the catalog grows to thousands, optimize by batching and running less frequently.

**Design choice: hard DELETE vs soft-delete.** Hard DELETE is preferred because deleted products should not appear in search results at all, and soft-delete would require filtering in every search query. If a product is restored, the `product.restored` webhook (or delta-sync) will re-fetch the full product and re-insert it.

#### Delta-sync Edge Function: `wc-delta-sync`

```typescript
// supabase/functions/wc-delta-sync/index.ts
// Supabase Scheduled Edge Function — runs every 5 minutes via cron

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WC_BASE = "https://iconnect-intl.com/store/wp-json/wc/v3";
const WC_CK = Deno.env.get("WC_CONSUMER_KEY")!;
const WC_CS = Deno.env.get("WC_CONSUMER_SECRET")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MAX_RETRIES = 3;

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Read last sync watermark
  const { data: state } = await supabase
    .from("wc_sync_state")
    .select("last_sync_modified_at, last_full_sweep_at")
    .eq("id", 1)
    .maybeSingle();

  const lastModified = state?.last_sync_modified_at || "1970-01-01T00:00:00Z";

  // 2. Delta fetch with pagination
  let page = 1;
  let hasMore = true;
  let maxModified = lastModified;
  let upsertCount = 0;

  while (hasMore) {
    const url = `${WC_BASE}/products?modified_after=${encodeURIComponent(lastModified)}`
      + `&per_page=100&page=${page}&orderby=modified&order=asc&status=any`;

    const res = await fetchWcWithCfRetry(url);
    const products: any[] = await res.json();

    for (const p of products) {
      await upsertProduct(p, supabase, OPENAI_API_KEY);
      upsertCount++;
      if (p.date_modified > maxModified) maxModified = p.date_modified;
    }

    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "0");
    hasMore = page < totalPages;
    page++;
  }

  // 3. Update sync watermark
  await supabase
    .from("wc_sync_state")
    .update({
      last_sync_modified_at: maxModified,
      last_sync_run_at: new Date().toISOString(),
    })
    .eq("id", 1);

  console.log(`Delta sync: ${upsertCount} products upserted, maxModified=${maxModified}`);

  // 4. Deletion sweep (hourly)
  await maybeRunDeletionSweep(supabase, state);

  return new Response(JSON.stringify({ upserted: upsertCount, maxModified }), {
    headers: { "Content-Type": "application/json" },
  });
});

// CF retry fetcher and deletion sweep functions (see Appendix)
```

#### Supabase cron schedule

In `supabase/config.toml` or via the Supabase dashboard:

```toml
[functions.wc-delta-sync]
schedule = "*/5 * * * *"   # every 5 minutes
```

### 7C. The Re-Embed Decision (Critical Cost Optimizer)

**The problem:** OpenAI `text-embedding-3-large` costs money per token. If every price or stock change triggered a re-embedding, the cost would be significant and unnecessary — price/stock changes do not affect semantic meaning.

**The solution: `content_hash` comparison.** `content_for_embedding` is composed ONLY from fields that affect semantic meaning (name, short_description, category_names, attributes, brand, sku). It explicitly excludes: price, regular_price, sale_price, stock_status, stock_quantity, image_url, permalink, status.

`content_hash = md5(content_for_embedding)` is stored alongside the row. On upsert:

```
                    ┌─────────────────────────────────────┐
                    │  Compute new content_for_embedding  │
                    │  Compute new content_hash = md5()   │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  SELECT content_hash FROM            │
                    │  wc_products WHERE product_id=?     │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                               │
               HASH SAME                      HASH DIFFERENT
                    │                               │
                    ▼                               ▼
    ┌───────────────────────┐      ┌──────────────────────────┐
    │ CHEAP UPDATE PATH      │      │ FULL UPDATE + RE-EMBED    │
    │ Update only:           │      │ Update ALL columns        │
    │  price                 │      │ Call OpenAI embeddings API │
    │  regular_price         │      │  (text-embedding-3-large   │
    │  sale_price            │      │   @ 512 dims)              │
    │  stock_status          │      │ Set embedding = <vector>   │
    │  stock_quantity         │      │ Set indexed_at = now()     │
    │  date_modified         │      │ Set content_hash = new     │
    │  category_ids          │      │ Set content_for_embedding  │
    │  category_names        │      │                            │
    │  image_url             │      │ Cost: ~$0.0001 per product │
    │  status                │      │  (one embeddings call)      │
    │  updated_at = now()    │      │                            │
    │                        │      │                            │
    │ Cost: FREE (no API)    │      │                            │
    │ Embedding: UNCHANGED   │      │                            │
    └───────────────────────┘      └──────────────────────────┘
```

**Why this decouples price/stock churn from embedding cost:** In a retail store, the vast majority of product edits are price changes, stock adjustments, and stock-status flips. These fire `product.updated` webhooks frequently (possibly dozens of times per day for a 180-product catalog during promotions). Each of these has `content_hash` UNCHANGED, so the cheap path is taken — zero OpenAI API calls.

The rare path (re-embed) fires only when someone edits the product name, description, categories, or attributes — typically a handful of edits per week for a store this size. Each re-embed is a single OpenAI embeddings call for a single short text (~200-500 tokens), costing a fraction of a cent.

**Estimated monthly cost for ~180 products:**
- Price/stock changes (say 50/day × 30 days = 1500 events): $0.00 (cheap path)
- Content edits (say 10/month): ~$0.001 (10 embedding calls)
- Total: effectively free

#### Shared `upsertProduct` helper (imported by both webhook + delta-sync)

```typescript
// supabase/functions/_shared/upsert_product.ts

import { createHash } from "node:crypto";

// ---- Build the semantic content string ----
function buildContentForEmbedding(p: WcProduct): string {
  const parts: string[] = [p.name];
  if (p.short_description) parts.push(stripHtml(p.short_description));
  if (p.categories?.length) parts.push(p.categories.map(c => c.name).join(" "));
  if (p.attributes?.length) {
    for (const attr of p.attributes) {
      const vals = (attr.options || []).join(" ");
      parts.push(`${attr.name}: ${vals}`);
    }
  }
  // brand from attributes or a dedicated field
  const brandAttr = p.attributes?.find(a => a.name === "Brand" || a.name === "العلامة التجارية");
  if (brandAttr?.options?.length) parts.push(brandAttr.options.join(" "));
  if (p.sku) parts.push(p.sku);
  return parts.join(" ").trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function contentHash(text: string): string {
  return createHash("md5").update(text, "utf8").digest("hex");
}

function mapWcProductToColumns(p: WcProduct, content: string, hash: string) {
  return {
    product_id: p.id,
    name: p.name,
    price: p.price ? parseFloat(p.price) : null,
    regular_price: p.regular_price ? parseFloat(p.regular_price) : null,
    sale_price: p.sale_price ? parseFloat(p.sale_price) : null,
    currency: "SAR",
    sku: p.sku || null,
    stock_status: p.stock_status || null,
    stock_quantity: p.stock_quantity ?? null,
    type: p.type || "simple",
    status: p.status || "publish",
    category_ids: (p.categories || []).map(c => c.id),
    category_names: (p.categories || []).map(c => c.name),
    brand: extractBrand(p),
    attributes: p.attributes || null,
    image_url: p.images?.[0]?.src || null,
    permalink: p.permalink || null,
    date_created: p.date_created || null,
    date_modified: p.date_modified,
    content_for_embedding: content,
    content_hash: hash,
    updated_at: new Date().toISOString(),
  };
}

function extractBrand(p: WcProduct): string | null {
  const brandAttr = p.attributes?.find(a => a.name === "Brand" || a.name === "العلامة التجارية");
  return brandAttr?.options?.[0] || null;
}

// ---- The core upsert with re-embed decision ----
async function upsertProduct(p: WcProduct, supabase: SupabaseClient, openAiKey: string): Promise<void> {
  const content = buildContentForEmbedding(p);
  const hash = contentHash(content);

  // Check existing hash
  const { data: existing } = await supabase
    .from("wc_products")
    .select("content_hash")
    .eq("product_id", p.id)
    .maybeSingle();

  const existingHash = existing?.content_hash;
  const hashUnchanged = existingHash !== null && existingHash !== undefined && existingHash === hash;

  if (hashUnchanged) {
    // ---- CHEAP PATH: no re-embedding ----
    const cheapCols = {
      price: p.price ? parseFloat(p.price) : null,
      regular_price: p.regular_price ? parseFloat(p.regular_price) : null,
      sale_price: p.sale_price ? parseFloat(p.sale_price) : null,
      stock_status: p.stock_status || null,
      stock_quantity: p.stock_quantity ?? null,
      date_modified: p.date_modified,
      category_ids: (p.categories || []).map(c => c.id),
      category_names: (p.categories || []).map(c => c.name),
      image_url: p.images?.[0]?.src || null,
      status: p.status || "publish",
      updated_at: new Date().toISOString(),
    };
    await supabase
      .from("wc_products")
      .update(cheapCols)
      .eq("product_id", p.id);
    return;
  }

  // ---- EXPENSIVE PATH: re-embed ----
  const embedding = await getEmbedding(content, openAiKey);

  const allCols = mapWcProductToColumns(p, content, hash);
  allCols.embedding = embedding;
  allCols.indexed_at = new Date().toISOString();

  await supabase
    .from("wc_products")
    .upsert(allCols, { onConflict: "product_id" });
}

// ---- OpenAI embedding call ----
async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-large",
      input: text,
      dimensions: 512,   // MUST match the vector(512) column
    }),
  });
  const json = await res.json();
  return json.data[0].embedding;
}
```

### 7D. Bulk Initial Load (One-Shot)

For first-time setup or full re-indexing (e.g., changing embedding model dimensions). Run as a Supabase Edge Function triggered manually, or as a standalone Deno script.

```typescript
async function bulkLoad(supabase: SupabaseClient, openAiKey: string) {
  const WC_BASE = "https://iconnect-intl.com/store/wp-json/wc/v3";
  const CHUNK_SIZE = 100;    // OpenAI allows up to 2048 inputs per call
  const PER_PAGE = 100;      // WC max per_page
  let page = 1;
  let total: number | null = null;

  // 1. Fetch ALL products from WC (paginate)
  const allProducts: WcProduct[] = [];
  while (true) {
    const url = `${WC_BASE}/products?per_page=${PER_PAGE}&page=${page}&orderby=id&order=asc&status=any`;
    const res = await fetchWcWithCfRetry(url, {});
    const products: WcProduct[] = await res.json();
    if (products.length === 0) break;
    allProducts.push(...products);
    if (total === null) {
      total = parseInt(res.headers.get("X-WP-Total") || "0");
    }
    if (page * PER_PAGE >= (total || 0)) break;
    page++;
  }
  console.log(`Fetched ${allProducts.length} products from WC`);

  // 2. Build content_for_embedding for each
  const items = allProducts.map(p => {
    const content = buildContentForEmbedding(p);
    const hash = contentHash(content);
    return { product: p, content, hash };
  });

  // 3. Batch-embed in chunks of 100
  const allEmbeddings: { productId: number; embedding: number[]; content: string; hash: string }[] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const texts = chunk.map(item => item.content);
    const embeddings = await batchGetEmbeddings(texts, openAiKey);

    chunk.forEach((item, j) => {
      allEmbeddings.push({
        productId: item.product.id,
        embedding: embeddings[j],
        content: item.content,
        hash: item.hash,
      });
    });

    console.log(`Embedded chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(items.length / CHUNK_SIZE)}`);
    await sleep(500); // rate limit
  }

  // 4. Build full rows and batch upsert
  const rows = allEmbeddings.map(e => {
    const p = items.find(i => i.product.id === e.productId)!.product;
    const cols = mapWcProductToColumns(p, e.content, e.hash);
    cols.embedding = e.embedding;
    cols.indexed_at = new Date().toISOString();
    return cols;
  });

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("wc_products")
      .upsert(chunk, { onConflict: "product_id" });
    if (error) console.error("Upsert error:", error);
  }

  // 5. Initialize sync state
  const maxModified = allProducts
    .map(p => p.date_modified)
    .sort()
    .pop();
  await supabase
    .from("wc_sync_state")
    .update({
      last_sync_modified_at: maxModified,
      last_sync_run_at: new Date().toISOString()
    })
    .eq("id", 1);

  console.log(`Bulk load complete: ${rows.length} products indexed`);
}

async function batchGetEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-large",
      input: texts,
      dimensions: 512,
    }),
  });
  const json = await res.json();
  return json.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding);
}
```

**Batch chunking summary:**

| Step | Chunk size | API | Purpose |
|---|---|---|---|
| Fetch from WC | 100 per page | WC REST API | Paginate all products |
| Embed | 100 texts per call | OpenAI embeddings | Minimize API calls (180 products = 2 calls) |
| Upsert to Supabase | 500 rows per call | Supabase client | Batch insert with conflict handling |

For ~180 products: 2 WC pages, 2 OpenAI embedding calls, 1 Supabase upsert batch.

### 7E. Event → Action → Cost Decision Table

| Event | Columns Updated | Re-embed? | Cost | Frequency |
|---|---|---|---|---|
| Price change (sale price, regular price) | `price`, `regular_price`, `sale_price`, `date_modified`, `updated_at` | No (hash unchanged) | Free | Common (promotions, daily) |
| Stock change (quantity, status) | `stock_status`, `stock_quantity`, `date_modified`, `updated_at` | No (hash unchanged) | Free | Common (orders, restocking) |
| Image change | `image_url`, `date_modified`, `updated_at` | No (hash unchanged) | Free | Occasional |
| Status change (publish↔draft) | `status`, `date_modified`, `updated_at` | No (hash unchanged) | Free | Rare |
| Category reassignment | `category_ids`, `category_names`, `date_modified`, `updated_at`, `content_for_embedding`, `content_hash` | Yes (hash changed) | ~$0.0001 | Rare |
| Name edit | `name`, `date_modified`, `content_for_embedding`, `content_hash`, `embedding`, `indexed_at`, `updated_at` | Yes (hash changed) | ~$0.0001 | Rare |
| Description/short_desc edit | `content_for_embedding`, `content_hash`, `embedding`, `indexed_at`, `date_modified`, `updated_at` | Yes (hash changed) | ~$0.0001 | Rare |
| Attribute change (add/remove options) | `attributes`, `content_for_embedding`, `content_hash`, `embedding`, `indexed_at`, `date_modified`, `updated_at` | Yes (hash changed) | ~$0.0001 | Rare |
| Brand change | `brand`, `content_for_embedding`, `content_hash`, `embedding`, `indexed_at`, `date_modified`, `updated_at` | Yes (hash changed) | ~$0.0001 | Very rare |
| SKU change | `sku`, `content_for_embedding`, `content_hash`, `embedding`, `indexed_at`, `date_modified`, `updated_at` | Yes (hash changed) | ~$0.0001 | Very rare |
| New product created | ALL columns (full INSERT) | Yes (first embed) | ~$0.0001 | Occasional |
| Product deleted | (row deleted) | N/A (embedding removed with row) | Free | Rare |
| Product restored | ALL columns (full upsert) | Yes (re-embed, row was deleted) | ~$0.0001 | Very rare |

---

## 8. Chatbot Integration

### 8.1 The `semantic_search` Tool Definition (Claude Function-Calling Style)

```json
{
  "name": "semantic_search",
  "description": "Search the product catalog by natural-language intent in Arabic or English. Uses hybrid search (full-text + vector similarity with Reciprocal Ranked Fusion) over a Supabase-indexed copy of the WooCommerce catalog. Understands cross-language queries (Arabic question -> matches Arabic product names and English model codes), fuzzy descriptions of technical specs, and category-intent. Use this when the user describes WHAT they need rather than naming a specific SKU. For exact SKU or keyword lookup, prefer search_products instead.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The user's natural-language search intent, in Arabic or English. Pass the user's words verbatim or lightly cleaned — the embedding model is multilingual. Examples: 'كاميرا مراقبة خارجية مقاومة للمطر 5 ميجابكسل', 'dome camera 2MP night vision', 'IP camera with audio', 'جهاز تسجيل 16 قناة'."
      },
      "top_k": {
        "type": "integer",
        "description": "Maximum number of products to return. Default 8. Hard cap 20. Lower this (3-5) when the intent is very specific; raise it (10-15) for broad exploratory queries.",
        "default": 8,
        "minimum": 1,
        "maximum": 20
      },
      "max_price": {
        "type": "number",
        "description": "Optional price ceiling in SAR. Filters out products whose current price exceeds this value. Omit for no price filter."
      },
      "filter_category": {
        "type": "number",
        "description": "Optional category ID filter — matches against category_ids. Pass the numeric WooCommerce category ID."
      },
      "in_stock_only": {
        "type": "boolean",
        "description": "If true, only return products with stock_status = 'instock'. Default true.",
        "default": true
      },
      "mode": {
        "type": "string",
        "enum": ["hybrid", "semantic", "keyword"],
        "description": "Search strategy. 'hybrid' (default) = RRF fusion of FTS + vector, best for general queries. 'semantic' = vector-only, better for paraphrased intent with no shared vocabulary. 'keyword' = FTS-only, better when the query contains exact model codes or technical terms that must appear literally.",
        "default": "hybrid"
      }
    },
    "required": ["query"]
  }
}
```

**Internal implementation path (NOT exposed to the LLM):**
1. Node backend proxy receives the tool call.
2. Calls Supabase Edge Function `POST /functions/v1/semantic-search` with `{query, top_k, max_price, filter_category, in_stock_only, mode}`.
3. Edge Function: (a) calls OpenAI `text-embedding-3-large` at 512 dims for the query embedding, (b) runs the appropriate RPC function in Supabase with filters pushed inside the SQL.
4. Returns the bounded result set to the proxy, which returns it as the tool result to Claude.

### 8.2 Tool Orchestration: How `semantic_search` Coexists with Existing Tools

```
User intent
    │
    ├─ Exact SKU / model code / known keyword?
    │     → search_products  (WC Classic API ?sku= or ?search=)
    │       Returns exact matches with price/stock.
    │
    ├─ Natural-language description, fuzzy, cross-language, "I need X for Y"?
    │     → semantic_search  (Supabase hybrid search)
    │       Returns ranked candidates (compact schema).
    │
    └─ User picks one product to see full detail / specs / buy?
          → get_product(product_id)   (WC Classic API /products/{id})
            Returns full description, all images, attributes, variations.
```

**Decision rules the chatbot system prompt should encode:**

| User signal | Tool | Why |
|---|---|---|
| Contains a model code like `DS-2CE70KF0T-LPFS` or exact SKU | `search_products` | Exact string match is faster and more precise than semantic; FTS will hit it but semantic adds noise. |
| "ابحث عن كاميرا" / "أحتاج كاميرا خارجية مقاومة للمطر" / "outdoor dome with audio" | `semantic_search` | Intent is descriptive, not lexical. Vector + Arabic FTS handle the vocabulary gap. |
| User asks to refine within semantic results ("الأرخص" / "5 megapixel فقط") | `semantic_search` again with tightened `max_price` or `filter_category` | Re-runs with filter push-down; no need to call a different tool. |
| User picks a product ("أريد تفاصيل هذا المنتج" / "أبي الكامل") | `get_product` | Full product body (long description, all images, attribute table) is intentionally NOT in the compact semantic result to save context. |
| "ما هي الأقسام؟" / "Show me categories" | `list_categories` | Breadcrumb navigation; never needs semantic. |

**Anti-pattern to avoid:** Calling `semantic_search` then `get_product` for every result. Instead, the LLM presents the compact results (name, price, stock, one-line reason) and calls `get_product` only when the user selects one or asks for detail.

### 8.3 Compact Result Schema (Bounded for Context Economy)

The Edge Function returns this shape to the Node proxy; the proxy returns it verbatim as the tool result. Bounded at `top_k` products, each ~50 tokens.

```json
{
  "results": [
    {
      "product_id": 1234,
      "name": "كاميرا Hikvision Dome داخلية 5MP",
      "price": 285.00,
      "regular_price": 320.00,
      "sale_price": 285.00,
      "currency": "SAR",
      "sku": "DS-2CE70KF0T-LPFS",
      "stock_status": "instock",
      "category_names": ["كاميرات", "كاميرات هايك فيجن"],
      "brand": "Hikvision",
      "image_url": "https://iconnect-intl.com/store/wp-content/uploads/.../thumb-1234.jpg",
      "permalink": "https://iconnect-intl.com/store/product/ds-2ce70kf0t-lpfs/",
      "rrf_score": 0.0312,
      "match_source": null
    }
  ],
  "query": "كاميرا مراقبة 5 ميجابكسل",
  "mode": "hybrid",
  "count": 1
}
```

**Token budget per result:** ~50 tokens. At `top_k=8` the full payload is ~500 tokens + overhead. Even at `top_k=20` (hard cap) it stays under ~1,300 tokens — well within budget as the catalog grows to thousands of products.

**What is deliberately omitted** (fetched lazily via `get_product`):
- Long description / short description (can be 500+ tokens each)
- Full attributes JSON
- Multiple images
- `date_created`, `date_modified`, `content_for_embedding`, `embedding`, `fts`

**Fields included and why:**

| Field | Why it's in the compact result |
|---|---|
| `product_id` | Needed for `get_product(id)` follow-up call. |
| `name` | Arabic display name — the primary thing the user reads. |
| `price` + `regular_price` + `sale_price` | Lets the LLM mention discounts ("خصم 15%") without a second call. |
| `sku` | Model code — lets the user confirm the exact product and lets the LLM avoid ambiguity. |
| `stock_status` | "متوفر" / "غير متوفر" — critical for purchase intent. |
| `category_names` | Context for the LLM to explain what kind of product it is. |
| `brand` | Hikvision vs competitor — useful disambiguation. |
| `image_url` | The chatbot frontend can render a thumbnail card. |
| `permalink` | Direct link to the product page for the user. |
| `rrf_score` | Lets the LLM judge confidence; if all scores are low, it can suggest refining the query. |

### 8.4 Why the Chatbot → Supabase Path Avoids Cloudflare Entirely

```
┌──────────┐     1. semantic_search(query, filters)
│  Claude  │ ──────────────────────────────────────────► ┌───────────────┐
│ (LLM)    │                                              │  Node Backend  │
│          │                                              │  (Proxy)      │
└──────────┘                                              └───────┬───────┘
                                                                  │ 2. POST /functions/v1/semantic-search
                                                                  ▼
                                                          ┌───────────────┐
                                                          │   Supabase    │
                                                          │  Edge Func +  │
                                                          │  pgvector DB  │
                                                          └───────┬───────┘
                                                                  │ 3. OpenAI embedding API (server-side)
                                                                  ▼
                                                          ┌───────────────┐
                                                          │  OpenAI API   │
                                                          └───────────────┘
```

**The Cloudflare problem is specific to the WooCommerce store's origin.** Cloudflare's bot protection sits in front of `iconnect-intl.com`. It intercepts requests to the Store-API and storefront pages.

**The semantic search path never touches `iconnect-intl.com`:**

| Hop | Destination | Touches Cloudflare? |
|---|---|---|
| LLM → Node proxy | Local / VPS backend | No |
| Node proxy → Supabase Edge Function | `*.supabase.co` | No — Supabase has its own infra |
| Edge Function → Supabase Postgres (pgvector) | Internal Supabase network | No |
| Edge Function → OpenAI API | `api.openai.com` | No |

**Only the sync fetcher** (the background job that pulls products from WooCommerce into Supabase) hits Cloudflare. That fetcher already has the retry + browser-UA workaround. It runs on a schedule (or via WC webhook) and populates/maintains `wc_products`. Once data is in Supabase, every search query flows through the Supabase → OpenAI path, which is completely independent of the store's WAF.

**Practical consequence:** Semantic search works reliably *today*, even before any Cloudflare WAF bypass is applied. The chatbot's search latency and availability are decoupled from the store's bot-protection behavior. If the store is under a Cloudflare challenge page, the chatbot can still answer product questions instantly.

---

## 9. Scaling & Cost

### Per-query cost (independent of catalog size)

| Component | Cost | Notes |
|---|---|---|
| 1× OpenAI embedding call | ~$0.00013 (text-embedding-3-large @ 512 dims, $0.13/M tokens, query ~10-30 tokens) | One call per search, regardless of catalog size. |
| 1× Supabase RPC (hybrid search SQL) | Included in Supabase compute (sub-ms to ~5ms with HNSW index at 180 products; scales to 10ms-50ms at 10k products) | Single round-trip; filters pushed into SQL. |

**Total marginal cost per search: ~$0.00013 + Supabase compute.** At 1,000 searches/day that's ~$0.13/day in embedding API costs. The cost curve is flat — it does not multiply by product count.

### Indexing cost (amortized, per-product-once + on text-change)

| Event | Cost | Mechanism |
|---|---|---|
| Initial bulk indexing (180 products) | 180 × OpenAI embedding calls = ~$0.002 + batch API efficiency | One-time migration script. |
| Delta sync — product text unchanged | **$0** — `content_hash` comparison skips re-embedding | Sync fetcher computes `md5(content_for_embedding)`, compares to stored hash, skips if equal. |
| Delta sync — product text changed | 1× OpenAI embedding call for that product only | ~$0.00013 per changed product. |
| New product added | 1× embedding call | Via WC `product.created` webhook → sync fetcher → embed → insert. |
| Product price/stock-only change | **$0** — price/stock update without text change doesn't alter `content_for_embedding` | Hash unchanged, only the structured columns update. |

### Scaling projection

| Catalog size | Search latency (HNSW) | Indexing cost (new/changed products/month) | Embedding API cost/search |
|---|---|---|---|
| 180 (current) | <2 ms | Negligible | ~$0.00013 |
| 1,000 | <5 ms | ~$0.13 (if ~1,000 changes) | ~$0.00013 |
| 10,000 | <15 ms | ~$1.30 (if ~10,000 changes) | ~$0.00013 |
| 100,000 | <50 ms (HNSW or switch to IVFFlat) | ~$13 (if ~100,000 changes) | ~$0.00013 |

**Key architectural insight:** Search cost is **O(1) in catalog size** (one embedding + one DB query), while indexing cost is **O(changes)**, not O(catalog). The `content_hash` skip ensures that routine price/stock updates — which are the vast majority of WooCommerce modifications — never trigger an embedding API call. Only name/description/attribute/brand/SKU changes do.

### HNSW vs IVFFlat threshold

- **HNSW (current choice):** Superior recall-at-low-latency for read-heavy workloads. Builds incrementally — new rows inserted without a full rebuild. No tuning knobs. Ideal for <100k rows.
- **IVFFlat (future):** Switch when catalog exceeds 100k rows where build-time and memory dominate. IVFFlat lets you trade recall for speed by tuning `nprobes` at query time. Requires a rebuild when `lists` parameter changes.

### Optional query embedding cache

If cost optimization is needed later, a simple in-memory or Redis cache on the Edge Function for the query→embedding mapping (keyed by `hash(query)`) eliminates redundant OpenAI calls for identical repeated queries — bringing marginal cost to $0 for cache hits.

---

## 10. Setup Checklist

Step-by-step, copy-pasteable. Each step depends on the previous.

### Step 1: Enable pgvector in Supabase

```sql
-- Run in Supabase SQL Editor (Dashboard > SQL > New Query)
create extension if not exists vector schema extensions;
```

### Step 2: Create the `wc_products` table and indexes

```sql
-- Run the full DDL from Section 4 (or Appendix A) in the Supabase SQL Editor.
-- Includes: table, CHECK constraints, generated fts column, GIN + HNSW indexes,
-- supporting indexes on stock_status and category_ids.
```

### Step 3: Create the SQL search functions

```sql
-- Run the three function definitions from Section 5:
--   match_products (semantic)
--   keyword_search_products (FTS)
--   hybrid_search_products (RRF)
-- Plus: content_hash helper and wc_sync_state table.
```

### Step 4: Set environment variables / secrets in Supabase

```bash
# Set via Supabase CLI or Dashboard > Project > Edge Functions > Secrets
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
supabase secrets set OPENAI_API_KEY=<your-openai-key>
supabase secrets set WC_WEBHOOK_SECRET=<generate-a-strong-secret>
supabase secrets set WC_CONSUMER_KEY=ck_4daa8ed707bac1a4d7e2c442bb7de05099c7c05b
supabase secrets set WC_CONSUMER_SECRET=cs_234e5af2614e76e372b33675fbcc3ea80eedba3e
```

### Step 5: Deploy the Edge Functions

```bash
# Deploy three Edge Functions to Supabase:
#   1. semantic-search   (query path)
#   2. wc-sync-webhook   (webhook receiver)
#   3. wc-delta-sync     (cron delta-sync)

supabase functions deploy semantic-search
supabase functions deploy wc-sync-webhook
supabase functions deploy wc-delta-sync
```

### Step 6: Register WooCommerce product webhooks

```bash
# Register 4 webhooks (product.created, product.updated, product.deleted, product.restored)
# Use the script from Section 7A — POST /wc/v3/webhooks with browser UA + retry.
# delivery_url = https://<project-ref>.supabase.co/functions/v1/wc-sync-webhook
# secret = the same WC_WEBHOOK_SECRET from Step 4.
```

### Step 7: Run the bulk initial load

```bash
# Trigger the bulk-load function (or run as a one-off script).
# This fetches all ~180 products from WC, embeds them, and upserts into wc_products.
# Initializes wc_sync_state.last_sync_modified_at to the max date_modified.

# If deployed as an Edge Function:
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/bulk-load \
  -H "Authorization: Bearer <service-role-key>"
```

### Step 8: Set up the cron schedule for delta-sync

```toml
# In supabase/config.toml or via Dashboard > Edge Functions > wc-delta-sync > Schedule
[functions.wc-delta-sync]
schedule = "*/5 * * * *"   # every 5 minutes
```

### Step 9: Verify the search works

```bash
# Test the semantic-search Edge Function (see Section 6 curl examples)
curl -s -X POST \
  https://<project-ref>.supabase.co/functions/v1/semantic-search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <service-role-key>" \
  -d '{"query": "كاميرا دوم 5 ميجابكسل رؤية ليلية", "top_k": 5}' | jq .
```

### Step 10: Wire the `semantic_search` tool into the chatbot

Add the tool definition from Section 8.1 to the Node backend's Claude tool list. Ensure the backend proxy calls the Supabase Edge Function (not WooCommerce) when this tool is invoked. Update the chatbot system prompt with the tool orchestration rules from Section 8.2.

---

## 11. Appendix: Key Code Blocks

### Appendix A: Full DDL (table + indexes)

```sql
create extension if not exists vector schema extensions;

create table if not exists public.wc_products (
  product_id          bigint primary key,
  name                text not null,
  price               numeric(12,2),
  regular_price       numeric(12,2),
  sale_price          numeric(12,2),
  currency            text default 'SAR',
  sku                 text,
  stock_status        text,
  stock_quantity      int,
  type                text,
  status              text,
  category_ids        bigint[],
  category_names      text[],
  brand               text,
  attributes          jsonb,
  image_url           text,
  permalink           text,
  date_created        timestamptz,
  date_modified       timestamptz not null,
  content_for_embedding text not null,
  content_hash        text not null,
  fts tsvector generated always as (to_tsvector('arabic', content_for_embedding)) stored,
  embedding           extensions.vector(512),
  indexed_at          timestamptz,
  updated_at          timestamptz default now(),
  check (price          is null or price          >= 0),
  check (regular_price  is null or regular_price  >= 0),
  check (sale_price     is null or sale_price     >= 0),
  check (stock_status   is null or stock_status in ('instock','outofstock','onbackorder')),
  check (stock_quantity is null or stock_quantity >= 0)
);

create index if not exists idx_wc_products_fts
  on public.wc_products using gin (fts);

create index if not exists idx_wc_products_embedding_hnsw
  on public.wc_products using hnsw (embedding extensions.vector_ip_ops)
  with (m = 16, ef_construction = 64);

create index if not exists idx_wc_products_stock_status
  on public.wc_products (stock_status);

create index if not exists idx_wc_products_category_ids
  on public.wc_products using gin (category_ids);

create index if not exists idx_wc_products_instock
  on public.wc_products (product_id)
  where stock_status = 'instock';

create table if not exists public.wc_sync_state (
  id                    int primary key default 1,
  last_sync_modified_at timestamptz not null default '1970-01-01T00:00:00Z',
  last_sync_run_at      timestamptz not null default now(),
  last_full_sweep_at    timestamptz
);

insert into public.wc_sync_state (id) values (1)
  on conflict (id) do nothing;
```

### Appendix B: `hybrid_search_products` function (compact)

```sql
create or replace function public.hybrid_search_products(
  query_text         text,
  query_embedding    extensions.vector(512),
  match_count        int    default 10,
  in_stock_only      bool   default true,
  max_price          numeric default null,
  filter_category    bigint default null,
  full_text_weight   float  default 1,
  semantic_weight    float  default 1,
  rrf_k              int    default 50
)
returns table (
  product_id bigint, name text, price numeric(12,2),
  regular_price numeric(12,2), sale_price numeric(12,2),
  currency text, sku text, stock_status text, stock_quantity int,
  type text, status text, category_ids bigint[], category_names text[],
  brand text, attributes jsonb, image_url text, permalink text,
  date_created timestamptz, date_modified timestamptz,
  content_for_embedding text, content_hash text, fts tsvector,
  embedding extensions.vector(512), indexed_at timestamptz,
  updated_at timestamptz, rrf_score float
)
language sql stable as $$
  with full_text as (
    select p.product_id,
      row_number() over (order by ts_rank_cd(p.fts, websearch_to_tsquery('arabic', query_text)) desc) as rank_ix
    from public.wc_products p
    where p.fts @@ websearch_to_tsquery('arabic', query_text)
      and (not in_stock_only or p.stock_status = 'instock')
      and (max_price is null or p.price <= max_price)
      and (filter_category is null or filter_category = any(p.category_ids))
    order by ts_rank_cd(p.fts, websearch_to_tsquery('arabic', query_text)) desc
    limit 100
  ),
  semantic as (
    select p.product_id,
      row_number() over (order by p.embedding <#> query_embedding asc) as rank_ix
    from public.wc_products p
    where p.embedding is not null
      and (not in_stock_only or p.stock_status = 'instock')
      and (max_price is null or p.price <= max_price)
      and (filter_category is null or filter_category = any(p.category_ids))
    order by p.embedding <#> query_embedding asc
    limit 100
  ),
  rrf as (
    select
      coalesce(ft.product_id, sem.product_id) as product_id,
      coalesce(full_text_weight  * (1.0 / (rrf_k + ft.rank_ix)), 0.0)
        + coalesce(semantic_weight   * (1.0 / (rrf_k + sem.rank_ix)), 0.0) as rrf_score
    from full_text ft
    full outer join semantic sem on ft.product_id = sem.product_id
  )
  select p.*, r.rrf_score
  from rrf r
  join public.wc_products p on p.product_id = r.product_id
  order by r.rrf_score desc
  limit match_count;
$$;
```

### Appendix C: Edge Function `embedQuery` (compact)

```typescript
async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "text-embedding-3-large",
      input: text,
      dimensions: 512,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI embeddings API error ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  const embedding = json?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== 512)
    throw new Error(`Embedding dimension mismatch: expected 512, got ${embedding?.length}`);
  return embedding;
}
```

### Appendix D: `upsertProduct` re-embed decision (compact)

```typescript
async function upsertProduct(p: WcProduct, supabase: SupabaseClient, openAiKey: string) {
  const content = buildContentForEmbedding(p);
  const hash = contentHash(content);
  const { data: existing } = await supabase
    .from("wc_products").select("content_hash").eq("product_id", p.id).maybeSingle();

  if (existing?.content_hash && existing.content_hash === hash) {
    // CHEAP PATH — no re-embedding
    await supabase.from("wc_products").update({
      price: p.price ? parseFloat(p.price) : null,
      regular_price: p.regular_price ? parseFloat(p.regular_price) : null,
      sale_price: p.sale_price ? parseFloat(p.sale_price) : null,
      stock_status: p.stock_status || null,
      stock_quantity: p.stock_quantity ?? null,
      date_modified: p.date_modified,
      category_ids: (p.categories || []).map(c => c.id),
      category_names: (p.categories || []).map(c => c.name),
      image_url: p.images?.[0]?.src || null,
      status: p.status || "publish",
      updated_at: new Date().toISOString(),
    }).eq("product_id", p.id);
    return;
  }

  // EXPENSIVE PATH — re-embed
  const embedding = await getEmbedding(content, openAiKey);
  const allCols = mapWcProductToColumns(p, content, hash);
  allCols.embedding = embedding;
  allCols.indexed_at = new Date().toISOString();
  await supabase.from("wc_products").upsert(allCols, { onConflict: "product_id" });
}
```

---

*End of document.*
