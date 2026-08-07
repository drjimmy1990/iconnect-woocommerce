/**
 * embeddings.ts — Embedding generation utilities (custom-endpoint compatible).
 *
 * Uses the OpenAI SDK, which is compatible with any OpenAI-style /v1/embeddings
 * endpoint. Point it at the official OpenAI API OR a custom/self-hosted endpoint
 * (Azure OpenAI, a proxy, Ollama, vLLM, etc.) via EMBEDDING_BASE_URL.
 *
 * Env:
 *   EMBEDDING_API_KEY   — bearer key for the embedding endpoint
 *   EMBEDDING_BASE_URL  — optional, e.g. https://api.openai.com/v1  (default)
 *   EMBEDDING_MODEL     — model name, e.g. text-embedding-3-large (default)
 *   EMBEDDING_DIMS      — output dims, must match the SQL vector(N) column
 *
 * OpenAI's embedding API accepts up to 100 inputs per call and has a hard
 * 8191-token limit per input (we rely on the API to reject over-long inputs
 * rather than pre-tokenising).
 *
 * IMPORTANT: use the SAME model + base URL + dims for indexing AND query.
 */

import OpenAI from "openai";

const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY;
const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL; // undefined -> OpenAI default
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-large";
const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMS ?? "512", 10);
const MAX_BATCH = 100; // OpenAI limit per request

// Lazy singleton — only created on first embed() call, so the server can boot
// even before credentials are configured (config errors surface at use time).
let _client: OpenAI | null = null;
function client(): OpenAI {
    if (_client) return _client;
    if (!EMBEDDING_API_KEY) {
        throw new Error(
            "Missing EMBEDDING_API_KEY (or OPENAI_API_KEY). Set it in .env to enable embeddings."
        );
    }
    _client = new OpenAI({
        apiKey: EMBEDDING_API_KEY,
        ...(EMBEDDING_BASE_URL ? { baseURL: EMBEDDING_BASE_URL } : {}),
    });
    return _client;
}

export interface EmbeddingResult {
    embedding: number[];
}

/**
 * Embed an array of texts in batches of `MAX_BATCH`.
 * Returns embeddings in the same order as the input texts.
 */
export async function embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += MAX_BATCH) {
        const chunk = texts.slice(i, i + MAX_BATCH);

        const response = await client().embeddings.create({
            model: EMBEDDING_MODEL,
            dimensions: EMBEDDING_DIMS,
            input: chunk,
        });

        // Sort by index to guarantee order matches input
        const sorted = response.data.sort((a, b) => a.index - b.index);
        for (const item of sorted) {
            allEmbeddings.push(item.embedding);
        }
    }

    return allEmbeddings;
}

/**
 * Convenience wrapper to embed a single text string.
 */
export async function embedOne(text: string): Promise<number[]> {
    const [embedding] = await embed([text]);
    return embedding;
}

// Export config for logging / debugging
export const embeddingConfig = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMS,
};
