// src/lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr'

// This function creates a Supabase client that can be used in client components.
// It automatically handles the user's authentication token.
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase URL or Anon Key is missing. Make sure you have a .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// We will also create a singleton instance for easy import in most components.
// For components that need to re-render on auth changes, you might pass the client
// via context or props, but for our current setup, this is sufficient.
export const supabase = createClient();