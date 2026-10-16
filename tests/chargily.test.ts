// Run with: node --experimental-strip-types tests/chargily.test.ts

import { createHmac } from "node:crypto";
import {
  toChargilyAmount,
  fromChargilyAmount,
  mapChargilyStatus,
  verifyChargilySignature,
} from "../lib/payment/chargily-logic.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  if (!ok) console.error(`FAIL: ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
}

// --- money -------------------------------------------------------------
// Chargily Pay v2 takes DINARS. These assertions were previously written
// the other way round — asserting a ×100 conversion that had never been
// checked against the gateway — so the suite passed while a 1200 DZD
// course was billed as 120,000 DZD. The figures below are the ones a
// real Chargily checkout page displays.
check("the amount is sent unchanged, in dinars", toChargilyAmount(1200), 1200);
check("5000 DZD is sent as 5000", toChargilyAmount(5000), 5000);
check("zero stays zero", toChargilyAmount(0), 0);
check("what comes back is already dinars", fromChargilyAmount(1200), 1200);
check("a round trip preserves the amount", fromChargilyAmount(toChargilyAmount(2500)), 2500);

// Fractions are refused, not rounded: charging a number the order never
// stated is the same class of bug as the ×100 overcharge.
check(
  "a fractional price is refused",
  (() => {
    try {
      toChargilyAmount(1999.5);
      return "no error";
    } catch {
      return "threw";
    }
  })(),
  "threw"
);

// --- status mapping ----------------------------------------------------
check("paid unlocks access", mapChargilyStatus("paid"), "success");
check("failed is failed", mapChargilyStatus("failed"), "failed");
check("canceled is failed", mapChargilyStatus("canceled"), "failed");
check("the British spelling is handled too", mapChargilyStatus("cancelled"), "failed");
check("expired is failed", mapChargilyStatus("expired"), "failed");
check("refunded is refunded", mapChargilyStatus("refunded"), "refunded");
check("pending stays pending", mapChargilyStatus("pending"), "pending");
check("case does not matter", mapChargilyStatus("PAID"), "success");

// The rule that protects paid content: anything unrecognised must NOT
// be treated as a successful payment.
check("an unknown status is pending, never success", mapChargilyStatus("processing"), "pending");
check("an empty status is pending", mapChargilyStatus(""), "pending");
check("garbage is pending", mapChargilyStatus("¯\\_(ツ)_/¯"), "pending");

// --- webhook signature -------------------------------------------------
const KEY = "test_sk_abc123";
const BODY = JSON.stringify({ id: "evt_1", type: "checkout.paid", data: { id: "chk_1" } });
const GOOD = createHmac("sha256", KEY).update(BODY).digest("hex");

check("a correct signature is accepted", verifyChargilySignature(BODY, GOOD, KEY), true);
check("a missing signature is rejected", verifyChargilySignature(BODY, null, KEY), false);
check("an empty signature is rejected", verifyChargilySignature(BODY, "", KEY), false);
check("a wrong signature is rejected", verifyChargilySignature(BODY, "0".repeat(64), KEY), false);
check("the wrong key is rejected",
  verifyChargilySignature(BODY, createHmac("sha256", "other_key").update(BODY).digest("hex"), KEY), false);

// A tampered body must fail even though the signature is well-formed —
// this is the whole point of signing.
const TAMPERED = JSON.stringify({ id: "evt_1", type: "checkout.paid", data: { id: "chk_HACKED" } });
check("a tampered body is rejected", verifyChargilySignature(TAMPERED, GOOD, KEY), false);

// Whitespace changes break the HMAC, which is why the raw body must be
// read before any JSON parse/re-serialise.
const RESERIALISED = JSON.stringify(JSON.parse(BODY), null, 2);
check("a re-serialised body no longer matches",
  verifyChargilySignature(RESERIALISED, GOOD, KEY), false);

// A short signature must be rejected, not crash: timingSafeEqual throws
// on a length mismatch, so the length is checked first.
check("a truncated signature is rejected without throwing",
  verifyChargilySignature(BODY, GOOD.slice(0, 10), KEY), false);
check("an over-long signature is rejected without throwing",
  verifyChargilySignature(BODY, GOOD + "ff", KEY), false);

console.log(`${pass} passed, ${fail} failed (${pass + fail} total assertions)`);
if (fail > 0) process.exit(1);
