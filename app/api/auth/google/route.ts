import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isGoogleEnabled, newState, authorizeUrl, GOOGLE_STATE_COOKIE } from "@/lib/auth/google";

/**
 * GET /api/auth/google — starts the Google sign-in flow.
 *
 * Plain redirect rather than a server action: this leaves the site
 * entirely, and a GET the browser can follow is exactly the shape the
 * OAuth spec expects.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isGoogleEnabled()) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/login?error=google_unavailable`
    );
  }

  const { state, cookieValue } = newState();

  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must survive Google's cross-site redirect back
    path: "/",
    maxAge: 60 * 10, // ten minutes is longer than any honest sign-in
  });

  return NextResponse.redirect(authorizeUrl(state));
}
