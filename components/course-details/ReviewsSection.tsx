import { Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { HelpfulButton } from "@/components/reviews/HelpfulButton";
import { REVIEW_REACTION_EMOJI } from "@/lib/review-reactions";
import type { ReviewsSummary } from "@/lib/data/course-reviews";
import type { MyReviewState } from "@/lib/data/course-reviews";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { getDictionary } from "@/lib/i18n/locale";

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });

export async function ReviewsSection({
  summary,
  courseId,
  courseSlug,
  myReview,
}: {
  summary: ReviewsSummary;
  courseId: string;
  courseSlug: string;
  myReview: MyReviewState;
}) {
  const { dict } = await getDictionary();
  const t = dict.courseDetails;
  return (
    <Card>
      <h3 className="text-[17px]">{t.reviews}</h3>

      <div className="mt-5 grid gap-8 sm:grid-cols-[auto_1fr]">
        <div className="text-center sm:min-w-[120px]">
          <div className="num text-[40px] font-bold leading-none">{summary.averageRating.toFixed(1)}</div>
          <div className="num mt-2 text-gold">
            {"★".repeat(Math.round(summary.averageRating))}
            {"☆".repeat(5 - Math.round(summary.averageRating))}
          </div>
          <div className="num mt-1 text-[12.5px] text-text-muted-light">{summary.ratingCount} {t.rating}</div>
        </div>

        {/* e.g. 5⭐ 82% — matches the requested distribution format exactly */}
        <div className="flex flex-col justify-center gap-2">
          {summary.distribution.map(({ star, count, pct }) => (
            <div key={star} className="flex items-center gap-2.5 text-[12.5px]">
              <span className="num flex w-10 shrink-0 items-center gap-1 text-text-muted-light">
                {star} <Star size={11} className="fill-gold text-gold" />
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-light">
                <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
              </div>
              <span className="num w-12 shrink-0 text-text-muted-light">
                {pct}% <span className="text-[11px]">({count})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Review composition — gated on active enrollment, exactly per spec */}
      <div className="mt-6 border-t border-border-light pt-6">
        {myReview.canReview ? (
          <>
            <h4 className="mb-3 text-[14px] font-semibold">
              {myReview.existingReview ? t.editRating : t.rateCourse}
            </h4>
            <ReviewForm courseId={courseId} courseSlug={courseSlug} existingReview={myReview.existingReview} />
          </>
        ) : (
          <p className="text-[13px] text-text-muted-light">
            {t.mustEnrollToRate}
          </p>
        )}
      </div>

      {summary.reviews.length > 0 && (
        <div className="mt-7 flex flex-col gap-5 border-t border-border-light pt-6">
          {summary.reviews.map((review) => (
            <div key={review.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#9c7cf5] text-[12px] font-semibold text-white">
                    {(review.profiles?.full_name ?? "?")[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13.5px] font-semibold">{review.profiles?.full_name ?? t.student}</span>
                      {review.reaction && <span className="text-[14px]">{REVIEW_REACTION_EMOJI[review.reaction]}</span>}
                    </div>
                    <div className="num text-[11px] text-gold">
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </div>
                  </div>
                </div>
                <span className="num shrink-0 text-[11.5px] text-text-muted-light">
                  {dateFormatter.format(new Date(review.created_at))}
                </span>
              </div>
              {review.comment && (
                <p className="mt-2.5 text-[14px] leading-relaxed text-text-secondary-light">{review.comment}</p>
              )}
              <div className="mt-2">
                <HelpfulButton reviewId={review.id} courseSlug={courseSlug} count={review.helpfulCount} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
