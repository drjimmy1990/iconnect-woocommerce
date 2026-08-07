/**
 * upsert.ts — the re-embed decision gate for Edge Functions (Deno, shared).
 * Used by the webhook receiver and the delta-sync.
 *
 * 1. build content_for_embedding + metadata
 * 2. compute SHA-256 content_hash
 * 3. compare to stored hash:
 *      same   -> metadata-only update (cheap, NO embedding call)
 *      changed-> embed content, upsert embedding + hash + indexed_at
 */

import { supabase, DOCUMENTS_TABLE } from "./supabase.ts";
import { embedOne, contentHash } from "./embeddings.ts";
import { buildContentForEmbedding, buildMetadata } from "./product.ts";

export async function upsertProduct(p: any) {
  const content = buildContentForEmbedding(p);
  const metadata = buildMetadata(p);
  const newHash = await contentHash(content);
  const id = String(p.id);

  const { data: existing } = await supabase
    .from(DOCUMENTS_TABLE)
    .select("content_hash")
    .eq("id", id)
    .maybeSingle();
  const stored = existing?.content_hash as string | undefined;

  // Cheap path: content unchanged
  if (stored && stored === newHash) {
    const { error } = await supabase
      .from(DOCUMENTS_TABLE)
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { id, action: "updated_metadata", reembedded: false };
  }

  // Expensive path: content changed or new
  const embedding = await embedOne(content);
  const now = new Date().toISOString();
  const action = stored ? "reembedded" : "created";
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
  return { id, action, reembedded: true };
}

export async function deleteProduct(id: string | number) {
  const { error } = await supabase
    .from(DOCUMENTS_TABLE)
    .delete()
    .eq("id", String(id));
  if (error) throw error;
  return { id: String(id), deleted: true };
}
