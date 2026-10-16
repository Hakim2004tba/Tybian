"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteReviewAction } from "@/lib/actions/reviews";

/**
 * Removes one review.
 *
 * Asks first, in place: deleting somebody's words is not undoable from
 * this screen, and a single click next to four other icons is how the
 * wrong row goes.
 */
export function DeleteReviewButton({ reviewId }: { reviewId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await deleteReviewAction(reviewId);
              setConfirming(false);
              router.refresh();
            })
          }
          className="rounded-md bg-error px-2 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? "…" : "تأكيد"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[11.5px] text-text-muted-light hover:text-text-primary-light"
        >
          إلغاء
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="حذف التقييم"
      title="حذف التقييم"
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border-light text-text-muted-light transition hover:border-error/40 hover:text-error"
    >
      <Trash2 size={14} />
    </button>
  );
}
