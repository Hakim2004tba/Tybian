"use server";

import { createClient } from "@/lib/supabase/server";

export type ContactActionState = { error: string | null; success?: string | null };

const emailSchema = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Open to everyone, including guests — RLS's `contact_messages_insert_anyone`
 * (0028) is the actual permission boundary, not a session check here.
 * No SELECT policy exists for non-admins at all, so a submitter can
 * never read back their own or anyone else's message afterward.
 */
export async function submitContactMessageAction(
  _prev: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();

  if (!name) return { error: "الرجاء إدخال اسمك" };
  if (!emailSchema(email)) return { error: "البريد الإلكتروني غير صالح" };
  if (!body) return { error: "الرجاء كتابة رسالتك" };

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({ name, email, subject, body });

  if (error) return { error: "تعذّر إرسال الرسالة، حاول مجدداً" };

  return { error: null, success: "تم استلام رسالتك، سنتواصل معك قريباً عبر البريد الإلكتروني." };
}
