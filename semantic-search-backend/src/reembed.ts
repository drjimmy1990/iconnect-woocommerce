/**
 * reembed.ts — Content hash and re-embed decision logic.
 *
 * The core optimisation: if the content of a document hasn't changed since
 * the last embedding was generated, we skip the (expensive) OpenAI embedding
 * call entirely and only update the metadata.  This saves API cost and
 * latency for the common case where a product's text is stable but its
 * price / stock / metadata changes frequently.
 *
 * The hash is SHA-256 of the content string — cheap to compute and sufficient
 * for change detection (not used for security). SHA-256 is chosen so the same
 * algorithm is available via Web Crypto in both Node (this backend) and Deno
 * (the Supabase Edge Function version), keeping hashes consistent if you
 * switch deployment shapes.
 */

import { createHash } from "node:crypto";

/**
 * Compute the SHA-256 hash of a content string.
 * @param content — The raw text content to hash.
 * @returns 64-char lowercase hex SHA-256 digest.
 */
export function computeContentHash(content: string): string {
    return createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Decide whether a document needs to be re-embedded.
 *
 * @param storedHash — The content_hash currently in the database (or null/undefined if new).
 * @param newHash    — The content_hash of the incoming content.
 * @returns true if the embedding must be regenerated (content changed or document is new).
 */
export function shouldReembed(
    storedHash: string | null | undefined,
    newHash: string
): boolean {
    if (!storedHash) return true;       // new document
    return storedHash !== newHash;       // content changed
}
