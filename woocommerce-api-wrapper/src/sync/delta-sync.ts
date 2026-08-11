/**
 * sync/delta-sync.ts
 * ------------------
 * Periodic delta-sync: reads products modified since the last sync from
 * WooCommerce, upserts them into the semantic backend, and persists the
 * new high-water mark (date_modified) to data/sync-state.json.
 *
 * Also provides a bulk-load function that re-indexes ALL products.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getProducts } from "../wc-client.js";
import { upsertProductToSemantic } from "./upsert.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const STATE_FILE = path.join(DATA_DIR, "sync-state.json");

/* ------------------------------------------------------------------ */
/* State file helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * In-memory fallback for the high-water mark.
 *
 * If the state file is unwritable (bad volume, wrong ownership), losing the
 * mark entirely means every pass re-reads the whole catalogue from 1970 —
 * a full crawl every 5 minutes against the store. Keeping it in memory limits
 * the damage to one crawl per container lifetime.
 */
let inMemoryState: { last_modified: string } | null = null;

/** @returns true when DATA_DIR is usable. Never throws. */
function ensureDataDir(): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    return true;
  } catch (err: any) {
    console.warn(
      `[delta-sync] state dir unavailable (${err.message}) — ` +
        `keeping the sync mark in memory only; it resets on restart`,
    );
    return false;
  }
}

function readSyncState(): { last_modified: string } {
  if (ensureDataDir()) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    } catch {
      /* no state file yet — fall through */
    }
  }
  return inMemoryState ?? { last_modified: "1970-01-01T00:00:00" };
}

function writeSyncState(state: { last_modified: string }) {
  inMemoryState = state;
  if (!ensureDataDir()) return;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err: any) {
    console.warn(`[delta-sync] could not persist sync state: ${err.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Delta sync                                                         */
/* ------------------------------------------------------------------ */

/**
 * Run a single delta-sync pass:
 * 1. Read last_modified from data/sync-state.json
 * 2. Fetch all WC products modified after that timestamp
 * 3. Upsert each into the semantic backend
 * 4. Update last_modified to the max date_modified seen
 */
export async function runDeltaSync(): Promise<{
  processed: number;
  last_modified: string;
  errors: number;
}> {
  const state = readSyncState();
  console.log(`[delta-sync] starting from ${state.last_modified}`);

  // Paginate all modified products
  const { data: products, headers } = await getProducts(
    {
      modified_after: state.last_modified,
      per_page: 100,
    },
    true, // paginate all pages
  );

  console.log(`[delta-sync] ${products.length} products to upsert`);

  let maxModified = state.last_modified;
  let errors = 0;

  for (const product of products) {
    try {
      await upsertProductToSemantic(product);
      if (product.date_modified && product.date_modified > maxModified) {
        maxModified = product.date_modified;
      }
    } catch (err: any) {
      console.error(
        `[delta-sync] error upserting product ${product.id}:`,
        err.message,
      );
      errors++;
    }
  }

  writeSyncState({ last_modified: maxModified });
  console.log(`[delta-sync] done. ${products.length} processed, ${errors} errors, last_modified=${maxModified}`);

  return { processed: products.length, last_modified: maxModified, errors };
}

/**
 * Bulk-load ALL products into the semantic backend (full re-index).
 * Triggered via POST /sync/bulk admin route.
 */
export async function bulkLoadAll(): Promise<{
  processed: number;
  errors: number;
}> {
  console.log("[bulk-load] starting full re-index");

  const { data: products } = await getProducts(
    { per_page: 100 },
    true, // paginate all
  );

  console.log(`[bulk-load] ${products.length} products to upsert`);

  let errors = 0;
  let maxModified = "1970-01-01T00:00:00";

  for (const product of products) {
    try {
      await upsertProductToSemantic(product);
      if (product.date_modified && product.date_modified > maxModified) {
        maxModified = product.date_modified;
      }
    } catch (err: any) {
      console.error(
        `[bulk-load] error upserting product ${product.id}:`,
        err.message,
      );
      errors++;
    }
  }

  writeSyncState({ last_modified: maxModified });
  console.log(`[bulk-load] done. ${products.length} processed, ${errors} errors`);

  return { processed: products.length, errors };
}

/* ------------------------------------------------------------------ */
/* Interval management                                                */
/* ------------------------------------------------------------------ */

let syncInterval: NodeJS.Timeout | null = null;

/**
 * Start the periodic delta-sync on the configured interval.
 * Called from index.ts if SYNC_ENABLED=true.
 */
export function startDeltaSync(intervalMin: number) {
  if (syncInterval) clearInterval(syncInterval);
  const ms = intervalMin * 60 * 1000;
  syncInterval = setInterval(async () => {
    try {
      await runDeltaSync();
    } catch (err: any) {
      console.error("[delta-sync] unhandled error:", err.message);
    }
  }, ms);
  console.log(`[delta-sync] scheduled every ${intervalMin} minutes`);
}

/** Stop the periodic sync (for graceful shutdown). */
export function stopDeltaSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("[delta-sync] stopped");
  }
}
