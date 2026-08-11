/**
 * schemas.ts — Zod validation schemas for all request bodies.
 *
 * Every incoming request is validated against these schemas before the
 * handler logic runs, guaranteeing that downstream code can safely assume
 * the shape of the input.
 */

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
    /**
     * Optional projection: return only these metadata keys on each hit.
     * Omitted -> the whole metadata object, as before.
     *
     * Indexed metadata can be large (image URLs, permalinks, category arrays).
     * Feeding all of it to an LLM for every hit is wasted context when the
     * caller only needs a couple of fields to present a shortlist. Stays
     * domain-agnostic: the caller names the keys, the service knows nothing
     * about them.
     *
     * Accepts either a real array or a comma-separated string. n8n's HTTP
     * "Body Parameters" field mode can only send strings, so an array
     * expression arrives as "name,price,stock_status\n" — parse that too
     * rather than making every caller switch to raw-JSON body mode.
     */
    fields: z
        .union([z.array(z.string()), z.string()])
        .optional()
        .transform((value) => {
            if (value === undefined) return undefined;
            const parts = Array.isArray(value) ? value : value.split(",");
            const cleaned = parts.map((p) => String(p).trim()).filter(Boolean);
            return cleaned.length ? cleaned.slice(0, 50) : undefined;
        }),
});

export type SearchRequest = z.infer<typeof searchSchema>;
