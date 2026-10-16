/**
 * The parts of the Chargily integration that are decidable without a
 * network call — extracted so they can be unit-tested
 * (tests/chargily.test.ts). Money conversion and signature checking are
 * exactly the places where a silent bug is expensive, so they do not
 * live only inside an un-runnable class.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentResultStatus } from "@/lib/payment/PaymentProvider";

/**
 * The amount to send Chargily, in DINARS.
 *
 * THE BUG THIS FIXES: this used to multiply by 100, on the assumption
 * that the API took centimes the way Stripe takes cents. It does not —
 * Chargily Pay v2 takes DZD directly. A course priced at 1200 DZD
 * reached the checkout page as 120,000.00 دج: a hundredfold overcharge,
 * caught only because the amount was read on the real payment page.
 *
 * The assumption was never verified against Chargily's documentation,
 * and the unit test asserted the guess rather than the behaviour, so the
 * test passed and agreed with the bug. Do not change this without a
 * checkout page confirming the figure.
 *
 * DZD amounts must be whole dinars — the API rejects fractions. A
 * fractional price is refused here rather than rounded: rounding would
 * charge a number the order never said, which is the same class of
 * silent money bug as the one above.
 */
export function toChargilyAmount(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }
  if (!Number.isInteger(amount)) {
    throw new Error(
      `Chargily accepts whole dinars only; the order is ${amount} DZD. ` +
        `Set the course price to a whole number.`
    );
  }
  return amount;
}

/**
 * The amount Chargily reports back, in dinars — the same unit the order
 * is stored in, so the caller compares them directly. Kept as a named
 * function rather than dropped: it is the one place to change if
 * Chargily's unit ever does differ per currency.
 */
export function fromChargilyAmount(amount: number): number {
  return amount;
}

/**
 * Unknown statuses map to "pending", never "success". A status this code
 * does not recognise must not unlock a paid course.
 */
export function mapChargilyStatus(status: string): PaymentResultStatus {
  switch (String(status).toLowerCase()) {
    case "paid":
      return "success";
    case "failed":
    case "canceled":
    case "cancelled":
    case "expired":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return "pending";
  }
}

/**
 * HMAC-SHA256 of the RAW body, keyed with the secret API key, compared
 * in constant time.
 *
 * Constant time matters here specifically: a plain `===` returns faster
 * the earlier it finds a mismatch, which leaks how much of a forged
 * signature was right and lets an attacker build one byte at a time —
 * against an endpoint that grants paid access.
 */
export function verifyChargilySignature(
  rawBody: string,
  signature: string | null,
  apiKey: string
): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", apiKey).update(rawBody).digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");

  // Length check first: timingSafeEqual throws on a length mismatch.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
