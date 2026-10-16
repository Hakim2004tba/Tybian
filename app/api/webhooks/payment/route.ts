import { NextResponse } from "next/server";
import { execute, newId, queryOne } from "@/lib/db";
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

  /*
    Recording the event IS the duplicate check.

    uq_payment_events_provider_event survives the port as a plain unique
    key — it was never partial — so a redelivered event still fails the
    insert, and that failure is the signal to stop. MariaDB reports it as
    ER_DUP_ENTRY where Postgres said 23505.
  */
  try {
    await execute(
      `INSERT INTO payment_events (id, provider, event_type, provider_event_id, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [
        newId(),
        parsed.eventType.split(".")[0] || "chargily",
        parsed.eventType,
        parsed.eventId,
        JSON.stringify(parsed.raw),
      ]
    );
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      // Already recorded. completeOrderFromVerification is idempotent
      // too, but there is no reason to call verify() again for an event
      // we know we have processed.
      return NextResponse.json({ ok: true, note: "duplicate event, already processed" });
    }
    console.error("payment webhook: failed to record event", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  const payment = await queryOne<{ id: string; order_id: string | null }>(
    `SELECT id, order_id FROM payments WHERE provider_checkout_id = ?`,
    [parsed.providerReference]
  );

  if (!payment?.order_id) {
    // No matching payment/order — acknowledge so the provider doesn't
    // retry forever, but there's nothing to complete.
    return NextResponse.json({ ok: true, note: "no matching order" });
  }

  const verification = await paymentProvider.verify(parsed.providerReference);
  await completeOrderFromVerification(payment.order_id, verification, payment.id);

  return NextResponse.json({ ok: true });
}
