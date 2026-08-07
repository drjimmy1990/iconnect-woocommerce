/**
 * supabase.ts — shared Supabase client for Edge Functions (Deno).
 * Uses the service-role key for server-side RPC + table access. Bypasses RLS.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const DOCUMENTS_TABLE = Deno.env.get("DOCUMENTS_TABLE") ?? "documents";
export const SYNC_TABLE = Deno.env.get("SYNC_TABLE") ?? "wc_sync_state";
