import "server-only";

/**
 * PaymentProvider abstraction — every part of the app that needs to
 * talk to a payment gateway (checkout initiation, the webhook handler,
 * manual status verification) goes through THIS interface, never a
 * specific provider's SDK/API directly. Swapping providers, or filling
 * in the real implementation once official documentation and
 * credentials are provided, means writing one class in
 * `lib/payment/providers/` and changing the single wiring point in
 * `lib/payment/index.ts` — no call-site changes anywhere else.
 *
 * IMPORTANT: no concrete provider's API shape is assumed here. The
 * currently-wired implementation (`providers/unconfigured.ts`) is a
 * deliberate placeholder — see that file's doc comment for why, and
 * what changes once real API docs/credentials arrive.
 */

export type PaymentResultStatus = "pending" | "success" | "failed" | "refunded";

export type InitiateCheckoutInput = {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  customer: { email: string; name: string };
  /** Where the provider should redirect the browser after checkout. */
  successUrl: string;
  cancelUrl: string;
};

export type InitiateCheckoutResult = {
  /** The URL to redirect the student's browser to. */
  checkoutUrl: string;
  /** The provider's own identifier for this checkout/transaction —
   *  stored as payments.provider_checkout_id for idempotency and later
   *  lookup from the webhook. */
  providerReference: string;
};

export type VerifyPaymentResult = {
  status: PaymentResultStatus;
  amount: number;
  currency: string;
  /** Raw provider response, stored as-is for audit — business logic
   *  should only ever depend on the typed fields above. */
  raw: Record<string, unknown>;
};

export type WebhookParseResult = {
  /** Provider's unique id for THIS event (not the transaction) — used
   *  as the idempotency key in payment_events (unique(provider,
   *  provider_event_id), see 0005_commerce.sql). */
  eventId: string;
  eventType: string;
  providerReference: string;
  raw: Record<string, unknown>;
} | null; // null = signature invalid / not a recognized event — reject.

export interface PaymentProvider {
  /** Starts a checkout session and returns where to send the browser. */
  initiate(input: InitiateCheckoutInput): Promise<InitiateCheckoutResult>;

  /** Authoritative, server-to-server status check — the SOURCE OF TRUTH
   *  this whole architecture is built around. Webhooks are treated as
   *  "something happened, go check" triggers, never trusted directly for
   *  the actual status/amount — see lib/actions/checkout.ts. */
  verify(providerReference: string): Promise<VerifyPaymentResult>;

  /** Validates the webhook request (signature/secret — scheme is
   *  provider-specific and TBD) and extracts a normalized event, or
   *  returns null if the request doesn't pass validation. Does NOT
   *  itself update any database state — the caller (the webhook Route
   *  Handler) does that, using verify() as the source of truth. */
  handleWebhook(request: Request): Promise<WebhookParseResult>;
}
