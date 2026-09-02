import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { canAccessPath, getRedirectFor, type AppRole } from "@/lib/auth/route-access";

/**
 * TIBYAN root middleware — two jobs:
 *  1. Refresh the Supabase auth session cookie on every navigation
 *     (required by @supabase/ssr so Server Components see a valid session).
 *  2. First-layer route protection using the SAME canAccessPath() policy
 *     that lib/auth/session.ts uses server-side in layouts, and that
 *     tests/route-access.test.ts unit-tests directly.
 *
 * This is layer 1 of 3: middleware (fast, edge) → layout server guard
 * (defense in depth) → Postgres RLS (the real data boundary, applies
 * even if both application layers had a bug).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() re-validates the JWT with Supabase Auth (not just reading
  // the cookie), which is required before making any access decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.app_metadata?.role as AppRole | undefined) ?? null;
  const pathname = request.nextUrl.pathname;

  if (!canAccessPath(role, pathname)) {
    const target = getRedirectFor(role, pathname);
    const url = request.nextUrl.clone();
    const [path, query] = target.split("?");
    url.pathname = path;
    url.search = query ? `?${query}` : "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image optimization
     * files — those are never protected routes and refreshing the
     * session on them would be wasted edge compute.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
