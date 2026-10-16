"use server";

import { execute, newId, queryOne, transaction } from "@/lib/db";
import { refreshCourseStudents } from "@/lib/data/counters";
import { getSessionUser } from "@/lib/auth/session";
import { getPackById } from "@/lib/data/packs";
import { getDictionary } from "@/lib/i18n/locale";
import { expiryFor } from "@/lib/plans/duration";
import { columnExists } from "@/lib/db/tables";
import { applyPromo, promoMessage, type Coupon } from "@/lib/promo/apply";
import { couponColumns } from "@/lib/promo/lookup";

const CHECKOUT_WINDOW_MINUTES = 30;

export type PackOrderResult =
  | { kind: "order"; orderId: string; amount: number; currency: string }
  | { kind: "already_owned" }
  | { kind: "error"; message: string };

/**
 * A pending order for a whole pack.
 *
 * Mirrors getOrCreatePendingOrder, with the same two rules that matter:
 * the price is read from the database and never accepted from the
 * caller, and FOR UPDATE stops two submits from creating two orders.
 */
export async function getOrCreatePackOrder(
  packId: string,
  /*
    WHICH plan, never how much. The caller names a slot; the price and
    the duration are read from the database here. Accepting an amount
    from the browser is how a pack gets bought for one dinar.
  */
  planType: "three_months" | "lifetime" = "lifetime",
  /**
   * A promo code the student typed. Only its TEXT comes from the
   * browser — what it is worth is read from the coupons table and
   * computed here, exactly as the price is.
   */
  promoCode?: string
): Promise<PackOrderResult> {
  const { dict } = await getDictionary();
  const t = dict.packs;

  const user = await getSessionUser();
  if (!user) return { kind: "error", message: t.errSignIn };

  const pack = await getPackById(packId);
  if (!pack || pack.courses.length === 0) return { kind: "error", message: t.errNotFound };

  /*
    The chosen plan, or the pack's single stored price on a server that
    has not run 18-pack-plans.sql. Falling back keeps selling working
    through the migration rather than refusing every purchase until it
    is applied.
  */
  const plan = pack.plans.find((p) => p.planType === planType) ?? pack.plans[0] ?? null;
  const amount = Math.round(plan ? plan.price : pack.price);
  const currency = plan ? plan.currency : pack.currency;
  const chosenPlan = plan ? plan.planType : "lifetime";

  try {
    return await transaction(async (tx) => {
      /*
        Owning every course already means there is nothing to sell. A
        student who owns SOME of them may still buy the pack — the pack
        page tells them which ones they already have, and that is their
        call to make, not ours to block.
      */
      const [ownedRows] = await tx.execute(
        `SELECT COUNT(DISTINCT e.course_id) AS n
           FROM enrollments e
           JOIN course_pack_items i ON i.course_id = e.course_id
          WHERE i.pack_id = ? AND e.user_id = ?
            AND e.deleted_at IS NULL
            AND e.starts_at <= UTC_TIMESTAMP(3)
            AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))`,
        [packId, user.id]
      );
      const owned = Number((ownedRows as { n: number }[])[0]?.n ?? 0);
      if (owned >= pack.courses.length) return { kind: "already_owned" as const };

      /*
        Matched on the PLAN too. A student who opened the six-month
        option, changed their mind and chose the year must not be handed
        back the older, cheaper pending order.
      */
      const [pendingRows] = await tx.execute(
        `SELECT id, amount, currency, expires_at
           FROM orders
          WHERE user_id = ? AND pack_id = ? AND plan_type = ? AND status = 'pending'
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE`,
        [user.id, packId, chosenPlan]
      );
      const existing = (pendingRows as { id: string; amount: string; currency: string; expires_at: string }[])[0];

      if (existing) {
        if (new Date(existing.expires_at + "Z") > new Date()) {
          return {
            kind: "order" as const,
            orderId: existing.id,
            amount: Number(existing.amount),
            currency: existing.currency,
          };
        }
        await tx.execute(`UPDATE orders SET status = 'expired' WHERE id = ?`, [existing.id]);
      }

      /*
        THE PROMO CODE. Packs accepted none at all before, so a code
        scoped to packs would have had nowhere to work — the scope and
        the place it applies had to arrive together.

        Same rules as the course checkout and through the same pure
        function, so "expired" and "already used" cannot come to mean
        two different things in two places.
      */
      let couponId: string | null = null;
      let discount = 0;
      let finalAmount = amount;

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
          `SELECT 1 FROM coupon_usage WHERE coupon_id = ? AND user_id = ? LIMIT 1`,
          [coupon?.id ?? "", user.id]
        );
        const alreadyUsed = (usedRows as unknown[]).length > 0;

        const outcome = applyPromo(
          coupon,
          amount,
          { kind: "pack", id: packId },
          new Date(),
          alreadyUsed
        );
        if (!outcome.ok) {
          return { kind: "error" as const, message: promoMessage(outcome.reason) };
        }

        couponId = coupon!.id;
        discount = outcome.discount;
        finalAmount = outcome.finalAmount;
      }

      const id = newId();
      await tx.execute(
        `INSERT INTO orders
           (id, user_id, course_id, pack_id, plan_type, amount, currency,
            coupon_id, discount_amount, idempotency_key, expires_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? MINUTE))`,
        [
          id, user.id, packId, chosenPlan, finalAmount, currency,
          couponId, discount, newId(), CHECKOUT_WINDOW_MINUTES,
        ]
      );

      return { kind: "order" as const, orderId: id, amount: finalAmount, currency };
    });
  } catch {
    return { kind: "error", message: t.errOrder };
  }
}

/**
 * Turns a paid pack order into enrolments — one per course.
 *
 * Called from the same place a course order is settled, behind the same
 * single-winner gate, so a webhook and a return-page visit arriving
 * together cannot enrol anybody twice.
 *
 * THE EXPIRY COMES FROM THE PLAN THAT WAS PAID FOR. Packs used to be
 * lifetime by a decision written in this file; they are now sold with
 * durations like courses, so a six-month pack must grant six months.
 *
 * All of a pack's courses expire on the SAME date — they were bought
 * as one thing, and staggering them would mean a student losing access
 * to one course of three on a date nothing explains.
 */
export async function enrollPackCourses(
  /* The live transaction, so the enrolments commit or roll back with
     the order that paid for them. Typed as mysql2's connection rather
     than a hand-written shape, which did not match its overloads. */
  tx: import("mysql2/promise").PoolConnection,
  userId: string,
  packId: string,
  planType: string | null = null
): Promise<void> {
  const pack = await getPackById(packId);
  if (!pack) return;

  const plan = planType ? pack.plans.find((p) => p.planType === planType) : undefined;
  const expiresAt = expiryFor(plan?.durationDays ?? null, new Date());

  /* Recorded only when migration 22 has been run; before that the
     column does not exist and the insert must not name it. */
  const hasPackColumn = await columnExists("enrollments", "pack_id");

  for (const course of pack.courses) {
    /*
      Skip what the student already has rather than inserting a second
      row — an admin grant or an earlier purchase is still access, and
      a duplicate would make "am I enrolled" ambiguous everywhere.
    */
    await tx.execute(
      hasPackColumn
        ? `INSERT INTO enrollments (id, user_id, course_id, plan_type, source, pack_id, starts_at, expires_at)
       SELECT ?, ?, ?, ?, 'purchase', ?, UTC_TIMESTAMP(3), ?
        WHERE NOT EXISTS (
          SELECT 1 FROM enrollments e
           WHERE e.user_id = ? AND e.course_id = ?
             AND e.deleted_at IS NULL
             AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3)))`
        : `INSERT INTO enrollments (id, user_id, course_id, plan_type, source, starts_at, expires_at)
       SELECT ?, ?, ?, ?, 'purchase', UTC_TIMESTAMP(3), ?
        WHERE NOT EXISTS (
          SELECT 1 FROM enrollments e
           WHERE e.user_id = ? AND e.course_id = ?
             AND e.deleted_at IS NULL
             AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3)))`,
      hasPackColumn
        ? [newId(), userId, course.id, plan?.planType ?? "lifetime", packId, expiresAt, userId, course.id]
        : [newId(), userId, course.id, plan?.planType ?? "lifetime", expiresAt, userId, course.id]
    );

    await refreshCourseStudents(course.id, tx);
  }
}
