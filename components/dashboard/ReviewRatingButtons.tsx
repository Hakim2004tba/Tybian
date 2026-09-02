"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordReviewAction } from "@/lib/actions/study-tools";
import type { ReviewRating } from "@/lib/study/spaced-repetition";
import { cn } from "@/lib/utils";

const ratings: { value: ReviewRating; label: string; className: string }[] = [
  { value: "again", label: "نسيته", className: "border-error/30 text-error hover:bg-error/10" },
  { value: "hard", label: "صعب", className: "border-gold/40 text-gold hover:bg-gold/10" },
  { value: "good", label: "جيد", className: "border-primary/30 text-primary hover:bg-primary/10" },
  { value: "easy", label: "سهل", className: "border-success/30 text-success hover:bg-success/10" },
];

export function ReviewRatingButtons({ reviewId }: { reviewId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<{ days: number } | null>(null);
  const router = useRouter();

  function rate(rating: ReviewRating) {
    startTransition(async () => {
      const result = await recordReviewAction(reviewId, rating);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      setDone({ days: result.nextReviewInDays ?? 1 });
      setTimeout(() => router.refresh(), 900);
    });
  }

  if (done) {
    return (
      <span className="text-[12.5px] text-success">
        ✓ ستُراجَع بعد {done.days} {done.days === 1 ? "يوم" : "أيام"}
      </span>
    );
  }

  return (
    <div className="flex gap-1.5">
      {ratings.map((r) => (
        <button
          key={r.value}
          onClick={() => rate(r.value)}
          disabled={pending}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-50",
            r.className
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
