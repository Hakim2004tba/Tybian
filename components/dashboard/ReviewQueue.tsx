import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getSessionUser } from "@/lib/auth/session";
import { getDueReviews } from "@/lib/data/study-tools";
import { ReviewRatingButtons } from "@/components/dashboard/ReviewRatingButtons";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * Every lesson a student has ever completed automatically enters this
 * queue the moment they finish it (see trg_lesson_progress_seed_review,
 * 0029) — there's no separate "create a flashcard" step. Rating a
 * review here calls recordReviewAction, which runs the same SM-2-lite
 * algorithm tested in tests/study-tools.test.ts.
 */
export async function ReviewQueue() {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const user = await getSessionUser();
  const reviews = await getDueReviews(user!.id);

  if (reviews.length === 0) {
    return (
      <Card>
        <h3 className="flex items-center gap-2 text-[15px]">
          <BrainCircuit size={17} />
          {t.review.title}
        </h3>
        <p className="mt-2 text-[13px] text-text-muted-light">
          {t.review.empty}
        </p>
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light p-lg pb-4">
        <h3 className="flex items-center gap-2 text-[15px]">
          <BrainCircuit size={17} />
          {t.review.title}
        </h3>
        <Badge variant="violet">{reviews.length} {t.review.needsReview}</Badge>
      </div>

      <div className="flex flex-col divide-y divide-border-light">
        {reviews.map((r) => (
          <div key={r.reviewId} className="flex flex-wrap items-center justify-between gap-3 p-lg py-3.5">
            <div className="min-w-0">
              <Link href={`/courses/${r.courseSlug}/learn?lesson=${r.lessonId}`} className="truncate text-[13.5px] font-medium hover:text-primary">
                {r.lessonTitle}
              </Link>
              <div className="mt-0.5 text-[12px] text-text-muted-light">{r.courseTitle}</div>
            </div>
            <ReviewRatingButtons reviewId={r.reviewId} />
          </div>
        ))}
      </div>
    </Card>
  );
}
