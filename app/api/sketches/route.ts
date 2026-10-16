import { getSessionUser } from "@/lib/auth/session";
import { listSketches } from "@/lib/data/sketches";

/**
 * GET /api/sketches — the caller's own notebook.
 *
 * A route handler rather than a server component because the launcher
 * fetches lazily, only when a student actually opens the notebook.
 * RLS restricts the rows to their author (migration 0038); the auth
 * check here just avoids an anonymous round trip.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const sketches = await listSketches();
  return Response.json(
    { sketches },
    { headers: { "Cache-Control": "no-store, no-transform" } }
  );
}
