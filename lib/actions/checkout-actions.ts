"use server";

import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { paymentProvider } from "@/lib/payment";
import { initiateOrderPayment, completeOrderFromVerification } from "@/lib/actions/checkout";

export type PayNowState = { error: string | null; notConfigured?: boolean };

export async function payNowAction(
  orderId: string,
  courseSlug: string,
  _prev: PayNowState,
  _formData: FormData
): Promise<PayNowState> {
  const result = await initiateOrderPayment(orderId, courseSlug);

  if (result.ok) {
    redirect(result.checkoutUrl);
  }

  if (result.reason === "not_configured") {
    return { error: null, notConfigured: true };
  }

  return { error: result.message };
}

export type CheckStatusState = { error: string | null; enrolled?: boolean };

/**
 * The manual "تحقق من حالة الدفع" fallback.
 *
 * Runs the same verify()-then-complete pipeline the webhook uses, for
 * when a webhook delivery is delayed. It never grants access itself:
 * completeOrderFromVerification remains the only place an enrollment is
 * created, and it is still gated on the provider's server-side answer.
 *
 * `o.user_id = ?` is new and necessary. This is a server action, so its
 * arguments come from the browser — the Supabase version looked the
 * payment up by orderId alone, which let anyone holding an order id
 * trigger verification against someone else's order and learn from the
 * result whether it had been paid. The enrollment would still have gone
 * to the rightful owner, so this was an information leak rather than a
 * way to steal access, but there is no reason to leave it open.
 */
export async function checkPaymentStatusAction(
  orderId: string,
  _prev: CheckStatusState,
  _formData: FormData
): Promise<CheckStatusState> {
  const user = await getSessionUser();
  if (!user) return { error: "الرجاء تسجيل الدخول" };

  const payment = await queryOne<{ id: string; provider_checkout_id: string | null }>(
    `SELECT p.id, p.provider_checkout_id
       FROM payments p
       JOIN orders o ON o.id = p.order_id
      WHERE p.order_id = ? AND o.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT 1`,
    [orderId, user.id]
  );

  if (!payment?.provider_checkout_id) {
    return { error: "لم تبدأ عملية دفع لهذا الطلب بعد" };
  }

  try {
    const verification = await paymentProvider.verify(payment.provider_checkout_id);
    const result = await completeOrderFromVerification(orderId, verification, payment.id);
    return { error: null, enrolled: result.enrolled };
  } catch {
    return { error: "مزوّد الدفع غير مُهيّأ بعد — بانتظار الوثائق والبيانات الرسمية" };
  }
}
