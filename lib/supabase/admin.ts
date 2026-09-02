import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role client — bypasses RLS entirely. Use ONLY for:
 *  - payment/Bunny webhook handlers (Route Handlers)
 *  - admin-privileged operations that must act across all users' rows
 *
 * The `import "server-only"` guard makes any accidental client-side
 * import fail the build rather than silently leaking the service key.
 * Never pass this client (or the key) to a Client Component.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
