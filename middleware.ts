import { type NextRequest, NextResponse } from "next/server";
import { getRequiredAccess, getRedirectFor } from "@/lib/auth/route-access";

/**
 * TIBYAN root middleware — the cheap first pass.
 *
 * The Supabase version did two things here: refresh the auth cookie, and
 * decide access from the role in the JWT. Both are gone.
 *
 * There is no cookie to refresh — a session is a row now, and its id in
 * an httpOnly cookie. And the role cannot be read here at all: middleware
 * runs on the Edge runtime, which has no TCP sockets, so `mysql2` cannot
 * run in this file. Reading a role would mean a database round trip, and
 * there is nowhere to make one from.
 *
 * So this layer answers only the question it can answer without asking
 * the database: is there a session cookie at all? That is enough to send
 * signed-out visitors to /login without loading a page they cannot see.
 *
 * Everything finer — student vs teacher vs admin — is decided by
 * `requireRouteAccess()` in each area's layout (app/admin, app/teacher,
 * app/student, app/dashboard all call it), which runs in the Node runtime
 * and reads the role from `profiles` on every request. That is now the
 * authoritative check rather than the second of three: the third layer,
 * Postgres RLS, does not exist on MariaDB.
 *
 * The practical consequence, and it is deliberate: a student who types
 * /admin is no longer stopped here. They reach the layout, which
 * redirects them to /unauthorized before rendering anything or reading
 * any data. One extra hop, same outcome, no weaker.
 *
 * The cookie is NOT trusted as proof of anything. Holding a made-up
 * cookie value gets you past this file and no further — the layout looks
 * the session up and finds nothing.
 */

const SESSION_COOKIE = "tibyan_session";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (getRequiredAccess(pathname) === "public") {
    return withPathname(request, pathname);
  }

  if (request.cookies.has(SESSION_COOKIE)) {
    return withPathname(request, pathname);
  }

  const target = getRedirectFor(null, pathname);
  const url = request.nextUrl.clone();
  const [path, search] = target.split("?");
  url.pathname = path;
  url.search = search ? `?${search}` : "";
  return NextResponse.redirect(url);
}

/**
 * Forwards the current path to the server layouts as a request header.
 *
 * The root layout renders the marketing Navbar and Footer, but
 * /dashboard ships its own sidebar and topbar — stacking both would give
 * the student two navigations. A server layout cannot read the pathname
 * on its own, so it is passed here and read back with headers() in
 * app/layout.tsx.
 *
 * Header-only: it changes no route, no redirect and no access decision.
 * Kept from the pre-migration middleware, where the dashboard shell
 * depends on it.
 */
function withPathname(request: NextRequest, pathname: string) {
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation files —
     * those are never protected routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
