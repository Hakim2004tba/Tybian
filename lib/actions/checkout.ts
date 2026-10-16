import "server-only";
import { refreshCourseStudents } from "@/lib/data/counters";
import { expiryFor } from "@/lib/plans/duration";
import { execute, newId, queryOne, toSql, transaction } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { applyPromo, promoMessage, type Coupon } from "@/lib/promo/apply";
import { enrollPackCourses } from "@/lib/actions/pack-checkout";
import { paymentProvider, type VerifyPaymentResult } from "@/lib/payment";
import { PaymentProviderNotConfiguredError } from "@/lib/payment/providers/unconfigured";
import { notify } from "@/lib/notify";
import { couponColumns } from "@/lib/promo/lookup";

export type PlanType = "three_months" | "lifetime";

export type CheckoutOrder = {
  id: string;
  courseId: string;
  planType: PlanType;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "expired";
};

export type GetOrCreateOrderResult =
  | { kind: "already_enrolled" }
  | { kind: "order"; order: CheckoutOrder };

const CHECKOUT_WINDOW_MINUTES = 30;
/*
  The duration is no longer a constant here.

  It lives on the price row (course_prices.duration_days) so an admin
  can sell three months, six, or a year without a code change — see
  tibyan-db/mysql/10-plan-duration.sql. This fallback covers the one
  case the column cannot: a price row written before that migration ran
  and never re-saved, which would otherwise read as lifetime and give
  away permanent access to a limited plan.
*/
const FALLBACK_LIMITED_DAYS = 90;

/**
 * Checkout.
 *
 * Two of this flow's correctness guarantees were PARTIAL unique indexes
 * in Postgres, and MariaDB has no partial indexes — so neither exists in
 * the schema any more and neither can be relied on:
 *
 *   uq_orders_pending_user_course_plan   one pending order per
 *                                        (user, course, plan)
 *   uq_enrollments_active_user_course    one active enrollment per
 *                                        (user, course)
 *
 * The old code leaned on both explicitly: "the constraint is what
 * actually guarantees correctness under a race", and it caught 23505 as
 * the second layer behind the enrollment insert. Those errors will never
 * arrive now.
 *
 * What replaces them is SELECT ... FOR UPDATE inside a transaction. The
 * lock is taken on the row that decides the outcome, so a second
 * concurrent request waits rather than racing — which is what the unique
 * index was doing, just at a different layer.
 *
 * There is no service_role client any longer. Every function here runs
 * with full database access, which is exactly why the ownership checks
 * are written out rather than assumed.
 */

export async function getOrCreatePendingOrder(
  courseId: string,
  planType: PlanType,
  /**
   * A promo code the student typed. Only its TEXT comes from the
   * browser — the discount it is worth is read from the coupons table
   * and computed here, exactly as the price is. A client that could
   * name its own discount is a client that pays what it likes.
   */
  promoCode?: string
): Promise<GetOrCreateOrderResult | { kind: "error"; message: string }> {
  const user = await getSessionUser();
  if (!user) return { kind: "error", message: "الرجاء تسجيل الدخول أولاً" };

  try {
    return await transaction(async (tx) => {
      // Already enrolled? Do not let them buy the same course twice.
      const [enrolled] = await tx.execute<never[] & { length: number }>(
        `SELECT id FROM enrollments
          WHERE user_id = ? AND course_id = ?
            AND deleted_at IS NULL
            AND starts_at <= UTC_TIMESTAMP(3)
            AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))
          LIMIT 1`,
        [user.id, courseId]
      );
      if ((enrolled as unknown[]).length > 0) return { kind: "already_enrolled" as const };

      /*
        FOR UPDATE is what replaces uq_orders_pending_user_course_plan.

        Without it, two submits of the same form both read "no pending
        order" and both insert one — the student is shown one order while
        a second sits in the database, and a later webhook can settle
        against the wrong one. The lock makes the second request wait
        until the first has committed, so it sees the order that was just
        created and reuses it.
      */
      const [pendingRows] = await tx.execute(
        `SELECT id, course_id, plan_type, amount, currency, status, expires_at, coupon_id
           FROM orders
          WHERE user_id = ? AND course_id = ? AND plan_type = ? AND status = 'pending'
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE`,
        [user.id, courseId, planType]
      );

      const existing = (pendingRows as OrderRow[])[0];

      if (existing) {
        /*
          A pending order is reused only while it still says what the
          student is now asking for. Typing a code against an order
          created without one has to produce a NEW order at the new
          amount — reusing the old row would show the discount in the
          page and charge the old price at the gateway.
        */
        const wantsCode = Boolean(promoCode?.trim());
        const orderHasCode = Boolean(existing.coupon_id);
        const codeSituationChanged = wantsCode !== orderHasCode;

        if (!codeSituationChanged && new Date(existing.expires_at + "Z") > new Date()) {
          return { kind: "order" as const, order: toCheckoutOrder(existing) };
        }
        // Past its window, or superseded by a code change — expire it
        // lazily (there is no background job) and make a fresh one.
        await tx.execute(`UPDATE orders SET status = 'expired' WHERE id = ?`, [existing.id]);
      }

      const [priceRows] = await tx.execute(
        `SELECT price, currency FROM course_prices
          WHERE course_id = ? AND plan_type = ? AND is_active = 1
          LIMIT 1`,
        [courseId, planType]
      );
      const price = (priceRows as { price: string; currency: string }[])[0];
      if (!price) {
        return { kind: "error" as const, message: "السعر غير متاح لهذه الخطة حالياً" };
      }

      /* ---- the promo code, priced on the server ---- */
      let couponId: string | null = null;
      let discount = 0;
      let amount = Math.round(Number(price.price));

      const typed = promoCode?.trim().toUpperCase();
      if (typed) {
        const [couponRows] = await tx.execute(
          `SELECT ${await couponColumns()}
             FROM coupons
            WHERE UPPER(code) = ? AND deleted_at IS NULL
            LIMIT 1`,
          [typed]
        );
        const coupon = (couponRows as Coupon[])[0] ?? null;

        const [usedRows] = await tx.execute(
          `SELECT 1 FROM coupon_usage
            WHERE coupon_id = ? AND user_id = ? LIMIT 1`,
          [coupon?.id ?? "", user.id]
        );
        const alreadyUsed = (usedRows as unknown[]).length > 0;

        const outcome = applyPromo(
          coupon,
          amount,
          { kind: "course", id: courseId },
          new Date(),
          alreadyUsed
        );
        if (!outcome.ok) {
          return { kind: "error" as const, message: promoMessage(outcome.reason) };
        }

        couponId = coupon!.id;
        discount = outcome.discount;
        amount = outcome.finalAmount;
      }

      const id = newId();
      /*
        The price is read from course_prices here and never accepted from
        the caller. An amount that came in from the client would let
        someone check out a 5000 DA course for 1 DA — the provider would
        confirm the payment honestly, and the amount check in
        completeOrderFromVerification would agree, because both would be
        comparing against the number the buyer chose.
      */
      await tx.execute(
        `INSERT INTO orders
           (id, user_id, course_id, plan_type, amount, currency,
            coupon_id, discount_amount, idempotency_key, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? MINUTE))`,
        [id, user.id, courseId, planType, amount, price.currency,
         couponId, discount, newId(), CHECKOUT_WINDOW_MINUTES]
      );

      return {
        kind: "order" as const,
        order: {
          id,
          courseId,
          planType,
          amount,
          currency: price.currency,
          status: "pending" as const,
        },
      };
    });
  } catch {
    return { kind: "error", message: "تعذّر إنشاء الطلب" };
  }
}

type OrderRow = {
  id: string;
  course_id: string;
  plan_type: string;
  amount: string;
  currency: string;
  status: string;
  expires_at: string;
  coupon_id: string | null;
};

function toCheckoutOrder(row: Omit<OrderRow, "expires_at"> & { expires_at?: string }): CheckoutOrder {
  return {
    id: row.id,
    courseId: row.course_id,
    planType: row.plan_type as PlanType,
    // DECIMAL(10,2) arrives as a string precisely so the cents survive;
    // this is the one place it becomes a number, for display.
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status as CheckoutOrder["status"],
  };
}

export type InitiatePaymentResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; reason: "not_configured" | "error"; message: string };

/**
 * Starts a provider checkout session for an order.
 *
 * `user_id = ?` in the lookup is the ownership check: without it, anyone
 * could start a payment session against somebody else's order and read
 * its amount and course back out of the result.
 */
export async function initiateOrderPayment(
  orderId: string,
  courseSlug: string
): Promise<InitiatePaymentResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, reason: "error", message: "الرجاء تسجيل الدخول أولاً" };

  const order = await queryOne<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    course_id: string;
    plan_type: PlanType;
    course_title: string | null;
  }>(
    `SELECT o.id, o.amount, o.currency, o.status, o.course_id, o.plan_type,
            c.title AS course_title
       FROM orders o
       LEFT JOIN courses c ON c.id = o.course_id
      WHERE o.id = ? AND o.user_id = ?`,
    [orderId, user.id]
  );

  if (!order) return { ok: false, reason: "error", message: "الطلب غير موجود" };
  if (order.status !== "pending") {
    return { ok: false, reason: "error", message: "هذا الطلب لم يعد قابلاً للدفع" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const result = await paymentProvider.initiate({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      description: order.course_title ?? "اشتراك تبيان",
      customer: { email: user.email ?? "", name: user.email ?? "طالب" },
      successUrl: `${siteUrl}/checkout/${courseSlug}/return?order=${order.id}`,
      cancelUrl: `${siteUrl}/checkout/${courseSlug}?order=${order.id}&cancelled=1`,
    });

    await execute(
      `INSERT INTO payments
         (id, user_id, course_id, order_id, plan_type, amount, currency,
          provider, provider_checkout_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'chargily', ?, 'pending')`,
      [
        newId(),
        user.id,
        order.course_id,
        order.id,
        order.plan_type,
        order.amount,
        order.currency,
        result.providerReference,
      ]
    );

    return { ok: true, checkoutUrl: result.checkoutUrl };
  } catch (err) {
    if (err instanceof PaymentProviderNotConfiguredError) {
      return { ok: false, reason: "not_configured", message: err.message };
    }
    return { ok: false, reason: "error", message: "تعذّر بدء عملية الدفع" };
  }
}

/**
 * THE function that decides whether a student gets access.
 *
 * Never the frontend, never a client-supplied "success" flag. Called
 * from the webhook handler and from the manual "تحقق من حالة الدفع"
 * fallback, both server-side, both after verify() has answered.
 *
 * Idempotency now rests entirely on one statement:
 *
 *   UPDATE orders SET status='paid' WHERE id=? AND status='pending'
 *
 * affectedRows is 1 for exactly one caller and 0 for every other, so a
 * duplicate webhook — which every provider sends sooner or later — grants
 * the enrollment once. In Postgres this had a second, independent layer
 * behind it: uq_enrollments_active_user_course would reject a duplicate
 * enrollment even if the gate somehow let two callers through, and the
 * old code caught 23505 for exactly that. That index cannot exist here,
 * so the whole transaction is serialised on the order row instead, and
 * the enrollment is re-checked inside it.
 */
export async function completeOrderFromVerification(
  orderId: string,
  verification: VerifyPaymentResult,
  paymentId: string | null
): Promise<{ enrolled: boolean }> {
  try {
    return await transaction(async (tx) => {
      const [orderRows] = await tx.execute(
        `SELECT id, user_id, course_id, pack_id, plan_type, amount, status, coupon_id
           FROM orders WHERE id = ? FOR UPDATE`,
        [orderId]
      );
      const order = (orderRows as {
        id: string;
        user_id: string;
        course_id: string | null;
        pack_id: string | null;
        plan_type: PlanType;
        amount: string;
        status: string;
        coupon_id: string | null;
      }[])[0];

      if (!order) return { enrolled: false };

      const fail = async (paymentStatus: "failed" | VerifyPaymentResult["status"]) => {
        await tx.execute(`UPDATE orders SET status = 'failed' WHERE id = ? AND status = 'pending'`, [
          orderId,
        ]);
        if (paymentId) {
          await tx.execute(`UPDATE payments SET status = ? WHERE id = ?`, [paymentStatus, paymentId]);
        }
        return { enrolled: false };
      };

      if (verification.status !== "success") {
        return fail(verification.status);
      }

      /*
        The amount actually paid must match what the order expected.

        Compared with a tolerance of one centime rather than exactly,
        because the provider returns a float and the column is DECIMAL —
        an exact comparison would reject correct payments over binary
        rounding. A real mismatch means something upstream is wrong and
        access must NOT be granted even though the provider says success.
      */
      if (Math.abs(verification.amount - Number(order.amount)) > 0.01) {
        return fail("failed");
      }

      // The gate. Only the first caller for this order gets past it.
      const [result] = await tx.execute(
        `UPDATE orders SET status = 'paid' WHERE id = ? AND status = 'pending'`,
        [orderId]
      );
      const won = (result as { affectedRows: number }).affectedRows === 1;

      if (paymentId) {
        await tx.execute(`UPDATE payments SET status = 'success' WHERE id = ?`, [paymentId]);
      }

      // Already settled by an earlier call — idempotent no-op. The
      // student has access; saying otherwise would send a paying
      // customer to a "payment failed" page.
      if (!won) return { enrolled: true };

      /*
        The promo code is spent HERE, not when the order was created.

        A code counted at checkout time would be burned by every student
        who typed it and then closed the tab — a club's fifty uses gone
        with nobody having paid. Recording it behind the same `won` gate
        that grants access means a code is consumed exactly when money
        is, and exactly once: the gate is the single-winner UPDATE above.
      */
      if (order.coupon_id) {
        await tx.execute(
          `INSERT INTO coupon_usage (id, coupon_id, user_id, payment_id) VALUES (?, ?, ?, ?)`,
          [newId(), order.coupon_id, order.user_id, paymentId]
        );
        await tx.execute(
          `UPDATE coupons SET uses_count = uses_count + 1 WHERE id = ?`,
          [order.coupon_id]
        );
      }

      /*
        A pack order enrols the student in every course it contains,
        behind the same single-winner gate — so a webhook and a
        return-page visit arriving together cannot enrol twice.
      */
      if (order.pack_id) {
        /* The plan that was paid for decides how long the pack's
           courses last — see enrollPackCourses. */
        await enrollPackCourses(tx, order.user_id, order.pack_id, order.plan_type);
        return { enrolled: true };
      }

      /*
        A BUNDLE ORDER: no course, no pack, its courses in order_items.
        Enrolled here behind the same single-winner gate as the other
        two kinds, so a webhook and a return-page visit arriving
        together cannot enrol anybody twice.
      */
      if (!order.course_id) {
        const [itemRows] = await tx.execute(
          `SELECT course_id, plan_type FROM order_items WHERE order_id = ?`,
          [order.id]
        );
        const items = itemRows as { course_id: string; plan_type: PlanType }[];
        if (items.length === 0) return { enrolled: false };

        for (const item of items) {
          await enrollOne(tx, order.user_id, item.course_id, item.plan_type, paymentId);
        }
        return { enrolled: true };
      }

      await enrollOne(tx, order.user_id, order.course_id, order.plan_type, paymentId);
      return { enrolled: true };
    });
  } catch (error) {
    // Logged, not swallowed: a failure here means somebody paid and did
    // not get access, which needs a human.
    console.error("[checkout] enrolment failed", error);
    return { enrolled: false };
  }
}

/**
 * One enrolment, idempotent.
 *
 * Shared by the single-course path and the bundle path so the two
 * cannot drift: the duplicate guard, the duration lookup and the
 * counter refresh are decided once, here.
 */
async function enrollOne(
  tx: import("mysql2/promise").PoolConnection,
  userId: string,
  courseId: string,
  planType: PlanType,
  /* Null when the enrolment did not come from a payment row — an
     admin grant reaching the same helper, for instance. */
  paymentId: string | null
): Promise<void> {
  // Replaces the 23505 catch: an admin grant or another path may
      // have created an active enrollment already, which is still a
      // successful outcome and must not become a duplicate row.
      const [activeRows] = await tx.execute(
        `SELECT id FROM enrollments
          WHERE user_id = ? AND course_id = ?
            AND deleted_at IS NULL
            AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))
          LIMIT 1`,
        [userId, courseId]
      );

      if ((activeRows as unknown[]).length === 0) {
        /*
          Read at ENROLMENT time, from the plan that was bought.

          Not stored on the order: the order records what was paid, and
          re-reading the current duration means an admin who extends a
          plan from 90 to 180 days also extends the orders still in
          flight — which is the generous direction, and the only one
          that cannot produce a complaint.
        */
        const [durationRows] = await tx.execute(
          `SELECT duration_days FROM course_prices
            WHERE course_id = ? AND plan_type = ? AND is_active = 1
            LIMIT 1`,
          [courseId, planType]
        );
        const durationDays = (durationRows as { duration_days: number | null }[])[0]?.duration_days;

        const days =
          planType === "lifetime"
            ? null
            : durationDays === undefined
              ? FALLBACK_LIMITED_DAYS
              : durationDays;

        const expiry = expiryFor(days === null ? null : Number(days), new Date());
        const expiresAt = expiry === null ? null : toSql(expiry);

        await tx.execute(
          `INSERT INTO enrollments
             (id, user_id, course_id, plan_type, source, payment_id, expires_at)
           VALUES (?, ?, ?, ?, 'purchase', ?, ?)`,
          [newId(), userId, courseId, planType, paymentId, expiresAt]
        );

    await refreshCourseStudents(courseId, tx);

    /*
      "You now have access." Sent from here rather than from each
      caller, so a course bought on its own, inside a pack, or granted
      by an admin all announce themselves the same way.
    */
    const [titleRows] = await tx.execute(
      `SELECT title, slug FROM courses WHERE id = ? LIMIT 1`,
      [courseId]
    );
    const course = (titleRows as { title: string; slug: string }[])[0];
    await notify({
      userId,
      type: "enrollment_activated",
      title: "فُتح لك وصول جديد",
      body: course?.title ?? null,
      entityType: "course",
      entityId: course?.slug ?? courseId,
    });
  }
}
