/**
 * embeddings.ts — OpenAI-compatible embedding helper for Supabase Edge Functions (Deno).
 *
 * Works with the official OpenAI API OR any custom / self-hosted endpoint that
 * speaks the OpenAI /v1/embeddings contract (proxy, Azure OpenAI, vLLM, Ollama
 * with the openai shim, etc.). Point EMBEDDING_BASE_URL at your custom endpoint.
 *
 * Env (set as Supabase secrets):
 *   EMBEDDING_API_KEY  — bearer key for the embedding endpoint
 *   EMBEDDING_BASE_URL — optional; default https://api.openai.com/v1
 *   EMBEDDING_MODEL    — model name (default text-embedding-3-large)
 *   EMBEDDING_DIMS     — output dims; MUST match the SQL vector(N) column
 *
 * Rule: the SAME model + base URL + dims must be used for indexing AND queries.
 */

const EMBEDDING_API_KEY =
  Deno.env.get("EMBEDDING_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
const EMBEDDING_BASE_URL = (Deno.env.get("EMBEDDING_BASE_URL") ??
  "https://api.openai.com/v1").replace(/\/+$/, "");
const EMBEDDING_MODEL = Deno.env.get("EMBEDDING_MODEL") ?? "text-embedding-3-large";
const EMBEDDING_DIMS = parseInt(Deno.env.get("EMBEDDING_DIMS") ?? "512", 10);
const MAX_BATCH = 100;

export const embeddingConfig = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMS,
  baseUrl: EMBEDDING_BASE_URL,
};

export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  if (!EMBEDDING_API_KEY) {
    throw new Error("Missing EMBEDDING_API_KEY (or OPENAI_API_KEY) secret.");
  }
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const chunk = texts.slice(i, i + MAX_BATCH);
    const res = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EMBEDDING_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMS,
        input: chunk,
      }),
    });
    if (!res.ok) {
      throw new Error(`Embedding API ${res.status}: ${await res.text()}`);
    }
    const json: { data: { embedding: number[]; index: number }[] } = await res.json();
    const sorted = json.data.sort((a, b) => a.index - b.index);
    for (const item of sorted) out.push(item.embedding);
  }
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  const [e] = await embed([text]);
  return e;
}

/** SHA-256 hex of content — matches the Node backend so hashes stay consistent
 *  if you switch between the Express and Edge-Function deployments. */
export async function contentHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
