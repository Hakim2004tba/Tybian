import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getLessonNote(userId: string, lessonId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_notes")
    .select("body")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  return data?.body ?? "";
}
