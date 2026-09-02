import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paymentProvider } from "@/lib/payment";
import { completeOrderFromVerification } from "@/lib/actions/checkout";

/**
 * POST /api/webhooks/payment
 *
 * The ONLY place a payment provider's webhook reaches this app. Follows
 * the same "webhook as trigger, verify() as authoritative source of
 * truth" pattern as the Bunny Stream webhook (app/api/webhooks/bunny) —
 * the webhook body's claimed status is never trusted directly; this
 * handler always calls back to the provider's verify() endpoint before
 * touching any database state that grants access.
 *
 * Idempotency: `payment_events` has `unique(provider, provider_event_id)`
 * (0005_commerce.sql) — a duplicate delivery of the same event fails
 * that insert and this handler returns 200 immediately without
 * reprocessing. `completeOrderFromVerification` provides a second,
 * independent idempotency layer at the order/enrollment level (see its
 * doc comment) in case two DIFFERENT events both point at the same
 * order (e.g. a retried checkout).
 */
export async function POST(request: Request) {
  const parsed = await paymentProvider.handleWebhook(request);

  if (!parsed) {
    // Either signature validation failed, or (today) no provider is
    // configured at all — paymentProvider.handleWebhook always returns
    // null until a real provider is wired in. Either way: reject.
    return NextResponse.json({ error: "invalid_webhook" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { error: eventInsertError } = await admin.from("payment_events").insert({
    provider: parsed.eventType.split(".")[0] || "chargily",
    event_type: parsed.eventType,
    provider_event_id: parsed.eventId,
    payload: parsed.raw,
  });

  if (eventInsertError) {
    if ((eventInsertError as { code?: string }).code === "23505") {
      // Duplicate delivery of an event we've already recorded — ack and
      // stop. Do NOT reprocess; completeOrderFromVerification is also
      // idempotent on its own, but there's no reason to call the
      // provider's verify() endpoint again for a known-duplicate event.
      return NextResponse.json({ ok: true, note: "duplicate event, already processed" });
    }
    console.error("payment webhook: failed to record event", eventInsertError);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id")
    .eq("provider_checkout_id", parsed.providerReference)
    .maybeSingle();

  if (!payment?.order_id) {
    // No matching payment/order — acknowledge so the provider doesn't
    // retry forever, but there's nothing to complete.
    return NextResponse.json({ ok: true, note: "no matching order" });
  }

  const verification = await paymentProvider.verify(parsed.providerReference);
  await completeOrderFromVerification(payment.order_id, verification, payment.id);

  return NextResponse.json({ ok: true });
}
