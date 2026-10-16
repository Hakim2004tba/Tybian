"use client";

import { useState } from "react";
import { Star, Check } from "lucide-react";
import { ReviewForm } from "@/components/reviews/ReviewForm";

/**
 * RATE THE COURSE FROM INSIDE IT.
 *
 * The form lived only on the course's sales page, so the only people
 * who could reach it were the ones who went back to the page that sells
 * a course they had already bought. The students with something to say
 * — the ones actually watching — had no way to say it.
 *
 * Collapsed to a single row until it is wanted: a rating widget open
 * beside a lesson competes with the lesson. The stars are live in the
 * collapsed row, so one click both opens the form and sets the score.
 */
export function RateCoursePanel({
  courseId,
  courseSlug,
  existingReview,
  tone = "light",
}: {
  courseId: string;
  courseSlug: string;
  existingReview: { id: string; rating: number; reaction: string | null; comment: string | null } | null;
  /** The watch page is dark; the course page is not. */
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);

  const rated = existingReview?.rating ?? 0;

  if (open) {
    return (
      <div
        className={
          "rounded-2xl border p-4 " +
          (dark
            ? "border-white/10 bg-white/[0.03]"
            : "border-primary/25 bg-gradient-to-br from-primary/[0.07] via-surface-light to-secondary/[0.05]")
        }
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3
            className={
              "text-[14.5px] font-semibold " +
              (dark ? "text-text-primary-dark" : "text-text-primary-light")
            }
          >
            {rated ? "عدّل تقييمك" : "قيّم هذه الدورة"}
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={
              "text-[12.5px] " +
              (dark
                ? "text-white/50 hover:text-white"
                : "text-text-muted-light hover:text-text-primary-light")
            }
          >
            إغلاق
          </button>
        </div>
        <ReviewForm
          courseId={courseId}
          courseSlug={courseSlug}
          existingReview={existingReview}
          tone={tone}
        />
      </div>
    );
  }

  return (
    <div
      className={
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 " +
        (dark
          ? "border-white/10 bg-white/[0.04]"
          : "border-border-light bg-gradient-to-br from-primary/[0.06] via-surface-light to-secondary/[0.05]")
      }
    >
      <div className="min-w-0">
        <p
          className={
            "flex items-center gap-2 text-[14px] font-semibold " +
            (dark ? "text-text-primary-dark" : "text-text-primary-light")
          }
        >
          {rated > 0 && <Check size={15} className="text-success" />}
          {rated > 0 ? "قيّمت هذه الدورة" : "ما رأيك في هذه الدورة؟"}
        </p>
        <p
          className={
            "mt-0.5 text-[12.5px] " +
            (dark ? "text-text-secondary-dark" : "text-text-secondary-light")
          }
        >
          {rated > 0 ? "اضغط نجمة لتغيير تقييمك" : "تقييمك يساعد زملاءك على الاختيار"}
        </p>
      </div>

      {/* The stars ARE the button: clicking one opens the form with
          that score already chosen, so rating costs one click for the
          student who only wants to give a number. */}
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const lit = (hover || rated) >= n;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setOpen(true)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={22}
                className={lit ? "text-gold" : dark ? "text-white/25" : "text-border-light"}
                fill={lit ? "currentColor" : "none"}
                strokeWidth={1.75}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
