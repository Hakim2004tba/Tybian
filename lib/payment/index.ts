import "server-only";
import type { PaymentProvider } from "@/lib/payment/PaymentProvider";
import { UnconfiguredPaymentProvider } from "@/lib/payment/providers/unconfigured";
import { ChargilyPaymentProvider } from "@/lib/payment/providers/chargily";

export type { VerifyPaymentResult, PaymentResultStatus } from "@/lib/payment/PaymentProvider";

/**
 * Single wiring point for the payment provider — every Server Action and
 * Route Handler imports `paymentProvider` from here and never references
 * a concrete provider class directly.
 *
 * Chargily is used when a key is configured; otherwise the placeholder
 * stays wired. That fallback is deliberate: a half-configured gateway
 * that throws mid-checkout is worse than one that says plainly it is not
 * set up, and it keeps local development running with no credentials.
 *
 * CHARGILY_BASE_URL decides test vs live. It is required rather than
 * inferred from the key prefix, because "we thought we were in test
 * mode" is how real cards get charged during a demo.
 */
/**
 * Which mode a key and a base URL each claim to be in.
 *
 * Chargily encodes the mode twice: in the key prefix (`test_sk_…` /
 * `live_sk_…`) and in the base URL (`/test/api/v2` vs `/api/v2`). They
 * must agree. A live key sent to the test endpoint — or the reverse —
 * fails in ways that look like anything but a configuration mistake,
 * and the switch from test to live is exactly when a half-updated
 * `.env.local` happens.
 */
function modeOfKey(key: string): "test" | "live" | "unknown" {
  if (key.startsWith("test_")) return "test";
  if (key.startsWith("live_")) return "live";
  return "unknown";
}

function modeOfUrl(url: string): "test" | "live" {
  return /\/test\//.test(url) ? "test" : "live";
}

function buildProvider(): PaymentProvider {
  const apiKey = process.env.CHARGILY_API_KEY;
  const baseUrl = process.env.CHARGILY_BASE_URL;

  if (!apiKey || !baseUrl) return new UnconfiguredPaymentProvider("chargily");

  /*
    Refuse a mismatched pair rather than charging through it. Staying
    unconfigured makes the checkout say "payments are not enabled",
    which is recoverable; sending a live key to the test endpoint is
    not, and the error it produces points nowhere near the cause.
  */
  const keyMode = modeOfKey(apiKey);
  const urlMode = modeOfUrl(baseUrl);
  if (keyMode !== "unknown" && keyMode !== urlMode) {
    console.error(
      `[payment] CHARGILY_API_KEY is a ${keyMode} key but CHARGILY_BASE_URL points at ` +
        `${urlMode} (${baseUrl}). Payments are disabled until both name the same mode. ` +
        `test: https://pay.chargily.net/test/api/v2 — live: https://pay.chargily.net/api/v2`
    );
    return new UnconfiguredPaymentProvider("chargily");
  }

  return new ChargilyPaymentProvider({
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    webhookUrl: process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/api/webhooks/payment`
      : undefined,
  });
}

export const paymentProvider: PaymentProvider = buildProvider();

/**
 * Whether a real gateway is wired — lets the checkout UI say "payments
 * are not enabled yet" instead of failing at the last step.
 *
 * Derived from the provider that was actually built, NOT from whether
 * the two variables are merely present. Those are not the same thing:
 * a mismatched key/URL pair leaves the placeholder provider wired, and
 * reading the env directly would have told the checkout that payments
 * were live while every attempt threw.
 */
export const isPaymentConfigured = paymentProvider instanceof ChargilyPaymentProvider;

/**
 * Which Chargily mode is actually in force: "test", "live", or null
 * when no real gateway is wired (missing variables, or a mismatched
 * pair the guard above refused).
 */
export function paymentMode(): "test" | "live" | null {
  if (!isPaymentConfigured) return null;
  return modeOfUrl(process.env.CHARGILY_BASE_URL!);
}
