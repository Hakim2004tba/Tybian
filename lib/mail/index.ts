import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * TIBYAN — outbound email.
 *
 * Supabase Auth used to send the verification and password-reset mail
 * itself. Nothing does now, so this does, over the SMTP account that
 * comes with the hosting plan (cPanel → Email Accounts).
 *
 * Sending from the same domain the site is served from is not a detail:
 * mail from a mismatched domain fails SPF/DKIM and lands in spam, and a
 * password-reset link nobody receives looks exactly like a broken site.
 */

declare global {
  // eslint-disable-next-line no-var
  var __tibyanMailer: Transporter | undefined;
}

function transporter(): Transporter {
  if (globalThis.__tibyanMailer) return globalThis.__tibyanMailer;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD in .env.local " +
        "from cPanel → Email Accounts → Connect Devices."
    );
  }

  const port = Number(SMTP_PORT ?? 465);

  globalThis.__tibyanMailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });

  return globalThis.__tibyanMailer;
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

async function send(
  to: string,
  subject: string,
  html: string,
  replyToOverride?: string
): Promise<void> {
  await transporter().sendMail({
    from: process.env.SMTP_FROM ?? `"تبيان | TIBYAN" <${process.env.SMTP_USER}>`,
    /*
      Replies reach a mailbox somebody reads.

      A student who answers a verification or password email is usually
      asking for help, and the reply has to land somewhere. Defaulting
      to the sending address is right when that address is the real
      contact@ mailbox; MAIL_REPLY_TO exists for the case where the
      platform must authenticate as one address and be answered at
      another, which some hosts require.
    */
    replyTo: replyToOverride ?? process.env.MAIL_REPLY_TO ?? undefined,
    to,
    subject,
    html,
  });
}

/** RTL wrapper, because every recipient of these reads Arabic. */
function layout(heading: string, body: string, buttonLabel: string, url: string): string {
  return `
<div dir="rtl" style="font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;background:#f6f7f9;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111">${heading}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#444">${body}</p>
    <a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px">${buttonLabel}</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#888">
      إذا لم يعمل الزر، انسخ هذا الرابط في المتصفح:<br>
      <span style="word-break:break-all;color:#666">${url}</span>
    </p>
  </div>
</div>`.trim();
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = `${siteUrl()}/reset-password?token=${token}`;
  await send(
    to,
    "إعادة تعيين كلمة المرور | تبيان",
    layout(
      "إعادة تعيين كلمة المرور",
      "وصلنا طلب لإعادة تعيين كلمة مرور حسابك. الرابط صالح لمدة ساعة واحدة. إذا لم تطلب ذلك، تجاهل هذه الرسالة — لن يتغيّر شيء.",
      "تعيين كلمة مرور جديدة",
      url
    )
  );
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = `${siteUrl()}/auth/verify?token=${token}`;
  await send(
    to,
    "تأكيد بريدك الإلكتروني | تبيان",
    layout(
      "مرحباً بك في تبيان",
      "أكّد بريدك الإلكتروني لتفعيل حسابك بالكامل. الرابط صالح لمدة 24 ساعة.",
      "تأكيد البريد الإلكتروني",
      url
    )
  );
}

/**
 * The address the platform publishes and receives at.
 *
 * Read from the environment rather than written into the page, so the
 * mailbox can change in cPanel without a rebuild — and so the address
 * shown on /contact can never drift from the one messages are actually
 * delivered to, which is how a contact page ends up advertising a
 * mailbox nobody opens.
 */
export function platformEmail(): string {
  return (
    process.env.MAIL_REPLY_TO ??
    process.env.SMTP_USER ??
    "contact@tybianacademy.com"
  );
}

/**
 * Forwards a contact-form submission to the platform mailbox.
 *
 * The database row written by submitContactMessageAction stays the
 * record of truth — this is a notification, so that a message does not
 * sit unread in an admin table nobody has open. Reply-To is the person
 * who wrote in, so hitting reply in the mailbox answers them directly
 * instead of answering the platform's own address.
 */
export async function sendContactMessageEmail(input: {
  name: string;
  email: string;
  subject: string | null;
  body: string;
}): Promise<void> {
  const escape = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `
<div dir="auto" style="font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;background:#f6f7f9;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
    <h1 style="margin:0 0 4px;font-size:18px;color:#111">رسالة جديدة من نموذج التواصل</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#888">TIBYAN — contact form</p>
    <p style="margin:0 0 6px;font-size:14px;color:#444"><b>الاسم:</b> ${escape(input.name)}</p>
    <p style="margin:0 0 6px;font-size:14px;color:#444"><b>البريد:</b> ${escape(input.email)}</p>
    <p style="margin:0 0 18px;font-size:14px;color:#444"><b>الموضوع:</b> ${escape(input.subject ?? "—")}</p>
    <div style="white-space:pre-wrap;font-size:15px;line-height:1.7;color:#222;border-top:1px solid #eee;padding-top:16px">${escape(input.body)}</div>
  </div>
</div>`.trim();

  await send(
    platformEmail(),
    `تواصل: ${input.subject ?? input.name}`,
    html,
    input.email
  );
}

/**
 * Does the mail server actually accept us?
 *
 * `smtp: true` on /api/version only says the variables are SET. It says
 * nothing about whether the password is the right one for the mailbox
 * in SMTP_USER — and a wrong password there fails silently everywhere
 * it matters: the verification mail, the reset link, the contact
 * notification. Every one of those swallows its send error on purpose,
 * because none of them should fail the thing the person was doing.
 *
 * So the failure has to be askable somewhere, and this is it. verify()
 * opens the connection and authenticates without sending anything.
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  try {
    await transporter().verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Sends a real message, to prove delivery rather than just login. */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await send(
      to,
      "اختبار البريد | تبيان",
      `<div dir="rtl" style="font-family:system-ui,sans-serif;padding:24px">
         <p style="font-size:15px">وصلت هذه الرسالة، إذن إعدادات SMTP سليمة.</p>
       </div>`
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * One message of a bulk campaign.
 *
 * Plain text from the admin, escaped and turned into paragraphs here —
 * the composer is a textarea, not an HTML editor, and pasting the text
 * straight into the template would let a stray `<` break every message
 * or worse.
 *
 * Sent ONE ADDRESS AT A TIME, never as a single mail with many BCCs.
 * A bulk BCC is one failure for the whole list: one refused address and
 * the server rejects the message, and nobody can tell who received it.
 * Per-recipient sending is also what lets the campaign record who it
 * reached — see lib/admin/actions/campaigns.ts.
 */
export async function sendCampaignEmail(to: string, subject: string, body: string): Promise<void> {
  const escape = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const paragraphs = escape(body)
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#444">${block.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const html = `
<div dir="auto" style="font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;background:#f6f7f9;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 20px;font-size:20px;color:#111">${escape(subject)}</h1>
    ${paragraphs}
    <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:12.5px;line-height:1.7;color:#999">
      تبيان — منصّة التعليم الطبي<br>
      <a href="${siteUrl()}" style="color:#6C4CF1;text-decoration:none">${siteUrl()}</a>
    </p>
  </div>
</div>`.trim();

  await send(to, subject, html);
}
