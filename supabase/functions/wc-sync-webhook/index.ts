/**
 * wc-sync-webhook — Supabase Edge Function (Deno).
 * Receives WooCommerce product webhooks (product.created/updated/deleted/restored),
 * HMAC-verifies the payload, then upserts or deletes the product in the documents
 * table (with the re-embed decision gate).
 *
 * Endpoint: POST https://<project>.functions.supabase.co/wc-sync-webhook
 * Register in WooCommerce via POST /wc/v3/webhooks with:
 *   topic: product.created | product.updated | product.deleted | product.restored
 *   delivery_url: https://<project>.functions.supabase.co/wc-sync-webhook
 *   secret: same value as the WC_WEBHOOK_SECRET Supabase secret
 *
 * WooCommerce delivers from its own server -> this function. That path does NOT
 * traverse the store's Cloudflare, so webhooks are reliable regardless of CF.
 */

import { upsertProduct, deleteProduct } from "../_shared/upsert.ts";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const raw = await req.text();
  const secret = Deno.env.get("WC_WEBHOOK_SECRET");

  // HMAC-SHA256 verification (WooCommerce sends X-WC-Webhook-Signature)
  if (secret) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(raw)
    );
    const expected = hex(sig);
    const provided = req.headers.get("x-wc-webhook-signature") ?? "";
    if (provided !== expected) {
      return new Response("invalid webhook signature", { status: 401 });
    }
  }

  const topic = req.headers.get("x-wc-webhook-topic") ?? "";
  let product: any = null;
  try {
    product = JSON.parse(raw);
  } catch {
    product = null;
  }
  const id = product?.id;

  try {
    if (topic.includes("delete")) {
      if (id) await deleteProduct(id);
      return json({ id, deleted: true });
    }
    if (
      topic.includes("created") ||
      topic.includes("updated") ||
      topic.includes("restored")
    ) {
      if (id) return json(await upsertProduct(product));
    }
    return json({ ignored: true, topic });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
