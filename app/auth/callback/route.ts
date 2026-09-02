import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the `code` param from a Supabase email link (signup
 * confirmation, password recovery) for a session cookie, then redirects
 * onward. This is the standard @supabase/ssr server-side auth-flow
 * pattern — required because email links must be handled by a Route
 * Handler, not a Client Component, to set httpOnly cookies correctly.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
