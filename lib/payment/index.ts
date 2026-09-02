import "server-only";
import type { PaymentProvider } from "@/lib/payment/PaymentProvider";
import { UnconfiguredPaymentProvider } from "@/lib/payment/providers/unconfigured";

export type { VerifyPaymentResult, PaymentResultStatus } from "@/lib/payment/PaymentProvider";

/**
 * Single wiring point for the payment provider — every Server Action
 * and Route Handler imports `paymentProvider` from here and never
 * references a concrete provider class directly.
 *
 * TO ACTIVATE THE REAL PROVIDER: once official API documentation and
 * credentials are available, replace the line below with e.g.
 * `new ChargilyPaymentProvider({ apiKey: process.env.CHARGILY_API_KEY!, ... })`
 * — nothing else in the codebase needs to change.
 */
export const paymentProvider: PaymentProvider = new UnconfiguredPaymentProvider("chargily");
