"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeNextReview, type ReviewRating } from "@/lib/study/spaced-repetition";

export type RecordReviewResult = { error: string | null; nextReviewInDays?: number };

export async function recordReviewAction(reviewId: string, rating: ReviewRating): Promise<RecordReviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  const { data: current } = await supabase
    .from("lesson_reviews")
    .select("ease_factor, interval_days, repetitions")
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!current) return { error: "لم يتم العثور على هذه المراجعة" };

  const next = computeNextReview(
    { easeFactor: Number(current.ease_factor), intervalDays: current.interval_days, repetitions: current.repetitions },
    rating
  );

  const nextReviewAt = new Date(Date.now() + next.intervalDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("lesson_reviews")
    .update({
      ease_factor: next.easeFactor,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      last_reviewed_at: new Date().toISOString(),
      next_review_at: nextReviewAt,
    })
    .eq("id", reviewId);

  if (error) return { error: "تعذّر حفظ تقييم المراجعة" };

  revalidatePath("/dashboard");
  return { error: null, nextReviewInDays: next.intervalDays };
}

export async function logStudySessionAction(durationSeconds: number, startedAt: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  if (durationSeconds < 30) return { error: null };

  const { error } = await supabase.from("study_sessions").insert({
    user_id: user.id,
    duration_seconds: Math.min(durationSeconds, 6 * 60 * 60),
    started_at: startedAt,
  });

  if (error) return { error: "تعذّر حفظ جلسة الدراسة" };

  revalidatePath("/dashboard");
  return { error: null };
}
