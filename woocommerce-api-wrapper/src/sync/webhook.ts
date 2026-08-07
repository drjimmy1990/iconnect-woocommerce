/**
 * sync/webhook.ts
 * ---------------
 * WooCommerce webhook handler. Receives product lifecycle events from WC
 * and pushes/deletes products in the semantic backend.
 *
 * WooCommerce signs webhook payloads with HMAC-SHA256 using the shared
 * secret (WC_WEBHOOK_SECRET). The signature is in the
 * `X-Wc-Webhook-Signature` header (lowercase in Express).
 *
 * The webhook topic is in `X-Wc-Webhook-Topic`:
 *   product.created, product.updated, product.deleted, product.restored
 *
 * How to register this webhook in WooCommerce:
 *   POST /wc/v3/webhooks with body:
 *   {
 *     "name": "Semantic Sync",
 *     "topic": "product.created",     // register one per topic, or use "product.*"
 *     "delivery_url": "https://your-wrapper-host:8081/webhook/wc",
 *     "secret": "your WC_WEBHOOK_SECRET"
 *   }
 *
 * Alternatively, create separate webhooks for each topic
 * (product.updated, product.deleted, product.restored).
 */

import crypto from "node:crypto";
import type { Request, Response } from "express";
import { upsertProductToSemantic, deleteProductFromSemantic } from "./upsert.js";

const WC_WEBHOOK_SECRET = process.env.WC_WEBHOOK_SECRET || "";

/**
 * Verify the HMAC-SHA256 signature of the raw webhook body.
 * WooCommerce sends the signature as a hex string in X-Wc-Webhook-Signature.
 */
function verifySignature(rawBody: string, signature: string): boolean {
  if (!WC_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", WC_WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("hex");
  // Timing-safe comparison
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Express handler for POST /webhook/wc.
 *
 * IMPORTANT: This must be mounted BEFORE express.json() body parsing,
 * or you must capture the raw body. We use express.raw or configure
 * express.json({ verify }) in index.ts to get the raw body.
 *
 * Here we assume `req.rawBody` (a Buffer) has been populated by the
 * raw-body capture middleware in index.ts, and `req.body` is the
 * parsed JSON.
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const signature = req.headers["x-wc-webhook-signature"] as string;
    const topic = req.headers["x-wc-webhook-topic"] as string;
    const rawBody = req.body; // parsed JSON (see index.ts verify hook)

    // Verify signature
    if (signature && WC_WEBHOOK_SECRET) {
      const rawStr =
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body);
      if (!verifySignature(rawStr, signature)) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    }

    // Route by topic
    const product = rawBody;
    let result: any = { topic, ok: true };

    switch (topic) {
      case "product.created":
      case "product.updated":
      case "product.restored":
        result = await upsertProductToSemantic(product);
        break;
      case "product.deleted":
        result = await deleteProductFromSemantic(product.id);
        break;
      default:
        // Unknown topic — acknowledge to avoid WC retries
        result = { topic, ok: true, ignored: true };
        break;
    }

    // Return 200 fast (WC retries on non-2xx)
    res.status(200).json(result);
  } catch (err: any) {
    // Still return 200 to prevent WC retry storms — log the error
    console.error("[webhook] error:", err.message);
    res.status(200).json({ error: err.message, ok: false });
  }
}

export default handleWebhook;
