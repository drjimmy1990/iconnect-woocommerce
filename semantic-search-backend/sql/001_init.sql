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
-- Uses inner-product distance (<#>) because OpenAI embeddings are normalised
-- (inner product ≈ cosine similarity for unit vectors).
-- `filter` is a jsonb object pushed via `metadata @> filter` for exact-match
-- sub-selection (e.g. {"category_ids": [12]} ).
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
        1 - (d.embedding <#> query_embedding) as score,   -- inner product → similarity
        d.metadata
    from documents d
    where 1 = 1
      and (filter is null or d.metadata @> filter)
      and 1 - (d.embedding <#> query_embedding) > match_threshold
    order by d.embedding <#> query_embedding   -- ascending distance = nearest first
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
-- Fuses two ranked lists (semantic + keyword) via Reciprocal Rank Fusion.
-- rrf_k is a constant that dampens the influence of high ranks (typical 60).
-- full_text_weight and semantic_weight scale each side's contribution.
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
      and 1 - (d.embedding <#> query_embedding) > 0  -- only rows with an embedding
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
    -- RRF score: sum of weighted reciprocal ranks
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
