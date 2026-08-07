/**
 * db.ts — Supabase client singleton.
 *
 * The semantic-search backend talks to Postgres exclusively through Supabase
 * RPC (stored functions) and the REST data API.  We use the service-role key
 * because this is a server-side microservice that needs unrestricted access
 * to the `documents` table and the custom RPC functions.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
        "Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    );
}

export const supabase: SupabaseClient = createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
        auth: { persistSession: false, autoRefreshToken: false },
    }
);

/** Table name — configurable via env, defaults to "documents". */
export const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE ?? "documents";
