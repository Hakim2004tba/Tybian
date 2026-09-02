"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReviewActionState = { error: string | null; success?: string | null };

const VALID_REACTIONS = ["loved", "fire", "like", "thinking", "sad"];

/**
 * Handles both create and edit in one action (upsert-by-natural-key,
 * same select-then-update-or-insert pattern used for course_prices,
 * since reviews' uniqueness is a PARTIAL index — uq_reviews_active_user_course
 * WHERE deleted_at IS NULL — so a plain `.upsert(onConflict:...)` can't
 * target it directly).
 *
 * "لا يستطيع المستخدم تقييم دورة إلا إذا كان لديه enrollment صالح" is
 * enforced by RLS (reviews_insert_enrolled_only, 0019) — this action
 * still checks first for a friendly error message, but the database
 * would reject an unenrolled insert regardless of what this code does.
 */
export async function upsertReviewAction(
  courseId: string,
  courseSlug: string,
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const rating = Number(formData.get("rating"));
  const reaction = String(formData.get("reaction") ?? "");
  const comment = String(formData.get("comment") ?? "").trim() || null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "الرجاء اختيار تقييم من 1 إلى 5 نجوم" };
  }
  if (reaction && !VALID_REACTIONS.includes(reaction)) {
    return { error: "رمز تعبيري غير صالح" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("reviews")
      .update({ rating, reaction: reaction || null, comment })
      .eq("id", existing.id);
    if (error) return { error: "تعذّر حفظ التعديلات" };
  } else {
    const { error } = await supabase.from("reviews").insert({
      user_id: user.id,
      course_id: courseId,
      rating,
      reaction: reaction || null,
      comment,
    });
    if (error) {
      if ((error as { code?: string }).code === "42501") {
        return { error: "يجب الاشتراك في هذه الدورة لتتمكن من تقييمها" };
      }
      return { error: "تعذّر إرسال التقييم" };
    }
  }

  revalidatePath(`/courses/${courseSlug}`);
  return { error: null, success: existing ? "تم تحديث تقييمك" : "شكراً لتقييمك" };
}

export async function toggleReviewHelpfulAction(reviewId: string, courseSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  const { data: existing } = await supabase
    .from("review_reactions")
    .select("id")
    .eq("review_id", reviewId)
    .eq("user_id", user.id)
    .eq("reaction_type", "helpful")
    .maybeSingle();

  if (existing) {
    await supabase.from("review_reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("review_reactions").insert({ review_id: reviewId, user_id: user.id, reaction_type: "helpful" });
  }

  revalidatePath(`/courses/${courseSlug}`);
  return { error: null };
}
