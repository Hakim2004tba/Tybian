import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for use in Server Components, Server
 * Actions, and Route Handlers. Still uses the anon key — RLS is what
 * actually enforces access, this client just carries the user's session.
 *
 * Never import the service_role client (lib/supabase/admin.ts) from
 * anywhere reachable by client code; it bypasses RLS entirely and must
 * stay server-only (webhooks, admin-privileged operations).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (no request/response to write
            // to) — safe to ignore because middleware refreshes the
            // session on every navigation anyway.
          }
        },
      },
    }
  );
}
