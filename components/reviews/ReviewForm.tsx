"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { upsertReviewAction, type ReviewActionState } from "@/lib/actions/reviews";
import { REVIEW_REACTION_EMOJI } from "@/lib/review-reactions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const REACTIONS: { value: string; emoji: string; label: string }[] = [
  { value: "loved", emoji: REVIEW_REACTION_EMOJI.loved, label: "أحببتها" },
  { value: "fire", emoji: REVIEW_REACTION_EMOJI.fire, label: "رائعة" },
  { value: "like", emoji: REVIEW_REACTION_EMOJI.like, label: "جيدة" },
  { value: "thinking", emoji: REVIEW_REACTION_EMOJI.thinking, label: "متوسطة" },
  { value: "sad", emoji: REVIEW_REACTION_EMOJI.sad, label: "مخيبة" },
];

export function ReviewForm({
  courseId,
  courseSlug,
  existingReview,
}: {
  courseId: string;
  courseSlug: string;
  existingReview: { id: string; rating: number; reaction: string | null; comment: string | null } | null;
}) {
  const boundAction = upsertReviewAction.bind(null, courseId, courseSlug);
  const [state, formAction, pending] = useActionState<ReviewActionState, FormData>(boundAction, {
    error: null,
  });

  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reaction, setReaction] = useState(existingReview?.reaction ?? "");

  return (
    <form action={formAction} className="rounded-md border border-border-light bg-bg-light p-4">
      <input type="hidden" name="rating" value={rating} />
      <input type="hidden" name="reaction" value={reaction} />

      {state.error && (
        <p className="mb-3 rounded-sm border border-error/30 bg-error/10 px-3 py-2 text-[13px] text-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-sm border border-success/30 bg-success/10 px-3 py-2 text-[13px] text-success">
          {state.success}
        </p>
      )}

      <div className="flex items-center gap-1" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} نجوم`}
          >
            <Star
              size={26}
              className={cn(
                "transition-colors",
                (hoverRating || rating) >= n ? "fill-gold text-gold" : "text-border-light"
              )}
            />
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {REACTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setReaction(r.value === reaction ? "" : r.value)}
            title={r.label}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border text-[18px] transition-all",
              reaction === r.value
                ? "border-primary bg-primary/10 scale-110"
                : "border-border-light hover:border-primary/40"
            )}
          >
            {r.emoji}
          </button>
        ))}
      </div>

      <textarea
        name="comment"
        rows={3}
        defaultValue={existingReview?.comment ?? ""}
        placeholder="شارك تجربتك مع هذه الدورة..."
        className="mt-3 w-full rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[13.5px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(108,76,241,0.1)]"
      />

      <Button type="submit" size="sm" className="mt-3" disabled={pending || rating === 0}>
        {pending ? "جارٍ الإرسال..." : existingReview ? "تحديث التقييم" : "إرسال التقييم"}
      </Button>
    </form>
  );
}
