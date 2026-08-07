/**
 * index.ts
 * --------
 * Express app entry point for the WooCommerce API Wrapper.
 *
 * - CORS enabled (for n8n / browser clients).
 * - Global rate limiting.
 * - Raw body capture for webhook signature verification.
 * - Mounts trimmed WC routes under /api.
 * - Mounts webhook at POST /webhook/wc.
 * - Mounts admin sync routes under /sync.
 * - Starts delta-sync interval if SYNC_ENABLED=true.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { json } from "express";
import routes from "./routes/index.js";
import handleWebhook from "./sync/webhook.js";
import { startDeltaSync, stopDeltaSync, runDeltaSync, bulkLoadAll } from "./sync/delta-sync.js";

const app = express();
const PORT = Number(process.env.PORT) || 8081;
const SYNC_ENABLED = process.env.SYNC_ENABLED === "true";
const SYNC_INTERVAL_MIN = Number(process.env.SYNC_INTERVAL_MIN) || 5;

/* ------------------------------------------------------------------ */
/* Middleware                                                        */
/* ------------------------------------------------------------------ */

// CORS — allow n8n and other clients
app.use(cors());

// Rate limiting — protect the WC backend
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Raw body capture for webhook signature verification
// We capture the raw body in a buffer for HMAC verification, then
// parse as JSON. Express.json() runs on non-webhook routes.
app.use(
  "/webhook/wc",
  express.json({
    verify: (req, _res, buf) => {
      // Attach raw body for signature verification
      (req as any).rawBody = buf.toString("utf8");
    },
  }),
  ((req: Request, _res: Response, next: NextFunction) => {
    // express.json already parsed body; rawBody has the string
    next();
  }) as express.RequestHandler,
);

// For all other routes, parse JSON normally
app.use(json());

/* ------------------------------------------------------------------ */
/* Routes                                                            */
/* ------------------------------------------------------------------ */

// Trimmed WC API routes
app.use("/api", limiter, routes);

// Webhook receiver
app.post("/webhook/wc", handleWebhook);

// Admin sync routes
app.post(
  "/sync/bulk",
  limiter,
  async (_req: Request, res: Response) => {
    try {
      const result = await bulkLoadAll();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/sync/delta",
  limiter,
  async (_req: Request, res: Response) => {
    try {
      const result = await runDeltaSync();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Health check at root
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "woocommerce-api-wrapper" });
});

/* ------------------------------------------------------------------ */
/* Start                                                              */
/* ------------------------------------------------------------------ */

app.listen(PORT, () => {
  console.log(`woocommerce-api-wrapper listening on :${PORT}`);
  console.log(`  WC URL: ${process.env.WC_URL}`);
  console.log(`  Semantic backend: ${process.env.SEMANTIC_BACKEND_URL}`);

  if (SYNC_ENABLED) {
    startDeltaSync(SYNC_INTERVAL_MIN);
    // Run an initial delta-sync shortly after start
    setTimeout(() => {
      runDeltaSync().catch((err) =>
        console.error("[startup] delta-sync error:", err.message),
      );
    }, 5000);
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  stopDeltaSync();
  process.exit(0);
});
process.on("SIGINT", () => {
  stopDeltaSync();
  process.exit(0);
});
