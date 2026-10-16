"use server";

import { execute, newId } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/locale";
import { sendContactMessageEmail } from "@/lib/mail";

export type ContactActionState = { error: string | null; success?: string | null };

const emailSchema = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * The public contact form.
 *
 * Open to everyone including guests, exactly as
 * contact_messages_insert_anyone allowed. The matching half of that
 * policy set — no SELECT for anyone but an admin — has no equivalent
 * here because there is simply no read path in the app outside
 * lib/data/admin-messages.ts, which is admin-guarded. Do not add one.
 *
 * Lengths are trimmed to the column widths rather than left to the
 * database: MariaDB in its default non-strict mode truncates an
 * oversized string and warns instead of failing, so an over-long subject
 * would be silently cut. Better to bound it here where the limit is
 * visible.
 */
export async function submitContactMessageAction(
  _prev: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  /*
    Server actions run on the server WITH the request's cookies, so the
    locale is readable here too. Without this the form validated in
    Arabic for an English reader — the page spoke one language and its
    errors another.
  */
  const { dict } = await getDictionary();
  const t = dict.pages.contactForm;

  const name = String(formData.get("name") ?? "").trim().slice(0, 191);
  const email = String(formData.get("email") ?? "").trim().slice(0, 191);
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 255) || null;
  const body = String(formData.get("body") ?? "").trim();

  if (!name) return { error: t.errName };
  if (!emailSchema(email)) return { error: t.errEmail };
  if (!body) return { error: t.errBody };

  try {
    await execute(
      `INSERT INTO contact_messages (id, name, email, subject, body) VALUES (?, ?, ?, ?, ?)`,
      [newId(), name, email, subject, body]
    );
  } catch {
    return { error: t.errSend };
  }

  /*
    Then notify the mailbox. Deliberately AFTER the insert and outside
    its try: the row is the record of truth and the message is already
    safe, so a refused SMTP connection must not tell somebody their
    message failed to send when it did not. An admin still sees it in
    the messages table either way.
  */
  try {
    await sendContactMessageEmail({ name, email, subject, body });
  } catch {
    // Non-fatal — see above.
  }

  return { error: null, success: t.success };
}
