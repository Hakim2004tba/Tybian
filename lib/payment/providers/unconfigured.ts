import "server-only";
import type {
  PaymentProvider,
  InitiateCheckoutInput,
  InitiateCheckoutResult,
  VerifyPaymentResult,
  WebhookParseResult,
} from "@/lib/payment/PaymentProvider";

/**
 * Deliberate placeholder implementation.
 *
 * This project's Architecture doc names Chargily Pay as the intended
 * gateway, but I do not have official Chargily API documentation or
 * credentials to implement `initiate()`/`verify()` against a real
 * endpoint — inventing request/response shapes for a payment gateway
 * would be actively harmful (silent integration failures, or worse,
 * a false sense of a working payment flow). Per the explicit
 * instruction for this phase, the provider implementation stays behind
 * the PaymentProvider abstraction until real documentation and
 * credentials are supplied.
 *
 * What DOES work today, fully, without needing the real API:
 *  - Order creation, idempotent order/payment status transitions, and
 *    enrollment creation — all provider-independent, all tested against
 *    real Postgres (see the migration's test notes).
 *  - The webhook Route Handler's shape, idempotency (payment_events
 *    unique constraint), and the "treat webhook as trigger, verify()
 *    as source of truth" pattern — ready to receive real events the
 *    moment `handleWebhook`/`verify` below are filled in.
 *
 * Credentials are still read from environment variables here (never
 * hardcoded) so that swapping in the real implementation later is a
 * pure code change with zero new configuration surface — see
 * .env.local.example.
 *
 * TO ACTIVATE: once Chargily (or another provider) documentation and
 * credentials are available, write `providers/chargily.ts` implementing
 * PaymentProvider for real, and change the single line in
 * lib/payment/index.ts.
 */
export class UnconfiguredPaymentProvider implements PaymentProvider {
  private providerName: string;

  constructor(providerName = "chargily") {
    this.providerName = providerName;
  }

  async initiate(_input: InitiateCheckoutInput): Promise<InitiateCheckoutResult> {
    void _input;
    throw new PaymentProviderNotConfiguredError(
      `Payment provider "${this.providerName}" is not yet configured — awaiting official API documentation and credentials. See lib/payment/providers/unconfigured.ts.`
    );
  }

  async verify(_providerReference: string): Promise<VerifyPaymentResult> {
    void _providerReference;
    throw new PaymentProviderNotConfiguredError(
      `Payment provider "${this.providerName}" is not yet configured — cannot verify payment status.`
    );
  }

  async handleWebhook(_request: Request): Promise<WebhookParseResult> {
    void _request;
    // No signature scheme to validate against yet — reject everything
    // rather than guess. The webhook Route Handler treats a null return
    // as "invalid/unrecognized", exactly as it would for a real provider
    // whose signature check failed.
    return null;
  }
}

export class PaymentProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderNotConfiguredError";
  }
}
