"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
 * Manual "تحقق من حالة الدفع" fallback — calls the SAME server-side
 * verify()-then-complete pipeline the webhook uses. Useful if a webhook
 * delivery is delayed, or (once a real provider is wired) as a safety
 * net on the return-from-checkout page. Never grants access itself;
 * completeOrderFromVerification is still the only place enrollment is
 * created, and it's still gated on verify()'s server-side answer.
 */
export async function checkPaymentStatusAction(
  orderId: string,
  _prev: CheckStatusState,
  _formData: FormData
): Promise<CheckStatusState> {
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, provider_checkout_id")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
