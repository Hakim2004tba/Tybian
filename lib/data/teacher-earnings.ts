import "server-only";
import { query } from "@/lib/db";
import { columnExists } from "@/lib/db/tables";
import { splitAmount, teacherCut, type Share } from "@/lib/plans/earnings";

export type TeacherEarnings = {
  teacherId: string;
  /** Sales attributable to this teacher's courses, after discounts. */
  grossSales: number;
  percent: number;
  /** What the teacher is owed. */
  payout: number;
  /** What stays with the platform. */
  platform: number;
  sales: number;
};

/**
 * What every teacher earned, from PAID sales only.
 *
 * Free access is excluded at the source: only rows in `payments` with
 * status 'success' are read, and an admin grant or a 100%-discount
 * coupon creates an enrolment without one. Counting enrolments instead
 * would pay teachers for students who never paid.
 *
 * A payment that covers several courses (a pack, or a basket the
 * student assembled) is divided between their teachers in proportion
 * to the list prices of the courses it covered — see splitAmount for
 * why, and for what happens to the rounding remainder.
 *
 * Computed on demand, never stored. A money column that drifts is a
 * money column whose error surfaces as an argument about wages.
 */
export async function teacherEarnings(): Promise<Map<string, TeacherEarnings>> {
  const hasShare = await columnExists("teachers", "revenue_share_percent");
  /* The admin's own split for each pack, when they have set one — see
     migration 22. Falls back to price, which is what it did before. */
  const hasWeight = await columnExists("course_pack_items", "revenue_weight");

  const teachers = await query<{ id: string; percent: string | null }>(
    hasShare
      ? `SELECT id, revenue_share_percent AS percent FROM teachers WHERE deleted_at IS NULL`
      : `SELECT id, NULL AS percent FROM teachers WHERE deleted_at IS NULL`
  );

  const result = new Map<string, TeacherEarnings>();
  for (const t of teachers) {
    result.set(t.id, {
      teacherId: t.id,
      grossSales: 0,
      percent: Number(t.percent ?? 0),
      payout: 0,
      platform: 0,
      sales: 0,
    });
  }

  /*
    Every successful payment, with the courses it actually covered.

    THREE SHAPES IN ONE LIST, which is why this is a UNION rather than
    a join on payments.course_id alone:
      - a single course sale   -> payments.course_id
      - a basket               -> order_items
      - a pack                 -> course_pack_items
    Reading only payments.course_id (as the teachers list does) counts
    the first and silently drops the other two.
  */
  const rows = await query<{
    payment_id: string; amount: string; teacher_id: string | null; weight: string | null;
  }>(
    `SELECT pay.id AS payment_id, pay.amount, c.teacher_id,
            c.min_price AS weight
       FROM payments pay
       JOIN courses c ON c.id = pay.course_id
      WHERE pay.status = 'success' AND pay.course_id IS NOT NULL

      UNION ALL

     SELECT pay.id, pay.amount, c.teacher_id, i.unit_price
       FROM payments pay
       JOIN orders o      ON o.id = pay.order_id
       JOIN order_items i ON i.order_id = o.id
       JOIN courses c     ON c.id = i.course_id
      WHERE pay.status = 'success' AND pay.course_id IS NULL

      UNION ALL

     SELECT pay.id, pay.amount, c.teacher_id,
            ${hasWeight ? "COALESCE(pi.revenue_weight, c.min_price)" : "c.min_price"}
       FROM payments pay
       JOIN orders o             ON o.id = pay.order_id
       JOIN course_pack_items pi ON pi.pack_id = o.pack_id
       JOIN courses c            ON c.id = pi.course_id
      WHERE pay.status = 'success' AND pay.course_id IS NULL`
  );

  /* Group by payment, then divide each one. */
  const byPayment = new Map<string, { amount: number; shares: Share[] }>();
  for (const row of rows) {
    if (!row.teacher_id) continue;
    const entry = byPayment.get(row.payment_id) ?? {
      amount: Math.round(Number(row.amount)),
      shares: [],
    };
    entry.shares.push({ key: row.teacher_id, weight: Number(row.weight ?? 0) });
    byPayment.set(row.payment_id, entry);
  }

  const counted = new Map<string, Set<string>>();
  for (const [paymentId, entry] of byPayment) {
    for (const [teacherId, share] of splitAmount(entry.amount, entry.shares)) {
      const row = result.get(teacherId);
      if (!row) continue;
      row.grossSales += share;

      /* One payment is one sale for a teacher, however many of their
         courses it covered. */
      const seen = counted.get(teacherId) ?? new Set<string>();
      if (!seen.has(paymentId)) {
        seen.add(paymentId);
        counted.set(teacherId, seen);
        row.sales += 1;
      }
    }
  }

  for (const row of result.values()) {
    row.payout = teacherCut(row.grossSales, row.percent);
    row.platform = row.grossSales - row.payout;
  }

  return result;
}
