/**
 * index.ts — Express application entry point.
 *
 * This is the GENERIC semantic-search microservice.  It has no knowledge of
 * WooCommerce, products, or any domain — it only knows about documents with
 * an id, content, and metadata.  Any backend can integrate by POSTing to
 * /index and querying /search.
 *
 * ── Re-embed decision gate ──────────────────────────────────────────────────
 * On POST /index we compute md5(content) and compare to the stored content_hash.
 *   • If unchanged  → update metadata only (cheap, NO OpenAI call).
 *   • If changed/new → embed content, upsert embedding + content_hash + indexed_at.
 *
 * ── Search modes ─────────────────────────────────────────────────────────────
 *   • semantic → match_documents (pgvector inner-product)
 *   • keyword  → keyword_search_documents (Postgres FTS)
 *   • hybrid   → hybrid_search_documents (RRF fusion of both)
 */

import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { supabase, DOCUMENTS_TABLE } from "./db.js";
import { embedOne, embeddingConfig } from "./embeddings.js";
import { computeContentHash, shouldReembed } from "./reembed.js";
import { indexSchema, searchSchema } from "./schemas.js";

// ─────────────────────────────────────────────
// App setup
// ─────────────────────────────────────────────
const app = express();
const PORT = parseInt(process.env.PORT ?? "8080", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: CORS_ORIGIN }));

// ─────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
});

// ─────────────────────────────────────────────
// POST /index  — index or re-index a document
// ─────────────────────────────────────────────
app.post("/index", async (req: Request, res: Response) => {
    const parsed = indexSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: "Validation failed",
            details: parsed.error.issues,
        });
    }

    const { id, content, metadata } = parsed.data;
    const newHash = computeContentHash(content);

    try {
        // Check if a document with this id already exists and what its content_hash is
        const { data: existing } = await supabase
            .from(DOCUMENTS_TABLE)
            .select("content_hash")
            .eq("id", id)
            .maybeSingle();

        const storedHash = existing?.content_hash as string | undefined;

        // ── Re-embed decision gate ──────────────────────────────────────────
        if (!shouldReembed(storedHash, newHash)) {
            // Content unchanged — only update metadata + updated_at (cheap path)
            const { error } = await supabase
                .from(DOCUMENTS_TABLE)
                .update({ metadata, updated_at: new Date().toISOString() })
                .eq("id", id);

            if (error) throw error;

            return res.json({
                id,
                action: "updated_metadata",
                reembedded: false,
            });
        }

        // Content changed or new — generate embedding (expensive path)
        const embedding = await embedOne(content);
        const now = new Date().toISOString();

        // Determine action label for the response
        const action = storedHash ? "reembedded" : "created";

        const { error } = await supabase
            .from(DOCUMENTS_TABLE)
            .upsert({
                id,
                content,
                content_hash: newHash,
                metadata,
                embedding,
                indexed_at: now,
                updated_at: now,
            });

        if (error) throw error;

        return res.json({ id, action, reembedded: true });
    } catch (err) {
        console.error("[POST /index] Error:", err);
        return res.status(500).json({
            error: "Indexing failed",
            message: err instanceof Error ? err.message : "Unknown error",
        });
    }
});

// ─────────────────────────────────────────────
// POST /search — hybrid / semantic / keyword search
// ─────────────────────────────────────────────
app.post("/search", async (req: Request, res: Response) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: "Validation failed",
            details: parsed.error.issues,
        });
    }

    const { query, top_k, mode, match_threshold, filters } = parsed.data;

    try {
        let rows: { id: string; score: number; metadata: Record<string, unknown> }[] = [];

        if (mode === "keyword") {
            // ── Keyword-only (FTS) ───────────────────────────────────────────
            const { data, error } = await supabase.rpc("keyword_search_documents", {
                query_text: query,
                match_count: top_k,
                filter: filters ?? null,
            });

            if (error) throw error;
            rows = (data ?? []) as typeof rows;
        } else if (mode === "semantic") {
            // ── Semantic-only (pgvector) ─────────────────────────────────────
            const queryEmbedding = await embedOne(query);

            const { data, error } = await supabase.rpc("match_documents", {
                query_embedding: queryEmbedding,
                match_threshold,
                match_count: top_k,
                filter: filters ?? null,
            });

            if (error) throw error;
            rows = (data ?? []) as typeof rows;
        } else {
            // ── Hybrid (RRF fusion) ──────────────────────────────────────────
            const queryEmbedding = await embedOne(query);

            const { data, error } = await supabase.rpc("hybrid_search_documents", {
                query_text: query,
                query_embedding: queryEmbedding,
                match_count: top_k,
                filter: filters ?? null,
            });

            if (error) throw error;
            rows = (data ?? []) as typeof rows;
        }

        // Map rows to the standard response shape
        const results = rows.map((row) => ({
            id: row.id,
            score: row.score,
            metadata: row.metadata,
        }));

        return res.json({ results });
    } catch (err) {
        console.error("[POST /search] Error:", err);
        return res.status(500).json({
            error: "Search failed",
            message: err instanceof Error ? err.message : "Unknown error",
        });
    }
});

// ─────────────────────────────────────────────
// DELETE /:id — remove a document
// ─────────────────────────────────────────────
app.delete("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const { error, count } = await supabase
            .from(DOCUMENTS_TABLE)
            .delete({ count: "exact" })
            .eq("id", id);

        if (error) throw error;

        const deleted = (count ?? 0) > 0;
        return res.json({ id, deleted });
    } catch (err) {
        console.error("[DELETE /:id] Error:", err);
        return res.status(500).json({
            error: "Deletion failed",
            message: err instanceof Error ? err.message : "Unknown error",
        });
    }
});

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Semantic Search Backend listening on :${PORT}`);
    console.log(`  Embedding model: ${embeddingConfig.model} (${embeddingConfig.dimensions}d)`);
    console.log(`  Table: ${DOCUMENTS_TABLE}`);
    console.log(`  CORS origin: ${CORS_ORIGIN}`);
});

export default app;
