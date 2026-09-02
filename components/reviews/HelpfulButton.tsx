"use client";

import { useTransition } from "react";
import { ThumbsUp } from "lucide-react";
import { toggleReviewHelpfulAction } from "@/lib/actions/reviews";

export function HelpfulButton({
  reviewId,
  courseSlug,
  count,
}: {
  reviewId: string;
  courseSlug: string;
  count: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(() => {
          toggleReviewHelpfulAction(reviewId, courseSlug);
        })
      }
      disabled={pending}
      className="num flex items-center gap-1.5 text-[12px] text-text-muted-light transition-colors hover:text-primary disabled:opacity-50"
    >
      <ThumbsUp size={12} />
      مفيد ({count})
    </button>
  );
}
