/**
 * sync/upsert.ts
 * --------------
 * Pushes (and deletes) product data into the generic semantic backend (A)
 * via the HTTP contract:
 *
 *   POST   /index     { id, content, metadata }  -> 200 { id, action, reembedded }
 *   DELETE /:id                                -> 200 { id, deleted }
 *
 * SEMANTIC_BACKEND_URL is read from env.
 */

import axios from "axios";
import { buildContentForEmbedding, buildMetadata } from "./compose.js";
import { getProducts } from "../wc-client.js";

const SEMANTIC_BACKEND_URL =
  process.env.SEMANTIC_BACKEND_URL || "http://localhost:8080";

/**
 * Upsert a single product into the semantic backend.
 * Sends content + metadata; backend A decides whether to re-embed
 * based on md5(content) change.
 */
export async function upsertProductToSemantic(product: any): Promise<{
  id: string;
  action: string;
  reembedded: boolean;
}> {
  const payload = {
    id: String(product.id),
    content: buildContentForEmbedding(product),
    metadata: buildMetadata(product),
  };

  const res = await axios.post(
    `${SEMANTIC_BACKEND_URL}/index`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    },
  );
  return res.data;
}

/**
 * Delete a product from the semantic backend.
 */
export async function deleteProductFromSemantic(
  id: number | string,
): Promise<{ id: string; deleted: boolean }> {
  const res = await axios.delete(
    `${SEMANTIC_BACKEND_URL}/${id}`,
    { timeout: 15000 },
  );
  return res.data;
}

/**
 * Fetch products modified after a given timestamp from WooCommerce.
 * Used by delta-sync to identify products needing re-indexing.
 */
export async function listProductsModifiedAfter(
  modifiedAfter: string,
): Promise<any[]> {
  const result = await getProducts(
    { modified_after: modifiedAfter, per_page: 100 },
    true, // paginate
  );
  return result.data;
}
