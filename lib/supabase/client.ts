import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase client (uses the anon key; every query is still
 * subject to RLS — see supabase/migrations/0009_rls_policies.sql).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
