import "server-only";
import {
  toChargilyAmount,
  fromChargilyAmount,
  mapChargilyStatus,
  verifyChargilySignature,
} from "@/lib/payment/chargily-logic";
import type {
  PaymentProvider,
  InitiateCheckoutInput,
  InitiateCheckoutResult,
  VerifyPaymentResult,
  WebhookParseResult,
} from "@/lib/payment/PaymentProvider";

/**
 * Chargily Pay v2.
 *
 * Written against the official API reference (dev.chargily.com/pay-v2):
 *   POST /checkouts        -> create, returns `checkout_url` + `id`
 *   GET  /checkouts/{id}   -> authoritative status
 *   webhooks               -> `signature` header, HMAC-SHA256 of the
 *                             RAW body keyed with the secret API key
 *
 * TWO THINGS THAT WILL BITE IF CHANGED:
 *
 * 1. AMOUNTS ARE IN CENTIMES. Chargily takes an integer in the
 *    currency's minor unit. Sending 5000 when you meant 5000 DZD sends
 *    50 DZD. The conversion happens once, here, at the boundary.
 *
 * 2. THE WEBHOOK BODY MUST BE READ RAW, before any JSON parsing. The
 *    signature covers the exact bytes Chargily sent; re-serialising a
 *    parsed object changes key order and whitespace and the HMAC will
 *    never match. handleWebhook() therefore reads text() first and
 *    parses only after the signature checks out.
 *
 * Test vs live mode is decided by which base URL and key are
 * configured — the same code path serves both, so a mode mix-up cannot
 * hide behind a branch.
 */

type ChargilyCheckout = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  checkout_url: string;
  [key: string]: unknown;
};

export type ChargilyConfig = {
  /** Secret key: `test_sk_...` or `live_sk_...`. */
  apiKey: string;
  /** Base URL — the test and live hosts differ, so this is explicit
   *  rather than derived from the key prefix. */
  baseUrl: string;
  /** Where Chargily should POST events. */
  webhookUrl?: string;
};

export class ChargilyPaymentProvider implements PaymentProvider {
  constructor(private config: ChargilyConfig) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Chargily API error (${res.status}): ${body.slice(0, 300) || res.statusText}`);
    }

    return (await res.json()) as T;
  }

  async initiate(input: InitiateCheckoutInput): Promise<InitiateCheckoutResult> {
    const checkout = await this.call<ChargilyCheckout>("/checkouts", {
      method: "POST",
      body: JSON.stringify({
        // DINARS, not centimes — see toChargilyAmount. Sending minor
        // units here charged a hundred times the price.
        amount: toChargilyAmount(input.amount),
        currency: input.currency.toLowerCase(),
        success_url: input.successUrl,
        failure_url: input.cancelUrl,
        ...(this.config.webhookUrl ? { webhook_endpoint: this.config.webhookUrl } : {}),
        description: input.description.slice(0, 255),
        locale: "ar",
        // The order id travels with the payment so a webhook can be tied
        // back to this platform's own record even if the provider
        // reference were ever lost.
        metadata: [{ order_id: input.orderId }],
      }),
    });

    if (!checkout.checkout_url || !checkout.id) {
      throw new Error("Chargily returned a checkout without a URL or id");
    }

    return { checkoutUrl: checkout.checkout_url, providerReference: checkout.id };
  }

  async verify(providerReference: string): Promise<VerifyPaymentResult> {
    const checkout = await this.call<ChargilyCheckout>(
      `/checkouts/${encodeURIComponent(providerReference)}`
    );

    return {
      status: mapChargilyStatus(String(checkout.status ?? "")),
      // Already in dinars, the unit the order is stored in — the caller
      // compares the two and refuses a mismatch.
      amount: fromChargilyAmount(Number(checkout.amount ?? 0)),
      currency: String(checkout.currency ?? "dzd").toUpperCase(),
      raw: checkout as Record<string, unknown>,
    };
  }

  async handleWebhook(request: Request): Promise<WebhookParseResult> {
    const signature = request.headers.get("signature");
    if (!signature) return null;

    // RAW body first — see the header note. Parsing before verifying
    // would break the HMAC and, worse, would mean acting on unverified
    // input.
    const rawBody = await request.text();

    if (!verifyChargilySignature(rawBody, signature, this.config.apiKey)) return null;

    let event: { id?: string; type?: string; data?: { id?: string } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return null;
    }

    const eventId = event.id;
    const eventType = event.type;
    const providerReference = event.data?.id;

    if (!eventId || !eventType || !providerReference) return null;

    return {
      eventId,
      eventType,
      providerReference,
      raw: event as Record<string, unknown>,
    };
  }
}
