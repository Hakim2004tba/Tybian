import "server-only";
import { query, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { hasActiveEnrollment } from "@/lib/db/guard";

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
  try {
    const [reviews, distributionRows] = await Promise.all([
      /*
        Helpful counts come back with the reviews, as a correlated
        subquery, instead of a second round trip that fetched every
        reaction row and tallied them in a Map.

        review_reactions was publicly readable under RLS
        (`using (true)`), so counting other people's reactions here is
        the same visibility as before — nothing about who reacted is
        exposed, only how many.
      */
      query<{
        id: string;
        rating: number;
        reaction: string | null;
        comment: string | null;
        created_at: string;
        user_id: string;
        full_name: string | null;
        helpful_count: number;
      }>(
        `SELECT r.id, r.rating, r.reaction, r.comment, r.created_at, r.user_id,
                p.full_name,
                (SELECT COUNT(*) FROM review_reactions rr
                  WHERE rr.review_id = r.id AND rr.reaction_type = 'helpful') AS helpful_count
           FROM reviews r
           LEFT JOIN profiles p ON p.id = r.user_id
          WHERE r.course_id = ? AND r.deleted_at IS NULL
          ORDER BY r.created_at DESC
          LIMIT 10`,
        [courseId]
      ),
      /*
        The distribution as a GROUP BY, not a 2000-row fetch tallied in
        JavaScript. The old comment justified the JS approach on the
        grounds that per-course review counts stay small — true, but it
        also silently capped at 2000, so a popular course would have
        reported a wrong average forever. Five rows now, no cap.
      */
      query<{ rating: number; n: number }>(
        `SELECT rating, COUNT(*) AS n
           FROM reviews
          WHERE course_id = ? AND deleted_at IS NULL
          GROUP BY rating`,
        [courseId]
      ),
    ]);

    const byStar = new Map(distributionRows.map((r) => [Number(r.rating), Number(r.n)]));
    const ratingCount = [...byStar.values()].reduce((sum, n) => sum + n, 0);
    const weighted = [...byStar.entries()].reduce((sum, [star, n]) => sum + star * n, 0);

    const distribution = [5, 4, 3, 2, 1].map((star) => {
      const count = byStar.get(star) ?? 0;
      return { star, count, pct: ratingCount ? Math.round((count / ratingCount) * 100) : 0 };
    });

    return {
      averageRating: ratingCount ? Math.round((weighted / ratingCount) * 10) / 10 : 0,
      ratingCount,
      distribution,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        reaction: r.reaction,
        comment: r.comment,
        created_at: r.created_at,
        helpfulCount: Number(r.helpful_count),
        userId: r.user_id,
        profiles: r.full_name ? { full_name: r.full_name } : null,
      })),
    };
  } catch {
    return {
      averageRating: 0,
      ratingCount: 0,
      distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: 0, pct: 0 })),
      reviews: [],
    };
  }
}

export type MyReviewState = {
  canReview: boolean; // has active enrollment
  existingReview: { id: string; rating: number; reaction: string | null; comment: string | null } | null;
};

/**
 * Whether the current viewer may write or edit a review, plus their
 * existing one to prefill the form.
 *
 * `canReview` is the enrollment rule again, and it goes through the same
 * hasActiveEnrollment() as the video gate rather than being written out
 * here — the has_active_enrollment() RPC kept that logic in one place and
 * the guard continues to. Someone who never bought the course must not be
 * able to rate it.
 */
export async function getMyReviewState(courseId: string): Promise<MyReviewState> {
  const user = await getSessionUser();
  if (!user) return { canReview: false, existingReview: null };

  const [canReview, existingReview] = await Promise.all([
    hasActiveEnrollment(user.id, courseId),
    queryOne<{ id: string; rating: number; reaction: string | null; comment: string | null }>(
      `SELECT id, rating, reaction, comment
         FROM reviews
        WHERE user_id = ? AND course_id = ? AND deleted_at IS NULL`,
      [user.id, courseId]
    ),
  ]);

  return { canReview, existingReview };
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

  try {
    const placeholders = lessonIds.map(() => "?").join(",");
    const rows = await query<{
      id: string;
      body: string;
      created_at: string;
      full_name: string | null;
      lesson_title: string | null;
    }>(
      `SELECT c.id, c.body, c.created_at,
              p.full_name,
              l.title AS lesson_title
         FROM comments c
         LEFT JOIN profiles p ON p.id = c.user_id
         LEFT JOIN lessons  l ON l.id = c.lesson_id
        WHERE c.lesson_id IN (${placeholders}) AND c.deleted_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT 8`,
      lessonIds
    );

    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      profiles: r.full_name ? { full_name: r.full_name } : null,
      lessons: r.lesson_title ? { title: r.lesson_title } : null,
    }));
  } catch {
    return [];
  }
}
