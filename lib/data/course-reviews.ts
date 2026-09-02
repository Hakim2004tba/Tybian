import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

export { REVIEW_REACTION_EMOJI } from "@/lib/review-reactions";

export type CourseReview = {
  id: string;
  rating: number;
  reaction: string | null;
  comment: string | null;
  created_at: string;
  helpfulCount: number;
  userId: string;
  profiles: { full_name: string } | null;
};

export type ReviewsSummary = {
  averageRating: number;
  ratingCount: number;
  distribution: { star: number; count: number; pct: number }[];
  reviews: CourseReview[];
};

export async function getCourseReviews(courseId: string): Promise<ReviewsSummary> {
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, reaction, comment, created_at, user_id, profiles ( full_name )")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  const reviewIds = (reviews ?? []).map((r) => r.id);

  // Reaction counts ("helpful") per review — review_reactions is
  // publicly readable (review_reactions_select_all: using (true)).
  const { data: reactions } = reviewIds.length
    ? await supabase
        .from("review_reactions")
        .select("review_id")
        .in("review_id", reviewIds)
        .eq("reaction_type", "helpful")
    : { data: [] as { review_id: string }[] };

  const helpfulCounts = new Map<string, number>();
  (reactions ?? []).forEach((r) => {
    helpfulCounts.set(r.review_id, (helpfulCounts.get(r.review_id) ?? 0) + 1);
  });

  // Rating distribution — fetched and aggregated in JS rather than a new
  // SQL aggregate function, since a per-course review count realistically
  // stays small enough (low hundreds) for this to be cheap; revisit with
  // a dedicated function if that assumption stops holding.
  const { data: allRatings } = await supabase
    .from("reviews")
    .select("rating")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .limit(2000);

  const ratingCount = allRatings?.length ?? 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = (allRatings ?? []).filter((r) => r.rating === star).length;
    return { star, count, pct: ratingCount ? Math.round((count / ratingCount) * 100) : 0 };
  });

  const averageRating = ratingCount
    ? (allRatings ?? []).reduce((sum, r) => sum + r.rating, 0) / ratingCount
    : 0;

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    ratingCount,
    distribution,
    reviews: (reviews ?? []).map((r) => ({
      id: r.id,
      rating: r.rating,
      reaction: r.reaction,
      comment: r.comment,
      created_at: r.created_at,
      helpfulCount: helpfulCounts.get(r.id) ?? 0,
      userId: r.user_id,
      profiles: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles,
    })) as CourseReview[],
  };
}

export type MyReviewState = {
  canReview: boolean; // has active enrollment
  existingReview: { id: string; rating: number; reaction: string | null; comment: string | null } | null;
};

/** Determines whether the current viewer can write/edit a review, and
 *  loads their existing one (if any) to prefill the edit form. Reuses
 *  has_active_enrollment via the same RPC pattern as elsewhere. */
export async function getMyReviewState(courseId: string): Promise<MyReviewState> {
  const user = await getSessionUser();
  if (!user) return { canReview: false, existingReview: null };

  const supabase = await createClient();

  const { data: isEnrolled } = await supabase.rpc("has_active_enrollment", {
    p_user_id: user.id,
    p_course_id: courseId,
  });

  const { data: existing } = await supabase
    .from("reviews")
    .select("id, rating, reaction, comment")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .maybeSingle();

  return { canReview: Boolean(isEnrolled), existingReview: existing ?? null };
}

export type CourseQuestion = {
  id: string;
  body: string;
  created_at: string;
  profiles: { full_name: string } | null;
  lessons: { title: string } | null;
};

export async function getCourseQuestions(lessonIds: string[]): Promise<CourseQuestion[]> {
  if (!lessonIds.length) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select("id, body, created_at, profiles ( full_name ), lessons ( title )")
    .in("lesson_id", lessonIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(8);

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown>;
    return {
      id: r.id as string,
      body: r.body as string,
      created_at: r.created_at as string,
      profiles: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : (r.profiles as CourseQuestion["profiles"]),
      lessons: Array.isArray(r.lessons) ? (r.lessons[0] ?? null) : (r.lessons as CourseQuestion["lessons"]),
    };
  });
}
