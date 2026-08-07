/**
 * semantic-search — Supabase Edge Function (Deno).
 * The QUERY PATH: embed the user's natural-language query, call the Postgres
 * hybrid_search_documents / match_documents / keyword_search_documents RPC,
 * return ranked results with metadata. This is what the n8n agent / chatbot calls.
 *
 * Endpoint: POST https://<project>.functions.supabase.co/semantic-search
 * Body: { query, top_k?, mode?, match_threshold?, filters? }
 */

import { supabase } from "../_shared/supabase.ts";
import { embedOne, embeddingConfig } from "../_shared/embeddings.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const query = String(body?.query ?? "").trim();
  const top_k = Math.min(Number(body?.top_k ?? 5) || 5, 200);
  const mode = String(body?.mode ?? "hybrid") as "hybrid" | "semantic" | "keyword";
  const match_threshold = Number(body?.match_threshold ?? 0.3);
  const filters = body?.filters ?? null;

  if (!query) return json({ error: "query is required" }, 400);

  try {
    let rows: any[] = [];

    if (mode === "keyword") {
      const { data, error } = await supabase.rpc("keyword_search_documents", {
        query_text: query,
        match_count: top_k,
        filter: filters,
      });
      if (error) throw error;
      rows = data ?? [];
    } else if (mode === "semantic") {
      const qe = await embedOne(query);
      const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: qe,
        match_threshold,
        match_count: top_k,
        filter: filters,
      });
      if (error) throw error;
      rows = data ?? [];
    } else {
      const qe = await embedOne(query);
      const { data, error } = await supabase.rpc("hybrid_search_documents", {
        query_text: query,
        query_embedding: qe,
        match_count: top_k,
        match_threshold,
        filter: filters,
      });
      if (error) throw error;
      rows = data ?? [];
    }

    const results = rows.map((r: any) => ({
      id: r.id,
      score: r.score,
      metadata: r.metadata,
    }));
    return json({ results });
  } catch (e) {
    return json({ error: "search failed", message: String(e) }, 500);
  }
});
