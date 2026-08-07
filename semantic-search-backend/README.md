# Semantic Search Backend

A **generic vector search microservice** built with Express, pgvector, and OpenAI embeddings. It is reusable for **any** project — products, knowledge bases, articles, documentation — and knows nothing about any specific domain. It owns:

- **Embedding generation** via the OpenAI SDK (configurable model + dimensions).
- **pgvector storage** in a Supabase Postgres `documents` table.
- **Content-hash re-embed decision gate** — if a document's content hasn't changed, the expensive embedding API call is skipped and only metadata is updated.
- **Hybrid search** combining keyword (Postgres full-text) and semantic (pgvector) results via Reciprocal Rank Fusion (RRF).

---

## How It Works

### Indexing (`POST /index`)

1. Compute `md5(content)` → `content_hash`.
2. Query the stored `content_hash` for the given `id`.
3. **If hashes match** → content is unchanged → update `metadata` + `updated_at` only. No OpenAI call (cheap path).
4. **If hashes differ or document is new** → call OpenAI `embeddings.create`, upsert the embedding + `content_hash` + `indexed_at` + `updated_at` (expensive path).

This means frequent metadata-only updates (price, stock, category) cost **zero** embedding API calls.

### Search (`POST /search`)

| Mode | Function (RPC) | Description |
|------|----------------|-------------|
| `semantic` | `match_documents` | Pure vector similarity (inner product, OpenAI embeddings are normalised). |
| `keyword` | `keyword_search_documents` | Pure full-text search using Postgres `tsvector` with the configured FTS language. |
| `hybrid` (default) | `hybrid_search_documents` | RRF fusion of both ranked lists — best for recall + precision. |

All modes accept an optional `filters` object that is pushed into SQL via `metadata @> filter` (jsonb containment).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | — | Supabase project URL (required). |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase service-role key (required, server-side only). |
| `OPENAI_API_KEY` | — | OpenAI API key for embeddings (required). |
| `EMBEDDING_MODEL` | `text-embedding-3-large` | OpenAI embedding model name. |
| `EMBEDDING_DIMS` | `512` | Embedding vector dimension (must match SQL migration). |
| `FTS_CONFIG` | `arabic` | Full-text search config (reference only — the SQL column is hardcoded). |
| `DOCUMENTS_TABLE` | `documents` | Postgres table name (must match SQL migration). |
| `PORT` | `8080` | HTTP listen port. |
| `CORS_ORIGIN` | `*` | CORS allowed origin(s). |

---

## API Endpoints

### `GET /health`
Returns `{ status: "ok" }`.

### `POST /index`
Index or re-index a document.

**Request body:**
```json
{
  "id": "product-123",
  "content": "Apple iPhone 15 Pro Max 256GB Natural Titanium",
  "metadata": {
    "name": "iPhone 15 Pro Max",
    "price": 5199,
    "currency": "SAR"
  }
}
```

**Response (200):**
```json
{
  "id": "product-123",
  "action": "created",          // "created" | "reembedded" | "updated_metadata"
  "reembedded": true             // false only when action is "updated_metadata"
}
```

### `POST /search`
Search indexed documents.

**Request body:**
```json
{
  "query": "iphone pro",
  "top_k": 5,
  "mode": "hybrid",
  "match_threshold": 0.3,
  "filters": { "currency": "SAR" }
}
```

**Response (200):**
```json
{
  "results": [
    { "id": "product-123", "score": 0.92, "metadata": { ... } }
  ]
}
```

### `DELETE /:id`
Remove a document by id.

**Response (200):**
```json
{ "id": "product-123", "deleted": true }
```

---

## Setup

### 1. Install dependencies
```bash
cd semantic-search-backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your Supabase + OpenAI credentials
```

### 3. Run the SQL migration
Open `sql/001_init.sql` in the **Supabase SQL Editor** and run it. This creates:
- The `documents` table with pgvector + FTS columns
- GIN and HNSW indexes
- The `match_documents`, `keyword_search_documents`, and `hybrid_search_documents` RPC functions

> **Important:** The FTS config (`arabic`) and vector dimension (`512`) are baked into the SQL. To use a different language or dimension, edit `sql/001_init.sql` and re-run it.

### 4. Run the server
```bash
npm run dev    # development (tsx watch)
# or
npm run build && npm start   # production
```

---

## Reusing for Other Projects

This backend is domain-agnostic. To adapt it:

1. **Different language:** Change `'arabic'` to `'simple'` or your target FTS config throughout `sql/001_init.sql` and re-run.
2. **Different embedding dimension:** Change `vector(512)` in the table + function signatures, update `EMBEDDING_DIMS` in `.env`.
3. **Different table name:** Change the `create table` name in SQL and set `DOCUMENTS_TABLE` in `.env`.
4. **Different embedding model:** Set `EMBEDDING_MODEL` in `.env` (e.g. `text-embedding-3-small` with `EMBEDDING_DIMS=1536`).

The metadata jsonb is completely free-form — store whatever your domain needs.
