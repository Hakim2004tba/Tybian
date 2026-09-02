import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { paymentProvider, type VerifyPaymentResult } from "@/lib/payment";
import { PaymentProviderNotConfiguredError } from "@/lib/payment/providers/unconfigured";

export type PlanType = "three_months" | "lifetime";

export type CheckoutOrder = {
  id: string;
  courseId: string;
  planType: PlanType;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "expired";
};

export type GetOrCreateOrderResult =
  | { kind: "already_enrolled" }
  | { kind: "order"; order: CheckoutOrder };

/**
 * Step 1–2 of the flow (Course → Pricing → Checkout): finds or creates
 * the pending order for this student/course/plan.
 *
 * Idempotent by construction, not by convention: `uq_orders_pending_user_course_plan`
 * (0016_checkout_orders.sql) makes a second concurrent INSERT for the
 * same (user, course, plan) fail at the database level, so even a
 * double form-submit or a page double-render can't create two pending
 * orders — this function just needs to check-then-reuse-or-create, and
 * the constraint is what actually guarantees correctness under a race.
 */
export async function getOrCreatePendingOrder(
  courseId: string,
  planType: PlanType
): Promise<GetOrCreateOrderResult | { kind: "error"; message: string }> {
  const user = await getSessionUser();
  if (!user) return { kind: "error", message: "الرجاء تسجيل الدخول أولاً" };

  const supabase = await createClient();

  // Already enrolled? Don't let them buy the same course twice.
  const { data: activeEnrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .maybeSingle();

  if (activeEnrollment) return { kind: "already_enrolled" };

  // Reuse an existing non-expired pending order rather than creating a
  // new one (avoids order clutter on page refresh, and the unique index
  // would reject a duplicate anyway).
  const { data: existing } = await supabase
    .from("orders")
    .select("id, course_id, plan_type, amount, currency, status, expires_at")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .eq("plan_type", planType)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    if (new Date(existing.expires_at) > new Date()) {
      return { kind: "order", order: toCheckoutOrder(existing) };
    }
    // Stale pending order past its checkout window — expire it lazily
    // (no background job in this phase) and fall through to create a
    // fresh one below.
    await supabase.from("orders").update({ status: "expired" }).eq("id", existing.id);
  }

  const { data: priceRow } = await supabase
    .from("course_prices")
    .select("price, currency")
    .eq("course_id", courseId)
    .eq("plan_type", planType)
    .eq("is_active", true)
    .maybeSingle();

  if (!priceRow) return { kind: "error", message: "السعر غير متاح لهذه الخطة حالياً" };

  const { data: created, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      course_id: courseId,
      plan_type: planType,
      amount: priceRow.price,
      currency: priceRow.currency,
    })
    .select("id, course_id, plan_type, amount, currency, status")
    .single();

  if (error || !created) {
    // A concurrent request may have won the unique-index race between
    // our check above and this insert — re-fetch rather than fail.
    const { data: raceWinner } = await supabase
      .from("orders")
      .select("id, course_id, plan_type, amount, currency, status")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("plan_type", planType)
      .eq("status", "pending")
      .maybeSingle();
    if (raceWinner) return { kind: "order", order: toCheckoutOrder(raceWinner) };
    return { kind: "error", message: "تعذّر إنشاء الطلب" };
  }

  return { kind: "order", order: toCheckoutOrder(created) };
}

function toCheckoutOrder(row: {
  id: string;
  course_id: string;
  plan_type: string;
  amount: number | string;
  currency: string;
  status: string;
}): CheckoutOrder {
  return {
    id: row.id,
    courseId: row.course_id,
    planType: row.plan_type as PlanType,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status as CheckoutOrder["status"],
  };
}

export type InitiatePaymentResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; reason: "not_configured" | "error"; message: string };

/**
 * Step 3 (Checkout → Payment): calls the PaymentProvider to start a
 * real checkout session. With no provider configured yet, this always
 * returns `{ ok: false, reason: "not_configured" }` — the order itself
 * still exists in the database either way, proving the flow works up to
 * the provider boundary.
 */
export async function initiateOrderPayment(orderId: string, courseSlug: string): Promise<InitiatePaymentResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, reason: "error", message: "الرجاء تسجيل الدخول أولاً" };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, amount, currency, status, course_id, plan_type, courses ( title )")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) return { ok: false, reason: "error", message: "الطلب غير موجود" };
  if (order.status !== "pending") return { ok: false, reason: "error", message: "هذا الطلب لم يعد قابلاً للدفع" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const courseTitle = (order.courses as unknown as { title: string } | { title: string }[] | null);
  const title = Array.isArray(courseTitle) ? courseTitle[0]?.title : courseTitle?.title;

  try {
    const result = await paymentProvider.initiate({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      description: title ?? "اشتراك تبيان",
      customer: { email: user.email ?? "", name: user.email ?? "طالب" },
      successUrl: `${siteUrl}/checkout/${courseSlug}/return?order=${order.id}`,
      cancelUrl: `${siteUrl}/checkout/${courseSlug}?order=${order.id}&cancelled=1`,
    });

    await supabase.from("payments").insert({
      user_id: user.id,
      course_id: order.course_id,
      plan_type: order.plan_type,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
      provider: "chargily",
      provider_checkout_id: result.providerReference,
      status: "pending",
    });

    return { ok: true, checkoutUrl: result.checkoutUrl };
  } catch (err) {
    if (err instanceof PaymentProviderNotConfiguredError) {
      return { ok: false, reason: "not_configured", message: err.message };
    }
    return { ok: false, reason: "error", message: "تعذّر بدء عملية الدفع" };
  }
}

/**
 * Step 5–6 (server-side verification → enrollment). This is THE
 * function that decides whether a student actually gets access — never
 * the frontend, never a client-supplied "success" flag. Called from the
 * webhook handler (the primary path) and from the manual
 * "تحقق من حالة الدفع" fallback action, both server-side, both using
 * service_role since neither runs in a normal user session context.
 *
 * Idempotent: the `UPDATE orders SET status='paid' WHERE status='pending'`
 * only ever succeeds once per order — a second call (duplicate webhook,
 * or webhook + manual check both firing) finds 0 matching rows and
 * exits without touching enrollments again. The enrollments unique
 * constraint (uq_enrollments_active_user_course) is the second,
 * independent layer of the same guarantee — see
 * AUTHORIZATION_TEST_RESULTS-style verification in this phase's test
 * notes.
 */
export async function completeOrderFromVerification(
  orderId: string,
  verification: VerifyPaymentResult,
  paymentId: string | null
): Promise<{ enrolled: boolean }> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, course_id, plan_type, amount")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { enrolled: false };

  if (verification.status !== "success") {
    await admin.from("orders").update({ status: "failed" }).eq("id", orderId).eq("status", "pending");
    if (paymentId) await admin.from("payments").update({ status: verification.status }).eq("id", paymentId);
    return { enrolled: false };
  }

  // Sanity check: the amount actually paid must match what the order
  // expected — a mismatch here means something is wrong upstream and we
  // should NOT grant access even though the provider says "success".
  if (Math.abs(verification.amount - Number(order.amount)) > 0.01) {
    await admin.from("orders").update({ status: "failed" }).eq("id", orderId).eq("status", "pending");
    if (paymentId) await admin.from("payments").update({ status: "failed" }).eq("id", paymentId);
    return { enrolled: false };
  }

  // The idempotency gate: only the FIRST call for a given order gets
  // past this point and creates an enrollment.
  const { data: transitioned } = await admin
    .from("orders")
    .update({ status: "paid" })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (paymentId) {
    await admin.from("payments").update({ status: "success" }).eq("id", paymentId);
  }

  if (!transitioned) {
    // Already processed by an earlier call — idempotent no-op.
    return { enrolled: true };
  }

  const expiresAt =
    order.plan_type === "lifetime"
      ? null
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { error: enrollError } = await admin.from("enrollments").insert({
    user_id: order.user_id,
    course_id: order.course_id,
    plan_type: order.plan_type,
    source: "purchase",
    expires_at: expiresAt,
  });

  // 23505 = unique_violation — the belt-and-suspenders layer:
  // uq_enrollments_active_user_course would only fire here if the
  // student somehow already had an active enrollment from another path
  // (e.g. an admin_grant race), which is still a successful outcome
  // (they have access) and must not surface as an error.
  if (enrollError && (enrollError as { code?: string }).code !== "23505") {
    console.error("completeOrderFromVerification: enrollment insert failed", enrollError);
    return { enrolled: false };
  }

  return { enrolled: true };
}
