"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { execute, newId, queryOne, toSql, transaction } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit, rateLimitReset } from "@/lib/auth/rate-limit";
import { createToken, hashToken } from "@/lib/auth/tokens";
import {
  createSession,
  destroyAllSessions,
  destroySession,
  getSessionUser,
} from "@/lib/auth/session";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";

/**
 * TIBYAN — authentication actions.
 *
 * Every exported name and signature is unchanged from the Supabase
 * version, so the forms under app/(auth)/ keep working untouched. What
 * changed is underneath: accounts live in our own `users` table, sessions
 * in `sessions`, and the emails are sent by lib/mail rather than by
 * Supabase Auth.
 *
 * Signing up does NOT sign you in. It creates the account, mails a
 * confirmation link, and leaves you on /verify-email; the link itself is
 * what opens the first session (app/auth/verify/route.ts).
 *
 * An earlier version did the opposite — sign in first, mail afterwards —
 * because SMTP on this host was not yet working and making first entry
 * depend on it would have turned a spam-filtered message into "the site
 * is broken". That reason is gone: mail sends. What remains is the cost
 * of the shortcut, which is real — an unconfirmed address cannot be
 * reached for a receipt, a password reset or a meeting link, and nothing
 * stopped a typo'd or someone else's address from holding an account.
 *
 * Accounts created before this change are grandfathered by
 * tibyan-db/mysql/08-verified-grandfather.sql, so nobody who could sign
 * in yesterday is locked out today.
 */

/**
 * `redirectTo` exists because a server action's own redirect() cannot be
 * relied on behind this host.
 *
 * Next answers an action-with-redirect as a 303 carrying an RSC stream
 * that the client parses to continue the navigation. On Octenium that
 * response comes back through nginx + Passenger marked
 * `x-nextjs-cache: HIT`, i.e. served from a cache — so the browser gets a
 * prerendered page payload where it expects an action result, fails to
 * parse it, and asks for chunk names that do not exist. That surfaces as
 * "a client-side exception has occurred", which is what login did.
 *
 * Returning the destination instead lets the client navigate with a plain
 * full page load, which no cache can corrupt. The action still decides
 * WHERE to go — the client only obeys.
 */
export type ActionState = {
  error: string | null;
  success?: string | null;
  redirectTo?: string;
};

const emailSchema = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const RESET_TTL_MS = 60 * 60 * 1000; // one hour
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

/** Emails are matched case-insensitively; store one canonical form. */
const normalise = (email: string) => email.trim().toLowerCase();

async function currentUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent");
}

// ---------------------------------------------------------------------
// Sign up (student self-registration — teacher/admin accounts are
// created by an admin, not through this public form)
// ---------------------------------------------------------------------
export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = normalise(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const academicYearId = String(formData.get("academicYearId") ?? "");

  if (!fullName) return { error: "الرجاء إدخال الاسم الكامل" };
  if (!emailSchema(email)) return { error: "البريد الإلكتروني غير صالح" };
  if (password.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };
  if (!academicYearId) return { error: "الرجاء اختيار السنة الدراسية" };

  /* Sign-up hashes too, and additionally writes three rows and sends
     mail — a more expensive request than sign-in, and equally open. */
  const brake = await rateLimit("signup", 10, 600);
  if (!brake.allowed) {
    return { error: `محاولات كثيرة. حاول بعد ${brake.retryAfterSeconds} ثانية.` };
  }

  const existing = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existing) return { error: "هذا البريد الإلكتروني مسجّل بالفعل" };

  const userId = newId();
  const passwordHash = await hashPassword(password);
  const { token, tokenHash } = createToken();

  /*
    One transaction for all four writes.

    handle_new_auth_user() (0028) used to create the profile from a
    trigger on auth.users, precisely so a profile could never be missing
    for an account. There is no trigger now, so the transaction is what
    guarantees it: a failure between the two inserts would otherwise
    leave an account that can sign in but has no name, no role and no
    academic year, and no screen in the app expects that.

    `role` is not taken from the form. It is fixed to 'student' here;
    teacher and admin accounts are made by an admin.
  */
  try {
    await transaction(async (tx) => {
      await tx.execute(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`, [
        userId,
        email,
        passwordHash,
      ]);
      await tx.execute(
        `INSERT INTO profiles (id, full_name, role, academic_year_id) VALUES (?, ?, 'student', ?)`,
        [userId, fullName, academicYearId]
      );
      await tx.execute(
        `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at)
         VALUES (?, ?, 'email_verify', ?, ?)`,
        [newId(), userId, tokenHash, toSql(new Date(Date.now() + VERIFY_TTL_MS))]
      );
    });
  } catch {
    return { error: "تعذّر إنشاء الحساب، حاول مجدداً" };
  }

  /*
    Sending mail must not fail the signup that already succeeded — the
    account exists either way. A dead SMTP box would otherwise surface as
    "could not create account" for an account that was created, and they
    would try again and hit "already registered" with no way forward.

    The landing page carries a resend button for exactly this case, which
    is why the failure is swallowed rather than surfaced here.
  */
  try {
    await sendVerificationEmail(email, token);
  } catch {
    // Recoverable: /verify-email can send it again.
  }

  return { error: null, redirectTo: `/verify-email?email=${encodeURIComponent(email)}` };
}

// ---------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------
export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalise(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "");

  if (!emailSchema(email)) return { error: "البريد الإلكتروني غير صالح" };
  if (!password) return { error: "الرجاء إدخال كلمة المرور" };

  /*
    Before the scrypt, not after.

    The whole cost of this action is the hash below, which runs even
    for an address that does not exist so that the two cases cannot be
    told apart by timing. Checking the brake afterwards would have
    already spent the CPU the brake exists to protect.
  */
  const brake = await rateLimit("signin", 20, 300, email);
  if (!brake.allowed) {
    return { error: `محاولات كثيرة. حاول بعد ${brake.retryAfterSeconds} ثانية.` };
  }

  const account = await queryOne<{
    id: string;
    password_hash: string;
    deleted_at: string | null;
    email_verified_at: string | null;
    google_sub: string | null;
  }>(
    `SELECT u.id, u.password_hash, u.email_verified_at, u.google_sub, p.deleted_at
       FROM users u
       JOIN profiles p ON p.id = u.id
      WHERE u.email = ?`,
    [email]
  );

  /*
    One message for "no such account", "wrong password" and "closed
    account", and the hash is verified even when there is no account.

    Both halves matter. Different messages let anyone enumerate who has
    registered; returning early on an unknown address leaks the same thing
    through timing, because the scrypt work is skipped and the response
    comes back measurably faster.
  */
  const stored = account?.password_hash ?? "scrypt$00$00";
  const ok = await verifyPassword(password, stored);

  if (!account || !ok || account.deleted_at !== null) {
    /*
      A DEAD END WORTH NAMING.

      An account created through Google is given the sentinel hash
      'scrypt$00$00' — a value no password can ever match, because it
      has no real salt. That is correct: a Google account has no
      password. But the reply was the same "wrong email or password"
      everyone else gets, so a student who signed up with Google and
      then tried to type a password was told, forever, that their
      password was wrong. There was no password. Nothing they could
      type would work and nothing told them why.

      Saying so leaks nothing they do not already know: they are
      holding the address and have just been refused, and the fix —
      press the Google button — is on the same screen.
    */
    if (account && account.google_sub !== null && account.password_hash === "scrypt$00$00") {
      return {
        error: "هذا الحساب أُنشئ عبر جوجل. اضغط «المتابعة باستخدام جوجل»، أو استعمل «نسيت كلمة المرور؟» لتعيين كلمة مرور.",
      };
    }
    return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
  }

  /*
    An unconfirmed address gets no session — but it is told so plainly and
    sent somewhere it can act, rather than bounced off the generic
    "wrong email or password". The enumeration concern above does not
    apply here: the password was already correct, so whoever is reading
    this message owns the account.
  */
  if (account.email_verified_at === null) {
    return { error: null, redirectTo: `/verify-email?email=${encodeURIComponent(email)}` };
  }

  // A correct password clears the budget: the limiter is aimed at
  // machines guessing, never at a student who mistyped twice.
  await rateLimitReset("signin", email);
  await createSession(account.id, await currentUserAgent());

  // Not redirect(): see the note on ActionState.
  return { error: null, redirectTo: redirectTo || "/dashboard" };
}

// ---------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------
export async function signOutAction(): Promise<void> {
  // No redirect() here either — SignOutButton navigates once this
  // resolves. Same reason as sign-in: see the note on ActionState.
  await destroySession();
}

// ---------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = normalise(String(formData.get("email") ?? ""));

  /*
    This one sends MAIL. Left open it is a way to have the platform
    deliver unlimited messages to an address the sender chose, which
    costs the SMTP quota and the domain's reputation as well as CPU.
    The generic reply below is returned either way, so the brake does
    not turn this into an account-existence oracle.
  */
  const brake = await rateLimit("reset", 5, 900, email);

  // The same generic reply in every branch below, including the invalid
  // address one — this endpoint must never reveal who has an account.
  const generic: ActionState = {
    error: null,
    success: "إذا كان البريد الإلكتروني مسجلاً لدينا، ستصلك رسالة لإعادة تعيين كلمة المرور.",
  };

  if (!emailSchema(email)) return generic;
  // Over the limit: the same reply, and no mail sent. Silent by design.
  if (!brake.allowed) return generic;

  const account = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [email]);
  if (!account) return generic;

  const { token, tokenHash } = createToken();

  /*
    Any earlier unused reset token is spent first. Two live links to the
    same account means a request the person abandoned stays usable for an
    hour, which is the window an attacker who reads one old email needs.
  */
  await execute(
    `UPDATE auth_tokens SET used_at = UTC_TIMESTAMP(3)
      WHERE user_id = ? AND purpose = 'password_reset' AND used_at IS NULL`,
    [account.id]
  );

  await execute(
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at)
     VALUES (?, ?, 'password_reset', ?, ?)`,
    [newId(), account.id, tokenHash, toSql(new Date(Date.now() + RESET_TTL_MS))]
  );

  try {
    await sendPasswordResetEmail(email, token);
  } catch {
    // Still generic: a mail failure must not become an oracle either.
  }

  return generic;
}

// ---------------------------------------------------------------------
// Reset password — reached from the emailed link, which carries the
// token as a query parameter that /reset-password puts in a hidden field.
// ---------------------------------------------------------------------
export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) return { error: "الرابط غير صالح أو منتهي الصلاحية" };
  if (password.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };
  if (password !== confirmPassword) return { error: "كلمتا المرور غير متطابقتين" };

  // Looked up by hash: the table stores no usable token, so a leaked
  // dump is not a set of working reset links.
  const row = await queryOne<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM auth_tokens
      WHERE token_hash = ? AND purpose = 'password_reset'
        AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3)`,
    [hashToken(token)]
  );

  if (!row) return { error: "الرابط غير صالح أو منتهي الصلاحية" };

  const passwordHash = await hashPassword(password);

  await transaction(async (tx) => {
    await tx.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, row.user_id]);
    await tx.execute(`UPDATE auth_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = ?`, [row.id]);
  });

  /*
    Every existing session is destroyed, not just this browser's.

    A password reset is what someone does when they think an account is
    compromised. Leaving whoever prompted it still signed in elsewhere
    would defeat the entire point of the reset.
  */
  await destroyAllSessions(row.user_id);

  return {
    error: null,
    success: "تم تعيين كلمة المرور. سجّل الدخول الآن.",
    redirectTo: "/login",
  };
}

// ---------------------------------------------------------------------
// Change password (while signed in — requires the current password so a
// stolen session alone cannot take the account over)
// ---------------------------------------------------------------------
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) return { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" };
  if (newPassword !== confirmPassword) return { error: "كلمتا المرور غير متطابقتين" };

  const user = await getSessionUser();
  if (!user) return { error: "الجلسة غير صالحة، الرجاء تسجيل الدخول مجدداً" };

  const account = await queryOne<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = ?`,
    [user.id]
  );
  if (!account) return { error: "الجلسة غير صالحة، الرجاء تسجيل الدخول مجدداً" };

  if (!(await verifyPassword(currentPassword, account.password_hash))) {
    return { error: "كلمة المرور الحالية غير صحيحة" };
  }

  await execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [
    await hashPassword(newPassword),
    user.id,
  ]);

  return { error: null, success: "تم تغيير كلمة المرور بنجاح" };
}

// ---------------------------------------------------------------------
// Update profile (name, avatar, academic year) — `role` is deliberately
// absent from the UPDATE. A trigger used to reject role changes by
// non-admins; with no trigger, the column simply is not written here.
// ---------------------------------------------------------------------
export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const academicYearId = String(formData.get("academicYearId") ?? "") || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!fullName) return { error: "الرجاء إدخال الاسم الكامل" };

  const user = await getSessionUser();
  if (!user) return { error: "الجلسة غير صالحة" };

  try {
    await execute(
      `UPDATE profiles SET full_name = ?, academic_year_id = ?, phone = ? WHERE id = ?`,
      [fullName, academicYearId, phone, user.id]
    );
  } catch {
    return { error: "تعذّر حفظ التعديلات" };
  }

  revalidatePath("/student/profile");
  return { error: null, success: "تم حفظ التعديلات" };
}

export async function resendVerificationEmailAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = normalise(String(formData.get("email") ?? ""));

  const generic: ActionState = {
    error: null,
    success: "إذا كان الحساب موجوداً، تم إرسال رسالة التحقق من جديد.",
  };

  if (!emailSchema(email)) return generic;

  const account = await queryOne<{ id: string; email_verified_at: string | null }>(
    `SELECT id, email_verified_at FROM users WHERE email = ?`,
    [email]
  );
  if (!account || account.email_verified_at !== null) return generic;

  const { token, tokenHash } = createToken();

  await execute(
    `UPDATE auth_tokens SET used_at = UTC_TIMESTAMP(3)
      WHERE user_id = ? AND purpose = 'email_verify' AND used_at IS NULL`,
    [account.id]
  );
  await execute(
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at)
     VALUES (?, ?, 'email_verify', ?, ?)`,
    [newId(), account.id, tokenHash, toSql(new Date(Date.now() + VERIFY_TTL_MS))]
  );

  try {
    await sendVerificationEmail(email, token);
  } catch {
    // Generic either way.
  }

  return generic;
}

// ---------------------------------------------------------------------
// The academic year, for accounts that arrived without one
// ---------------------------------------------------------------------

/**
 * Sets the signed-in student's academic year.
 *
 * WHY THIS EXISTS. The registration form has always demanded a year and
 * signUpAction has always refused without one. Google sign-in did not:
 * it creates a profile from the Google identity, which carries a name
 * and a picture and no idea what year of medicine anyone is in. Those
 * students then saw a library with almost nothing in it — folders are
 * scoped by year — and an empty study leaderboard, which reads as a
 * broken platform rather than a missing field.
 *
 * So the year is collected once, after the fact, and the student shell
 * will not render until it is set.
 *
 * The id is checked against academic_years rather than trusted: this
 * writes a foreign key from a form.
 */
export async function setAcademicYearAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "يجب تسجيل الدخول" };

  const academicYearId = String(formData.get("academicYearId") ?? "").trim();
  if (!academicYearId) return { error: "الرجاء اختيار السنة الدراسية" };

  const year = await queryOne<{ id: string }>(
    `SELECT id FROM academic_years WHERE id = ?`,
    [academicYearId]
  );
  if (!year) return { error: "السنة الدراسية غير صالحة" };

  await execute(`UPDATE profiles SET academic_year_id = ? WHERE id = ?`, [
    academicYearId,
    user.id,
  ]);

  return { error: null, redirectTo: "/dashboard" };
}
