# Semantic Search Backend — Documentation

The single source of truth for the generic semantic-search backend microservice.

---

## 1. Overview

The **semantic-search-backend** is a **generic, domain-agnostic vector-search microservice**. It is reusable for *any* project — products, knowledge bases, articles, documentation, support tickets — anything that can be represented as a text `content` plus free-form `metadata`. The service owns:

- **Embedding generation** via the OpenAI SDK (configurable model + dimensions).
- **pgvector storage** in a Supabase Postgres `documents` table.
- **Content-hash re-embed decision gate** — if a document's content text has not changed since the last embedding was generated, the expensive OpenAI embedding call is skipped entirely and only the metadata is updated.
- **Hybrid search** combining keyword (Postgres full-text) and semantic (pgvector) results via Reciprocal Rank Fusion (RRF).

### What this service IS

A reusable HTTP microservice that indexes documents (an `id`, a `content` string, and an arbitrary `metadata` JSON object) and answers search queries over them using three modes: semantic, keyword, and hybrid. Any backend can integrate by POSTing documents to `/index` and querying `/search`.

### What this service is NOT

It is **not** WooCommerce-specific. It contains no product logic, no price formatting, no category trees, no e-commerce assumptions. The `metadata` field is free-form `jsonb` — the service stores and returns it verbatim. It has no concept of "products", "SKUs", or "categories" beyond what the caller chooses to put in `metadata`.

---

## 2. Architecture

At a glance, the service is a thin **Express** HTTP layer over **Supabase Postgres** (with the **pgvector** extension) and the **OpenAI Embeddings API**.

```
                 ┌─────────────┐
   POST /index → │   Express   │ → Supabase REST (documents table)
                 │  (index.ts) │ → OpenAI embeddings.create (only if content changed)
                 └──────┬──────┘
                        │
   POST /search → Express → embedOne(query) → OpenAI
                            → Supabase RPC (match_documents / keyword_search_documents / hybrid_search_documents)
```

### Components

| Layer | Technology | Notes |
|-------|------------|-------|
| HTTP API | Express 4 | JSON body, 10 mb limit, CORS configurable. |
| DB client | `@supabase/supabase-js` | Service-role key; calls RPC functions + REST table API. |
| Vector store | Supabase Postgres + pgvector | `documents` table with `embedding vector(512)` + HNSW index. |
| Full-text search | Postgres `tsvector` (generated column, `arabic` config) + GIN index. | |
| Embeddings | OpenAI `text-embedding-3-large` at 512 dimensions | Same model used for index and query. |

### The re-embed decision gate

On every `POST /index` the service computes `md5(content)` and compares it to the stored `content_hash`:

- **Hash unchanged** → update `metadata` + `updated_at` only. **No OpenAI call.** (cheap path)
- **Hash changed or document is new** → call OpenAI `embeddings.create`, upsert `embedding` + `content_hash` + `indexed_at` + `updated_at`. (expensive path)

This means frequent metadata-only updates (price, stock, category) cost **zero** embedding API calls.

### The three search modes

| Mode | SQL RPC function | Description |
|------|------------------|-------------|
| `semantic` | `match_documents` | Pure vector similarity (inner product — OpenAI embeddings are normalised). |
| `keyword` | `keyword_search_documents` | Pure full-text search using Postgres `tsvector` with the configured FTS language (`arabic`). |
| `hybrid` (default) | `hybrid_search_documents` | RRF fusion of both ranked lists — best for recall + precision. |

### ASCII data-flow diagrams

**POST /index**

```
Client
  │
  │  POST /index  { id, content, metadata }
  ▼
Express (indexSchema zod validation)
  │
  ├─ computeContentHash(content) → md5 hex digest (newHash)
  │
  ├─ supabase.from(documents).select("content_hash").eq("id", id).maybeSingle()
  │        │
  │        └─ storedHash
  │
  ├─ shouldReembed(storedHash, newHash)?
  │
  ├─ NO (hashes match) ─────────────────────────┐
  │     supabase.update({ metadata, updated_at })│
  │     → 200 { action: "updated_metadata",       │
  │             reembedded: false }               │
  │                                              │
  └─ YES (new / changed)                         │
        embedOne(content) → OpenAI               │
        supabase.upsert({ id, content,            │
          content_hash, metadata, embedding,     │
          indexed_at, updated_at })              │
        → 200 { action: "created"|"reembedded",  │
                reembedded: true }               │
                                               ──┘
```

**POST /search**

```
Client
  │
  │  POST /search  { query, top_k, mode, match_threshold, filters? }
  ▼
Express (searchSchema zod validation)
  │
  ├─ mode === "keyword"
  │     supabase.rpc("keyword_search_documents",
  │       { query_text, match_count, filter })
  │
  ├─ mode === "semantic"
  │     embedOne(query) → OpenAI
  │     supabase.rpc("match_documents",
  │       { query_embedding, match_threshold, match_count, filter })
  │
  └─ mode === "hybrid" (default)
        embedOne(query) → OpenAI
        supabase.rpc("hybrid_search_documents",
          { query_text, query_embedding, match_count,
            match_threshold, filter })

  → 200 { results: [ { id, score, metadata } ] }
```

---

## 3. Folder & file structure

```
semantic-search-backend/
├── .env.example
├── package.json
├── tsconfig.json
├── README.md
├── DOCUMENTATION.md          ← this file
├── sql/
│   └── 001_init.sql          ← schema + functions migration
└── src/
    ├── index.ts              ← Express app entry point
    ├── db.ts                 ← Supabase client singleton
    ├── embeddings.ts         ← OpenAI embedding utilities
    ├── reembed.ts            ← content-hash + re-embed decision
    └── schemas.ts            ← zod request-body schemas
```

### File-by-file explanation

**`.env.example`** — Template of required environment variables. Copy to `.env` and fill in. Contains `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `EMBEDDING_MODEL`, `EMBEDDING_DIMS`, `FTS_CONFIG`, `DOCUMENTS_TABLE`, `PORT`, `CORS_ORIGIN`.

**`package.json`** — npm manifest. `type: "module"` (ESM). Scripts: `dev` (`tsx watch src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`). Requires Node `>=20`. Dependencies: `@supabase/supabase-js`, `cors`, `dotenv`, `express`, `openai`, `zod`. Dev deps: `@types/cors`, `@types/express`, `@types/node`, `tsx`, `typescript`.

**`tsconfig.json`** — TypeScript config. Target `ES2022`, module `NodeNext`, `moduleResolution: NodeNext`, strict mode, `outDir: dist`, `rootDir: src`, declarations + source maps emitted.

**`README.md`** — User-facing quick-start. Explains the re-embed gate, the three search modes, env vars, API endpoints, setup, and reuse guidance.

**`sql/001_init.sql`** — The Postgres migration. Creates the `documents` table (with `vector(512)` embedding + generated `tsvector` FTS column using `arabic` config), GIN and HNSW indexes, the `content_hash()` SQL helper, and three RPC functions: `match_documents`, `keyword_search_documents`, `hybrid_search_documents`. Designed to run in the Supabase SQL Editor (or any Postgres 15+ with pgvector).

**`src/index.ts`** — Express application entry point. Exports `app` (the Express instance, default export). Defines four routes:
- `GET /health` → `{ status: "ok" }`.
- `POST /index` → parses with `indexSchema`, runs the re-embed decision gate (calls `computeContentHash` + `shouldReembed`), either updates metadata only or calls `embedOne` + upserts the full row. Returns `{ id, action, reembedded }`.
- `POST /search` → parses with `searchSchema`, dispatches to one of the three RPC functions based on `mode`, maps rows to `{ id, score, metadata }`.
- `DELETE /:id` → deletes the row by id via Supabase REST, returns `{ id, deleted }`.
Also wires `cors` + `express.json({ limit: "10mb" })` and starts listening on `PORT`. Logs model, dimensions, table, and CORS origin at startup.

**`src/db.ts`** — Supabase client singleton. Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env (throws if missing). Creates a `SupabaseClient` with `auth: { persistSession: false, autoRefreshToken: false }`. Exports:
- `supabase` — the `SupabaseClient` instance.
- `DOCUMENTS_TABLE` — the table name, from `process.env.DOCUMENTS_TABLE`, defaulting to `"documents"`.

**`src/embeddings.ts`** — OpenAI embedding utilities. Reads `OPENAI_API_KEY` (throws if missing) and constructs an `OpenAI` client. Reads `EMBEDDING_MODEL` (default `text-embedding-3-large`) and `EMBEDDING_DIMS` (default `512`). Exports:
- `openai` — the `OpenAI` client instance.
- `embed(texts: string[]): Promise<number[][]>` — batch-embeds in chunks of `MAX_BATCH = 100` (the OpenAI per-request limit), sorts each response by `index` to preserve input order, returns embeddings in the same order as inputs.
- `embedOne(text: string): Promise<number[]>` — convenience wrapper that calls `embed([text])` and returns the single result.
- `embeddingConfig` — `{ model, dimensions }` object, used for logging/debugging.
- `EmbeddingResult` interface (declared but `embed`/`embedOne` return raw `number[][]`/`number[]`).

**`src/reembed.ts`** — Content-hash and re-embed decision logic. Uses Node's `node:crypto` `createHash("md5")`. Exports:
- `computeContentHash(content: string): string` — returns a 32-char lowercase hex MD5 digest of the content. Not used for security, only change detection.
- `shouldReembed(storedHash: string | null | undefined, newHash: string): boolean` — returns `true` if `storedHash` is falsy (new document) or if `storedHash !== newHash` (content changed).

**`src/schemas.ts`** — Zod validation schemas for all request bodies. Exports:
- `indexSchema` — `z.object({ id: z.string().min(1), content: z.string().min(1), metadata: z.record(z.string(), z.unknown()).default({}) })`. Type: `IndexRequest`.
- `searchSchema` — `z.object({ query: z.string().min(1), top_k: z.number().int().min(1).max(100).default(5), mode: z.enum(["hybrid","semantic","keyword"]).default("hybrid"), match_threshold: z.number().min(0).max(1).default(0.3), filters: z.record(z.string(), z.unknown()).optional() })`. Type: `SearchRequest`.

---

## 4. Environment variables

Pulled exactly from `.env.example` and the code in `db.ts`, `embeddings.ts`, and `index.ts`.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `SUPABASE_URL` | — | **Yes** | Supabase project URL (e.g. `https://your-project.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | — | **Yes** | Supabase service-role key. Server-side only — bypasses RLS. |
| `OPENAI_API_KEY` | — | **Yes** | OpenAI API key for the embeddings endpoint. |
| `EMBEDDING_MODEL` | `text-embedding-3-large` | No | OpenAI embedding model name. Must be a model that supports the `dimensions` parameter. |
| `EMBEDDING_DIMS` | `512` | No | Embedding vector dimension. **Must match** the `vector(N)` column type and function signatures in `sql/001_init.sql`. |
| `FTS_CONFIG` | `arabic` | No | Full-text search config name. **Reference / documentation only** — the actual FTS config is baked into the SQL `tsvector` generated column and the `websearch_to_tsquery` calls. To actually change the language, edit `sql/001_init.sql` and re-run the migration. |
| `DOCUMENTS_TABLE` | `documents` | No | Postgres table name. Must match the table created in `sql/001_init.sql`. |
| `PORT` | `8080` | No | HTTP listen port. |
| `CORS_ORIGIN` | `*` | No | CORS allowed origin(s). Passed directly to `cors({ origin })`. |

> **Note on `FTS_CONFIG`:** The env var exists for documentation/reference, but the SQL migration hard-codes `'arabic'` in the generated `tsvector` column and in every `websearch_to_tsquery` call. Changing `FTS_CONFIG` in `.env` alone has **no runtime effect**. To switch languages you must edit `sql/001_init.sql` and re-run it.

---

## 5. Database / SQL

The entire schema lives in `sql/001_init.sql`. It is intended to be run in the **Supabase SQL Editor** (or any Postgres 15+ with the pgvector extension).

### 5.1 The `documents` table

```sql
create table if not exists documents (
    id            text primary key,
    content       text not null,
    content_hash  text not null,
    metadata      jsonb not null default '{}'::jsonb,
    fts           tsvector
                    generated always as (to_tsvector('arabic', content)) stored,
    embedding     vector(512),
    indexed_at    timestamptz,
    updated_at    timestamptz not null default now()
);
```

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `text primary key` | Unique document identifier supplied by the caller (e.g. product SKU, article slug). |
| `content` | `text not null` | The raw text that gets embedded and indexed for FTS. |
| `content_hash` | `text not null` | `md5(content)` — drives the re-embed decision. Compared on every `POST /index`. |
| `metadata` | `jsonb not null default '{}'` | Arbitrary metadata, stored and returned verbatim. Used for `@>` filtering. |
| `fts` | `tsvector` (generated, stored) | Auto-generated from `content` via `to_tsvector('arabic', content)`. **Hard-coded `arabic` config.** To switch language, change `'arabic'` to `'simple'`, `'english'`, `'spanish'`, etc., and re-run. |
| `embedding` | `vector(512)` | The OpenAI embedding vector. Dimension **must match** `EMBEDDING_DIMS`. Change `vector(512)` everywhere if you change dims. |
| `indexed_at` | `timestamptz` | Set when the embedding is written or refreshed (the expensive path). |
| `updated_at` | `timestamptz not null default now()` | Updated on every write (both cheap and expensive paths). |

### 5.2 The generated FTS tsvector

```sql
fts  tsvector
        generated always as (to_tsvector('arabic', content)) stored
```

- It is a **`GENERATED ALWAYS AS ... STORED`** column — Postgres maintains it automatically whenever `content` changes; you cannot write it directly.
- The FTS config is **`arabic`**. The migration comment says:
  > *"The FTS config is HARD-CODED as 'arabic' in the generated column below. For non-Arabic projects change 'arabic' to 'simple' or your target config (e.g. 'english', 'spanish') and re-run this migration."*
- To switch languages: replace every `'arabic'` occurrence in `sql/001_init.sql` (the generated column + the two `websearch_to_tsquery` calls inside the keyword and hybrid functions) with your target config, then drop & recreate the table/functions and re-run.

### 5.3 Indexes

**GIN index** (fast keyword / FTS search):
```sql
create index if not exists idx_documents_fts on documents using gin (fts);
```

**HNSW index** (fast approximate nearest-neighbour search, inner product):
```sql
create index if not exists idx_documents_embedding_hnsw
    on documents using hnsw (embedding vector_ip_ops)
    with (m = 16, ef_construction = 64);
```
- Uses `vector_ip_ops` (inner-product operator class) because OpenAI embeddings are normalised — inner product ≈ cosine similarity for unit vectors.
- HNSW parameters: `m = 16`, `ef_construction = 64`.

### 5.4 The `content_hash()` helper

```sql
create or replace function content_hash(input text) returns text
    language sql immutable
as $$
    select md5(input);
$$;
```
- A simple SQL-level `md5()` wrapper. The TypeScript `reembed.ts` module computes the same hash client-side (`createHash("md5")`), so this SQL function is a server-side convenience. Both produce the same 32-char lowercase hex digest.

### 5.5 The three RPC functions

#### 5.5.1 `match_documents` — semantic search

```sql
create or replace function match_documents(
    query_embedding   vector(512),
    match_threshold   float default 0.3,
    match_count       int default 5,
    filter            jsonb default null
)
returns table (
    id          text,
    score       float,
    metadata    jsonb
)
language sql stable
as $$
    select
        d.id,
        1 - (d.embedding <#> query_embedding) as score,
        d.metadata
    from documents d
    where 1 = 1
      and (filter is null or d.metadata @> filter)
      and 1 - (d.embedding <#> query_embedding) > match_threshold
    order by d.embedding <#> query_embedding
    limit match_count;
$$;
```

- **Operator:** `<#>` (inner product). OpenAI embeddings are normalised, so `1 - (inner product)` is the cosine similarity score.
- **Filter push:** `(filter is null or d.metadata @> filter)` — the `@>` is jsonb containment; pass e.g. `{"category_ids": [12]}` to match documents whose `metadata` contains that key/value.
- **Threshold:** rows with `score > match_threshold` are kept; below are dropped.
- **Ordering:** ascending `<#>` distance (nearest first).

#### 5.5.2 `keyword_search_documents` — keyword / FTS search

```sql
create or replace function keyword_search_documents(
    query_text    text,
    match_count   int default 5,
    filter        jsonb default null
)
returns table (
    id          text,
    score        float,
    metadata    jsonb
)
language sql stable
as $$
    select
        d.id,
        ts_rank(d.fts, websearch_to_tsquery('arabic', query_text)) as score,
        d.metadata
    from documents d
    where 1 = 1
      and (filter is null or d.metadata @> filter)
      and d.fts @@ websearch_to_tsquery('arabic', query_text)
    order by score desc
    limit match_count;
$$;
```

- **Operator:** `@@` (tsvector match) for filtering, `ts_rank` for scoring.
- **Query parser:** `websearch_to_tsquery('arabic', query_text)` — supports web-style quoted phrases, OR, negation. Config is **`arabic`** (hard-coded).
- **Filter push:** same `(filter is null or d.metadata @> filter)` pattern.
- **Ordering:** `ts_rank` descending.

#### 5.5.3 `hybrid_search_documents` — RRF fusion

```sql
create or replace function hybrid_search_documents(
    query_text         text,
    query_embedding    vector(512),
    match_count        int default 5,
    full_text_weight   float default 1,
    semantic_weight    float default 1,
    rrf_k              int default 50,
    filter             jsonb default null
)
returns table (
    id          text,
    score       float,
    metadata    jsonb
)
language sql stable
as $$
with semantic as (
    select
        d.id,
        row_number() over (order by d.embedding <#> query_embedding) as rank
    from documents d
    where (filter is null or d.metadata @> filter)
      and 1 - (d.embedding <#> query_embedding) > 0
    order by d.embedding <#> query_embedding
    limit 100
),
keyword as (
    select
        d.id,
        row_number() over (order by ts_rank(d.fts, websearch_to_tsquery('arabic', query_text)) desc) as rank
    from documents d
    where (filter is null or d.metadata @> filter)
      and d.fts @@ websearch_to_tsquery('arabic', query_text)
    order by ts_rank(d.fts, websearch_to_tsquery('arabic', query_text)) desc
    limit 100
)
select
    coalesce(s.id, k.id) as id,
    coalesce(
        full_text_weight * (1.0 / (rrf_k + k.rank)), 0
    ) + coalesce(
        semantic_weight * (1.0 / (rrf_k + s.rank)), 0
    ) as score,
    d.metadata
from semantic s
full outer join keyword k on s.id = k.id
join documents d on d.id = coalesce(s.id, k.id)
order by score desc
limit match_count;
$$;
```

- **RRF math:** For each document that appears in either ranked list, the fused score is:
  ```
  score = full_text_weight * (1 / (rrf_k + keyword_rank))
        + semantic_weight  * (1 / (rrf_k + semantic_rank))
  ```
  where `rank` is the 1-based row position in each sub-list (`row_number()`). `rrf_k` (default `50`) is the dampening constant — a higher `k` flattens the rank advantage of top results. Documents present in only one list get a `0` contribution from the missing side via `coalesce(..., 0)`.
- **Sub-lists:** each limited to `limit 100` top candidates before fusion.
- **Join:** `FULL OUTER JOIN` on `id` between the semantic and keyword CTEs, then joined back to `documents` for `metadata`.
- **Filter push:** same `metadata @> filter` containment applied in both CTEs.
- **Note:** `match_threshold` from the API is passed through by the Express layer as the `match_threshold` parameter, but the hybrid function signature does **not** include a `match_threshold` parameter — only `match_count`, `full_text_weight`, `semantic_weight`, `rrf_k`, `filter`. The semantic CTE uses `> 0` (any embedding present) rather than the threshold. (The Express code passes `match_threshold` in the RPC call arguments, but Supabase RPC ignores parameters not in the function signature — see Troubleshooting.)

---

## 6. HTTP API

All endpoints return JSON. There is **no authentication** by default — see Security. Request bodies are validated with zod (`schemas.ts`).

### 6.1 `GET /health`

| | |
|---|---|
| Method | `GET` |
| Path | `/health` |
| Auth | none |
| Request body | none |

**Response (200):**
```json
{ "status": "ok" }
```

**curl:**
```bash
curl http://localhost:8080/health
```

---

### 6.2 `POST /index`

Index or re-index a single document.

| | |
|---|---|
| Method | `POST` |
| Path | `/index` |
| Auth | none |
| Request body | `indexSchema` |

**Request body schema** (`indexSchema`):

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | `string` (min 1) | Yes | — | Unique document id. |
| `content` | `string` (min 1) | Yes | — | Text to embed and full-text index. |
| `metadata` | `Record<string, unknown>` | No | `{}` | Free-form jsonb; stored and returned verbatim. |

**curl:**
```bash
curl -X POST http://localhost:8080/index \
  -H "Content-Type: application/json" \
  -d '{
    "id": "product-123",
    "content": "Apple iPhone 15 Pro Max 256GB Natural Titanium",
    "metadata": {
      "name": "iPhone 15 Pro Max",
      "price": 5199,
      "currency": "SAR"
    }
  }'
```

**Response (200):**
```json
{
  "id": "product-123",
  "action": "created",
  "reembedded": true
}
```

**Response fields:**

| Field | Type | Meaning |
|-------|------|---------|
| `id` | `string` | The document id that was indexed. |
| `action` | `"created"` \| `"reembedded"` \| `"updated_metadata"` | What happened. `created` = new document, embedding generated. `reembedded` = existing document, content changed, embedding regenerated. `updated_metadata` = existing document, content unchanged, only metadata + `updated_at` updated. |
| `reembedded` | `boolean` | `true` when an OpenAI embedding call was made; `false` only when `action === "updated_metadata"`. |

**Error responses:**
- `400` — `{ error: "Validation failed", details: <zod issues> }` — body did not pass `indexSchema`.
- `500` — `{ error: "Indexing failed", message: <string> }` — Supabase or OpenAI error.

---

### 6.3 `POST /search`

Search indexed documents.

| | |
|---|---|
| Method | `POST` |
| Path | `/search` |
| Auth | none |
| Request body | `searchSchema` |

**Request body schema** (`searchSchema`):

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `query` | `string` (min 1) | Yes | — | Natural-language or keyword query. |
| `top_k` | `number` int 1–100 | No | `5` | Number of results to return. |
| `mode` | `"hybrid"` \| `"semantic"` \| `"keyword"` | No | `"hybrid"` | Which RPC function to call. |
| `match_threshold` | `number` 0–1 | No | `0.3` | Minimum similarity score for semantic results (used by `match_documents`; ignored by `keyword` mode). |
| `filters` | `Record<string, unknown>` | No | (omitted) | jsonb containment filter pushed via `metadata @> filter`. |

**curl (hybrid):**
```bash
curl -X POST http://localhost:8080/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "iphone pro",
    "top_k": 5,
    "mode": "hybrid",
    "match_threshold": 0.3,
    "filters": { "currency": "SAR" }
  }'
```

**Response (200):**
```json
{
  "results": [
    {
      "id": "product-123",
      "score": 0.92,
      "metadata": {
        "name": "iPhone 15 Pro Max",
        "price": 5199,
        "currency": "SAR"
      }
    }
  ]
}
```

**Response fields:**

| Field | Type | Meaning |
|-------|------|---------|
| `results` | `array` | Ordered list of matching documents, best score first. |
| `results[].id` | `string` | Document id. |
| `results[].score` | `number` | Relevance score. For `semantic`: cosine similarity (`1 - inner_product`). For `keyword`: `ts_rank`. For `hybrid`: RRF fused score (small magnitude, typically < 0.1). |
| `results[].metadata` | `object` | The stored metadata, returned verbatim. |

**Error responses:**
- `400` — `{ error: "Validation failed", details: <zod issues> }`.
- `500` — `{ error: "Search failed", message: <string> }`.

---

### 6.4 `DELETE /:id`

Remove a document by id.

| | |
|---|---|
| Method | `DELETE` |
| Path | `/:id` |
| Auth | none |
| Request body | none |
| Path param | `id` — the document id to delete. |

**curl:**
```bash
curl -X DELETE http://localhost:8080/product-123
```

**Response (200):**
```json
{ "id": "product-123", "deleted": true }
```

**Response fields:**

| Field | Type | Meaning |
|-------|------|---------|
| `id` | `string` | The id that was requested for deletion. |
| `deleted` | `boolean` | `true` if a row was actually removed; `false` if the id did not exist. (Uses Supabase `delete({ count: "exact" })` and checks `count > 0`.) |

**Error responses:**
- `500` — `{ error: "Deletion failed", message: <string> }`.

---

## 7. The re-embed decision gate

This is the **key feature** of the service. Embedding generation is the expensive operation (an OpenAI API call per document). The gate avoids it whenever the text content has not changed.

### How it works

1. **Hash the incoming content.** `computeContentHash(content)` in `reembed.ts` computes `md5(content)` using Node's `node:crypto` — a 32-char lowercase hex digest. MD5 is chosen because it is cheap to compute and the hash is used purely for change detection, not security.
2. **Fetch the stored hash.** The Express handler queries `supabase.from(DOCUMENTS_TABLE).select("content_hash").eq("id", id).maybeSingle()` to get the previously stored `content_hash` (or `null`/no row for a new document).
3. **Decide.** `shouldReembed(storedHash, newHash)`:
   - If `storedHash` is falsy (new document) → **re-embed** (expensive path).
   - If `storedHash === newHash` (content unchanged) → **skip embedding** (cheap path).
   - If `storedHash !== newHash` (content changed) → **re-embed** (expensive path).

### The cheap path (content unchanged)

```ts
supabase.from(DOCUMENTS_TABLE)
  .update({ metadata, updated_at: new Date().toISOString() })
  .eq("id", id);
```
→ Response: `{ id, action: "updated_metadata", reembedded: false }`.

Only `metadata` and `updated_at` are written. The `embedding`, `content_hash`, `content`, and `indexed_at` columns are untouched. **Zero OpenAI API cost.**

### The expensive path (content changed or new)

```ts
const embedding = await embedOne(content);   // OpenAI call
supabase.from(DOCUMENTS_TABLE).upsert({
  id, content, content_hash: newHash, metadata,
  embedding, indexed_at: now, updated_at: now,
});
```
→ Response: `{ id, action: "created"|"reembedded", reembedded: true }`.
- `action === "created"` when there was a previously stored hash (i.e. the document already existed).
- `action === "reembedded"` when `storedHash` was present (existing document, content changed).

> **Correction/clarification from the code:** The label logic is `const action = storedHash ? "reembedded" : "created";`. So `action === "created"` is used when the document is **new** (no stored hash), and `action === "reembedded"` when the document **already existed** and content changed.

### Why this matters

In real-world catalogs, **price, stock, and category metadata change frequently** while the **product description / title text stays stable**. Without the gate, every metadata update would re-run the OpenAI embedding API. With the gate:

- Price/stock changes → `action: "updated_metadata"`, **free** (no OpenAI call).
- Description / title text changes → `action: "reembedded"`, one OpenAI call.

This is the single biggest cost saver in the service.

---

## 8. Embeddings

| Property | Value | Source |
|----------|-------|--------|
| Provider | OpenAI | `openai` npm package. |
| Model | `text-embedding-3-large` (default) | `EMBEDDING_MODEL` env var. |
| Dimensions | `512` (default) | `EMBEDDING_DIMS` env var. |
| Distance operator | Inner product (`<#>`) | SQL functions; valid because OpenAI embeddings are normalised. |
| Max batch per OpenAI request | `100` inputs | `MAX_BATCH` constant in `embeddings.ts` (OpenAI API limit). |
| Token limit per input | `8191` tokens | Enforced by the OpenAI API; the service does not pre-tokenise. |

### Multilingual / Arabic rationale

The default FTS config is `arabic` (in the SQL), and the embedding model `text-embedding-3-large` is **multilingual** — it produces high-quality vectors for Arabic, English, and mixed-language text. This makes the service well-suited to Arabic-primary catalogs while still handling English queries. The same model handles both index-time and query-time embedding.

### The "same model for index + query" rule

`embedOne()` is used in **both** `POST /index` (to embed document content) and `POST /search` (to embed the query text). The model and dimensions are read from the same env vars at module load time, so the index and query vectors are guaranteed to be in the same vector space. **Never** mix embedding models or dimensions between index and query — the inner-product scores would be meaningless.

### Batch embedding behavior

`embed(texts: string[])` splits the input into chunks of 100 and makes one OpenAI request per chunk. Within each response, the results are sorted by `index` to guarantee output order matches input order. The function returns `number[][]` in the same order as the input texts. The service currently only calls `embedOne` (single-text wrapper), but the batch function is available for bulk indexing use cases.

---

## 9. Search modes

| Mode | When to use | RPC function | Score meaning |
|------|-------------|--------------|----------------|
| `hybrid` (default) | **Best general choice.** Combines semantic recall (concept matches, synonyms, Arabic↔English cross-lingual) with keyword precision (exact term matches). Use when you want the best of both. | `hybrid_search_documents` | RRF fused score — small magnitude (typically < 0.1); rank-order matters more than absolute value. |
| `semantic` | When the query uses **different words** than the documents but the **meaning** is the same (synonyms, paraphrases, cross-lingual). Pure vector similarity. | `match_documents` | Cosine similarity (`1 - inner_product`), range ~0–1. |
| `keyword` | When you need **exact term / phrase matches** (e.g. product codes, brand names, model numbers). Pure Postgres FTS with `websearch_to_tsquery`. | `keyword_search_documents` | `ts_rank`, unbounded positive. |

### Filters

All three modes accept an optional `filters` object (zod: `filters: z.record(z.string(), z.unknown()).optional()`). It is passed to the RPC as the `filter` parameter and pushed into SQL via:

```sql
(filter is null or d.metadata @> filter)
```

`@>` is **jsonb containment**. Example: `filters: { "currency": "SAR" }` matches any document whose `metadata` JSON contains `"currency": "SAR"`. For array containment, `filters: { "category_ids": [12] }` matches if `metadata.category_ids` is an array containing `12`.

### `match_threshold` meaning

- Default `0.3` (from `searchSchema`).
- Range `0`–`1`.
- Used **only** by `match_documents` (semantic mode) to filter out low-similarity results. Rows with `score <= match_threshold` are dropped.
- In `hybrid_search_documents`, the semantic CTE uses `> 0` (any embedding present), not the threshold — the threshold parameter is sent by Express but is not part of the hybrid function's signature.
- In `keyword` mode, the threshold is irrelevant.
- Lower the threshold (e.g. `0.1`) for higher recall; raise it (e.g. `0.5`) for higher precision.

---

## 10. Setup & run

### Prerequisites

- **Node.js >= 20** (per `package.json` `engines`).
- A **Supabase project** (Postgres 15+ with the pgvector extension enabled — Supabase enables it by default).
- An **OpenAI API key** with access to the embeddings endpoint.

### Step-by-step

1. **Install dependencies:**
   ```bash
   cd semantic-search-backend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in:
   - `SUPABASE_URL` — your project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Dashboard → Settings → API → `service_role` key.
   - `OPENAI_API_KEY` — your OpenAI key.
   - Optionally adjust `EMBEDDING_MODEL`, `EMBEDDING_DIMS`, `DOCUMENTS_TABLE`, `PORT`, `CORS_ORIGIN`.

3. **Run the SQL migration:**
   Open `sql/001_init.sql` in the **Supabase SQL Editor** (Dashboard → SQL Editor → New query → paste → Run). This creates:
   - The `documents` table with pgvector + FTS columns.
   - GIN and HNSW indexes.
   - The `content_hash()` helper.
   - The `match_documents`, `keyword_search_documents`, and `hybrid_search_documents` RPC functions.

   > **Important:** The FTS config (`arabic`) and vector dimension (`512`) are baked into the SQL. To use a different language or dimension, edit `sql/001_init.sql` and re-run it.

4. **Start the server (development):**
   ```bash
   npm run dev
   ```
   This runs `tsx watch src/index.ts` — hot-reload on file changes. You should see:
   ```
   Semantic Search Backend listening on :8080
     Embedding model: text-embedding-3-large (512d)
     Table: documents
     CORS origin: *
   ```

5. **Or build & run (production):**
   ```bash
   npm run build    # tsc → dist/
   npm start        # node dist/index.js
   ```

### Test with curl

**Health check:**
```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

**Index a document:**
```bash
curl -X POST http://localhost:8080/index \
  -H "Content-Type: application/json" \
  -d '{"id":"doc-1","content":"Apple iPhone 15 Pro Max 256GB","metadata":{"price":5199}}'
# {"id":"doc-1","action":"created","reembedded":true}
```

**Index again (metadata only — should skip embedding):**
```bash
curl -X POST http://localhost:8080/index \
  -H "Content-Type: application/json" \
  -d '{"id":"doc-1","content":"Apple iPhone 15 Pro Max 256GB","metadata":{"price":4999}}'
# {"id":"doc-1","action":"updated_metadata","reembedded":false}
```

**Search:**
```bash
curl -X POST http://localhost:8080/search \
  -H "Content-Type: application/json" \
  -d '{"query":"iphone","mode":"hybrid","top_k":5}'
# {"results":[{"id":"doc-1","score":0.02,"metadata":{"price":4999}}]}
```

**Delete:**
```bash
curl -X DELETE http://localhost:8080/doc-1
# {"id":"doc-1","deleted":true}
```

---

## 11. Reusing for other projects

The service is domain-agnostic. The `metadata` jsonb is completely free-form — store whatever your domain needs. To adapt it:

### 11.1 Different FTS language

Change every `'arabic'` occurrence in `sql/001_init.sql` to your target config:
- `'simple'` — language-agnostic, tokenises on whitespace/punctuation. Good for mixed-language or code.
- `'english'`, `'spanish'`, `'french'`, `'german'`, etc. — built-in Postgres configs.

You must update:
1. The `fts` generated column: `to_tsvector('english', content)`.
2. The `keyword_search_documents` function: `websearch_to_tsquery('english', query_text)` (two occurrences).
3. The `hybrid_search_documents` function: `websearch_to_tsquery('english', query_text)` (three occurrences).

Then drop the table and functions and re-run the migration. Also update `FTS_CONFIG` in `.env` for documentation consistency (though it has no runtime effect).

### 11.2 Different embedding dimensions

Change `vector(512)` to `vector(N)` in **all** of these places in `sql/001_init.sql`:
1. The `documents.embedding` column type.
2. The `match_documents` function parameter `query_embedding vector(N)`.
3. The `hybrid_search_documents` function parameter `query_embedding vector(N)`.

Then update `EMBEDDING_DIMS` in `.env` to match `N`. Re-run the migration.

### 11.3 Different table name

Change `create table` name in SQL and set `DOCUMENTS_TABLE` in `.env` to the same value. The TypeScript code uses `DOCUMENTS_TABLE` for all Supabase REST calls.

### 11.4 Different embedding model

Set `EMBEDDING_MODEL` in `.env`. Ensure the model supports the `dimensions` parameter (OpenAI's `text-embedding-3-*` family does). Example: `text-embedding-3-small` with `EMBEDDING_DIMS=1536`.

### 11.5 Concrete example: knowledge-base use case

Suppose you want to index support articles in English with 1536-dim `text-embedding-3-small`:

1. Edit `sql/001_init.sql`:
   - Replace all `'arabic'` with `'english'`.
   - Replace all `vector(512)` with `vector(1536)`.
2. Run the edited SQL in Supabase SQL Editor.
3. `.env`:
   ```
   EMBEDDING_MODEL=text-embedding-3-small
   EMBEDDING_DIMS=1536
   FTS_CONFIG=english
   DOCUMENTS_TABLE=documents
   ```
4. `npm install && npm run dev`.
5. Index articles:
   ```bash
   curl -X POST http://localhost:8080/index \
     -H "Content-Type: application/json" \
     -d '{"id":"kb-42","content":"How to reset your password","metadata":{"section":"account","tags":["auth","password"]}}'
   ```
6. Search:
   ```bash
   curl -X POST http://localhost:8080/search \
     -H "Content-Type: application/json" \
     -d '{"query":"cannot log in","mode":"hybrid","filters":{"section":"account"}}'
   ```

No code changes were needed — only SQL + env.

---

## 12. Security

### Service-role key — server-side only

The Supabase client in `db.ts` uses the **service-role key**, which bypasses Row-Level Security (RLS) entirely. This is appropriate because:

- The service is a **server-side microservice** — the key never reaches the browser.
- The RPC functions and direct table access need unrestricted privileges.

**Never** expose the service-role key to the client. If you build a frontend that talks to this service, the frontend should call *this service's* HTTP API, not Supabase directly.

### CORS

`CORS_ORIGIN` (default `*`) is passed to `cors({ origin })`. In production, set it to your frontend's origin (e.g. `https://shop.example.com`) to prevent cross-origin requests from arbitrary sites.

### No endpoint authentication

By default, **no authentication** is applied to any endpoint. Anyone who can reach the service can index, search, and delete documents. This is intentional for local development and for deployment behind a private network / API gateway. **In production**, put the service behind:

- An API gateway / reverse proxy with authentication (e.g. API key, JWT, OAuth2).
- Or a network firewall that only allows trusted upstreams to reach `PORT`.

### Input validation

All request bodies are validated with **zod** schemas (`schemas.ts`) before the handler logic runs:
- `POST /index` → `indexSchema` (requires non-empty `id` + `content`; `metadata` defaults to `{}`).
- `POST /search` → `searchSchema` (requires non-empty `query`; `top_k` 1–100; `mode` enum; `match_threshold` 0–1; optional `filters`).

Invalid requests return `400` with the zod issue details and never reach the database or OpenAI.

---

## 13. Troubleshooting

### Dimension mismatch: `vector(512)` vs model dims

**Symptom:** Supabase returns an error like `expected 512 dimensions, not 1536` when indexing or searching.

**Cause:** The `vector(N)` column type / function signatures in the SQL do not match the `EMBEDDING_DIMS` env var (or the actual dimensions produced by the configured `EMBEDDING_MODEL`).

**Fix:** Ensure all three `vector(N)` declarations in `sql/001_init.sql` (the column + the two function parameters) match `EMBEDDING_DIMS`. If you changed the model, update both the SQL and the env, then re-run the migration.

---

### `function match_documents does not exist`

**Symptom:** `POST /search` returns `500` with message like `Could not find the function public.match_documents ...`.

**Cause:** The SQL migration (`sql/001_init.sql`) has not been run in the target Supabase project, or it failed partway.

**Fix:** Open `sql/001_init.sql` in the Supabase SQL Editor and run it in full. Check for errors (e.g. pgvector extension not enabled — run `create extension if not exists vector;` first). Verify the functions exist:
```sql
select proname from pg_proc where proname in ('match_documents','keyword_search_documents','hybrid_search_documents');
```

---

### OpenAI 401 Unauthorized

**Symptom:** Indexing or searching returns `500` with `message` mentioning `401` or `Incorrect API key`.

**Cause:** `OPENAI_API_KEY` is missing, wrong, expired, or lacks embeddings access.

**Fix:** Verify the key at `platform.openai.com → API Keys`. Ensure it has permissions for the `embeddings` endpoint. Check `.env` is loaded (`dotenv/config` is imported at the top of `index.ts`).

---

### Empty search results

**Symptom:** `POST /search` returns `{"results":[]}` even though documents are indexed.

**Possible causes & fixes:**

1. **`match_threshold` too high** — semantic results with `score < threshold` are dropped. Lower it (e.g. `0.1` or `0.0`) and retry.
2. **FTS language mismatch** — if your content is English but the SQL uses `'arabic'`, keyword/hybrid search may fail to tokenize. Switch the FTS config in SQL (see §11.1).
3. **Filters too restrictive** — `filters` uses jsonb containment (`@>`). A filter like `{"price": 5199}` only matches documents whose `metadata` contains exactly `"price": 5199`. Remove filters to test.
4. **No embedding written** — if the document was indexed via the cheap path (metadata-only update), the `embedding` column may be `NULL`. Semantic and hybrid search skip rows with no embedding. Re-index with changed content to force embedding generation.

---

### FTS config wrong language

**Symptom:** Keyword search returns no results for queries that should match, or returns unexpected tokenization.

**Cause:** The `arabic` FTS config tokenizes Arabic text correctly but may mis-tokenize English or other languages.

**Fix:** Change the FTS config in `sql/001_init.sql` (the `fts` generated column + all `websearch_to_tsquery` calls) to `'simple'` (language-agnostic) or your target language, drop the table/functions, and re-run. See §11.1.

---

### `hybrid_search_documents` ignores `match_threshold`

**Symptom:** Setting `match_threshold` has no effect in `hybrid` mode.

**Cause:** The `hybrid_search_documents` SQL function signature does not include a `match_threshold` parameter. The Express code passes it in the RPC arguments, but Supabase ignores parameters not in the function signature.

**Fix:** This is by design. To enforce a semantic threshold in hybrid mode, you would need to edit the hybrid function's semantic CTE to add `and 1 - (d.embedding <#> query_embedding) > match_threshold` and add a `match_threshold float default 0.3` parameter to the function signature.

---

## 14. Appendix

### 14.1 Full SQL migration (`sql/001_init.sql`)

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- Semantic Search Backend — Initialisation SQL
-- Run this in the Supabase SQL Editor (or any Postgres 15+ with pgvector).
-- ════════════════════════════════════════════════════════════════════════════
--
-- This migration creates:
--   1. The `documents` table with content, metadata (jsonb), a generated
--      full-text-search tsvector column, and a pgvector embedding column.
--   2. GIN index on the FTS column.
--   3. HNSW index on the embedding column (inner-product, since OpenAI
--      embeddings are normalised).
--   4. Three stored functions used via Supabase RPC:
--        match_documents          — pure semantic search
--        keyword_search_documents — pure keyword / FTS search
--        hybrid_search_documents  — RRF fusion of both
--   5. A content_hash helper (md5).
--
-- ── IMPORTANT NOTES ──────────────────────────────────────────────────────────
-- • The FTS config is HARD-CODED as 'arabic' in the generated column below.
--   For non-Arabic projects change 'arabic' to 'simple' or your target config
--   (e.g. 'english', 'spanish') and re-run this migration.
-- • The embedding dimension (vector(512)) must match the EMBEDDING_DIMS env var
--   in .env. If you change the dimension, update the column type and all function
--   signatures, then re-run.
-- • The table name `documents` must match the DOCUMENTS_TABLE env var.
-- ════════════════════════════════════════════════════════════════════════════

-- Enable pgvector extension
create extension if not exists vector;

-- ───────────────────────────────
-- Documents table
-- ───────────────────────────────
create table if not exists documents (
    id            text primary key,
    content       text not null,
    content_hash  text not null,                                   -- md5(content) — drives the re-embed decision
    metadata      jsonb not null default '{}'::jsonb,              -- arbitrary metadata stored & returned as-is
    fts           tsvector
                    generated always as (to_tsvector('arabic', content)) stored,  -- <-- change 'arabic' here for other languages
    embedding     vector(512),                                     -- <-- must match EMBEDDING_DIMS
    indexed_at    timestamptz,                                     -- set when embedding is written / refreshed
    updated_at    timestamptz not null default now()
);

-- GIN index for fast keyword (FTS) search
create index if not exists idx_documents_fts on documents using gin (fts);

-- HNSW index for fast approximate nearest-neighbour search (inner product)
create index if not exists idx_documents_embedding_hnsw
    on documents using hnsw (embedding vector_ip_ops)
    with (m = 16, ef_construction = 64);

-- ───────────────────────────────
-- content_hash helper (md5)
-- ───────────────────────────────
create or replace function content_hash(input text) returns text
    language sql immutable
    as $$
        select md5(input);
    $$;

-- ════════════════════════════════════════════════════════════════════════════
-- SEMANTIC SEARCH — match_documents
-- ════════════════════════════════════════════════════════════════════════════
create or replace function match_documents(
    query_embedding   vector(512),
    match_threshold   float default 0.3,
    match_count       int default 5,
    filter            jsonb default null
)
returns table (
    id          text,
    score       float,
    metadata    jsonb
)
language sql stable
as $$
    select
        d.id,
        1 - (d.embedding <#> query_embedding) as score,
        d.metadata
    from documents d
    where 1 = 1
      and (filter is null or d.metadata @> filter)
      and 1 - (d.embedding <#> query_embedding) > match_threshold
    order by d.embedding <#> query_embedding
    limit match_count;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- KEYWORD SEARCH — keyword_search_documents
-- ════════════════════════════════════════════════════════════════════════════
create or replace function keyword_search_documents(
    query_text    text,
    match_count   int default 5,
    filter        jsonb default null
)
returns table (
    id          text,
    score        float,
    metadata    jsonb
)
language sql stable
as $$
    select
        d.id,
        ts_rank(d.fts, websearch_to_tsquery('arabic', query_text)) as score,
        d.metadata
    from documents d
    where 1 = 1
      and (filter is null or d.metadata @> filter)
      and d.fts @@ websearch_to_tsquery('arabic', query_text)
    order by score desc
    limit match_count;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- HYBRID SEARCH — hybrid_search_documents (Reciprocal Rank Fusion)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function hybrid_search_documents(
    query_text         text,
    query_embedding    vector(512),
    match_count        int default 5,
    full_text_weight   float default 1,
    semantic_weight    float default 1,
    rrf_k              int default 50,
    filter             jsonb default null
)
returns table (
    id          text,
    score       float,
    metadata    jsonb
)
language sql stable
as $$
with semantic as (
    select
        d.id,
        row_number() over (order by d.embedding <#> query_embedding) as rank
    from documents d
    where (filter is null or d.metadata @> filter)
      and 1 - (d.embedding <#> query_embedding) > 0
    order by d.embedding <#> query_embedding
    limit 100
),
keyword as (
    select
        d.id,
        row_number() over (order by ts_rank(d.fts, websearch_to_tsquery('arabic', query_text)) desc) as rank
    from documents d
    where (filter is null or d.metadata @> filter)
      and d.fts @@ websearch_to_tsquery('arabic', query_text)
    order by ts_rank(d.fts, websearch_to_tsquery('arabic', query_text)) desc
    limit 100
)
select
    coalesce(s.id, k.id) as id,
    coalesce(
        full_text_weight * (1.0 / (rrf_k + k.rank)), 0
    ) + coalesce(
        semantic_weight * (1.0 / (rrf_k + s.rank)), 0
    ) as score,
    d.metadata
from semantic s
full outer join keyword k on s.id = k.id
join documents d on d.id = coalesce(s.id, k.id)
order by score desc
limit match_count;
$$;
```

### 14.2 Zod schemas (`src/schemas.ts`)

```ts
import { z } from "zod";

// ───────────────────────────────────────────────
// POST /index
// ───────────────────────────────────────────────
export const indexSchema = z.object({
    /** Unique document identifier (e.g. product SKU, article slug). */
    id: z.string().min(1),
    /** The text content to embed and index. */
    content: z.string().min(1),
    /** Arbitrary metadata stored as jsonb and returned verbatim by search. */
    metadata: z.record(z.string(), z.unknown()).default({}),
});

export type IndexRequest = z.infer<typeof indexSchema>;

// ───────────────────────────────────────────────
// POST /search
// ───────────────────────────────────────────────
export const searchSchema = z.object({
    /** Natural-language or keyword query text. */
    query: z.string().min(1),
    /** Number of results to return. */
    top_k: z.number().int().min(1).max(100).default(5),
    /** Search mode: hybrid (default), semantic, or keyword. */
    mode: z.enum(["hybrid", "semantic", "keyword"]).default("hybrid"),
    /** Minimum similarity score (0–1) for semantic results. */
    match_threshold: z.number().min(0).max(1).default(0.3),
    /** Optional jsonb filter applied via `metadata @> filter` in SQL. */
    filters: z.record(z.string(), z.unknown()).optional(),
});

export type SearchRequest = z.infer<typeof searchSchema>;
```
