"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveLessonNoteAction(lessonId: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  // Plain (non-partial) unique constraint on (user_id, lesson_id), so a
  // real .upsert(onConflict:...) works directly here — unlike the
  // partial-index cases elsewhere in this project (reviews,
  // enrollments, orders) that need a select-then-insert-or-update dance.
  const { error } = await supabase
    .from("lesson_notes")
    .upsert({ user_id: user.id, lesson_id: lessonId, body }, { onConflict: "user_id,lesson_id" });

  if (error) return { error: "تعذّر حفظ الملاحظة" };
  return { error: null };
}
