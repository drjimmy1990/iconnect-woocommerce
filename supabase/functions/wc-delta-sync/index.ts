/**
 * wc-delta-sync — Supabase Edge Function (Deno).
 * Scheduled fallback sync: fetch products modified since the last run and
 * upsert them into the documents table (with the re-embed decision gate).
 *
 * Endpoint: POST https://<project>.functions.supabase.co/wc-delta-sync
 *   (call manually or wire to a Supabase scheduled function / pg_cron)
 *
 * To schedule every 5 minutes, uncomment the cron line in supabase/config.toml
 * OR use Supabase dashboard -> Database -> pg_cron / scheduled functions.
 *
 * This fetch DOES traverse Cloudflare -> uses the browser UA + retry-until-JSON
 * (in _shared/wc.ts). For full reliability, apply the WAF bypass rule for
 * /store/wp-json/wc/v3/*.
 */

import { supabase, SYNC_TABLE } from "../_shared/supabase.ts";
import { wcGetAll } from "../_shared/wc.ts";
import { upsertProduct } from "../_shared/upsert.ts";

async function getLastModified(): Promise<string | null> {
  const { data } = await supabase
    .from(SYNC_TABLE)
    .select("last_modified")
    .eq("id", 1)
    .maybeSingle();
  return data?.last_modified ?? null;
}

async function setLastModified(v: string): Promise<void> {
  await supabase.from(SYNC_TABLE).upsert({ id: 1, last_modified: v });
}

export async function runDeltaSync() {
  const since = await getLastModified();
  const params: Record<string, unknown> = { status: "publish" };
  if (since) params.modified_after = since;

  const { items } = await wcGetAll("products", params, 1000);
  let maxMod = since;
  for (const p of items) {
    try {
      await upsertProduct(p);
    } catch (e) {
      console.error(`upsert failed for ${p.id}: ${String(e)}`);
    }
    if (
      p.date_modified &&
      (!maxMod || p.date_modified > maxMod)
    ) {
      maxMod = p.date_modified;
    }
  }
  if (maxMod && maxMod !== since) await setLastModified(maxMod);
  return { processed: items.length, last_modified: maxMod };
}

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async () => {
  try {
    const r = await runDeltaSync();
    return json(r);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
