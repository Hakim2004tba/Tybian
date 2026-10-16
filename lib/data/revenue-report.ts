import "server-only";
import { query } from "@/lib/db";
import { columnExists } from "@/lib/db/tables";
import { splitAmount, type Share } from "@/lib/plans/earnings";

export type CourseRevenue = {
  courseId: string;
  title: string;
  /** Students who bought this course on its own. */
  directStudents: number;
  /** Students who got it inside a pack. */
  packStudents: number;
  /** Students given it for free by an admin. */
  grantedStudents: number;
  /** Money from direct sales of this course. */
  directRevenue: number;
  /** This course's share of the packs it belongs to. */
  packRevenue: number;
  total: number;
};

export type PackRevenue = {
  packId: string;
  title: string;
  /** People who bought the pack (paid orders). */
  buyers: number;
  /** Students currently holding access granted by it. */
  subscribers: number;
  revenue: number;
};

/**
 * WHERE EVERY DINAR CAME FROM, per course and per pack.
 *
 * The question this answers is "how much has this course actually
 * earned", which the teachers page could not: it read
 * payments.course_id, so a course sold a hundred times inside a pack
 * showed zero.
 *
 * A pack payment is divided between its courses by their WEIGHT — the
 * number the admin set on each item, falling back to the course's own
 * price when none is set. Courses in a pack are not equal, and
 * splitting evenly pays a ten-lesson course the same as a sixty-lesson
 * one.
 */
export async function revenueReport(): Promise<{
  courses: CourseRevenue[];
  packs: PackRevenue[];
}> {
  const hasPackCol = await columnExists("enrollments", "pack_id");
  const hasWeight = await columnExists("course_pack_items", "revenue_weight");

  const courses = await query<{ id: string; title: string }>(
    `SELECT id, title FROM courses WHERE deleted_at IS NULL ORDER BY title`
  );

  const byCourse = new Map<string, CourseRevenue>(
    courses.map((c) => [
      c.id,
      {
        courseId: c.id,
        title: c.title,
        directStudents: 0,
        packStudents: 0,
        grantedStudents: 0,
        directRevenue: 0,
        packRevenue: 0,
        total: 0,
      },
    ])
  );

  /* ---- how students got in ---- */
  const enrolments = await query<{
    course_id: string; source: string; via_pack: number; n: number;
  }>(
    `SELECT course_id, source,
            ${hasPackCol ? "CASE WHEN pack_id IS NULL THEN 0 ELSE 1 END" : "0"} AS via_pack,
            COUNT(*) AS n
       FROM enrollments
      WHERE deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))
      GROUP BY course_id, source, via_pack`
  );

  for (const row of enrolments) {
    const entry = byCourse.get(row.course_id);
    if (!entry) continue;
    const n = Number(row.n);
    if (row.source === "admin_grant") entry.grantedStudents += n;
    else if (Number(row.via_pack) === 1) entry.packStudents += n;
    else entry.directStudents += n;
  }

  /* ---- money from single-course sales ---- */
  const direct = await query<{ course_id: string; total: string }>(
    `SELECT course_id, COALESCE(SUM(amount), 0) AS total
       FROM payments
      WHERE status = 'success' AND course_id IS NOT NULL
      GROUP BY course_id`
  );
  for (const row of direct) {
    const entry = byCourse.get(row.course_id);
    if (entry) entry.directRevenue = Math.round(Number(row.total));
  }

  /* ---- money from packs, split by weight ---- */
  const packRows = await query<{
    pack_id: string; pack_title: string; payment_id: string; amount: string;
    course_id: string; weight: string | null;
  }>(
    `SELECT o.pack_id, cp.title AS pack_title, pay.id AS payment_id, pay.amount,
            pi.course_id,
            ${hasWeight ? "COALESCE(pi.revenue_weight, c.min_price)" : "c.min_price"} AS weight
       FROM payments pay
       JOIN orders o             ON o.id = pay.order_id
       JOIN course_packs cp      ON cp.id = o.pack_id
       JOIN course_pack_items pi ON pi.pack_id = o.pack_id
       JOIN courses c            ON c.id = pi.course_id
      WHERE pay.status = 'success' AND o.pack_id IS NOT NULL`
  );

  const packTotals = new Map<string, PackRevenue>();
  const byPayment = new Map<string, { packId: string; amount: number; shares: Share[] }>();

  for (const row of packRows) {
    const entry = byPayment.get(row.payment_id) ?? {
      packId: row.pack_id,
      amount: Math.round(Number(row.amount)),
      shares: [],
    };
    entry.shares.push({ key: row.course_id, weight: Number(row.weight ?? 0) });
    byPayment.set(row.payment_id, entry);

    if (!packTotals.has(row.pack_id)) {
      packTotals.set(row.pack_id, {
        packId: row.pack_id,
        title: row.pack_title,
        buyers: 0,
        subscribers: 0,
        revenue: 0,
      });
    }
  }

  const countedPayments = new Set<string>();
  for (const [paymentId, entry] of byPayment) {
    const pack = packTotals.get(entry.packId);
    if (pack && !countedPayments.has(paymentId)) {
      countedPayments.add(paymentId);
      pack.buyers += 1;
      pack.revenue += entry.amount;
    }
    for (const [courseId, share] of splitAmount(entry.amount, entry.shares)) {
      const course = byCourse.get(courseId);
      if (course) course.packRevenue += share;
    }
  }

  /* ---- how many people each pack currently gives access to ---- */
  if (hasPackCol) {
    const holders = await query<{ pack_id: string; n: number }>(
      `SELECT pack_id, COUNT(DISTINCT user_id) AS n
         FROM enrollments
        WHERE pack_id IS NOT NULL AND deleted_at IS NULL
          AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))
        GROUP BY pack_id`
    );
    for (const row of holders) {
      const pack = packTotals.get(row.pack_id);
      if (pack) pack.subscribers = Number(row.n);
    }
  }

  /* Packs with no sales yet still belong in the list — "zero" is an
     answer, and a missing row looks like a bug. */
  const allPacks = await query<{ id: string; title: string }>(
    `SELECT id, title FROM course_packs WHERE deleted_at IS NULL ORDER BY sort_order, title`
  );
  for (const p of allPacks) {
    if (!packTotals.has(p.id)) {
      packTotals.set(p.id, { packId: p.id, title: p.title, buyers: 0, subscribers: 0, revenue: 0 });
    }
  }

  for (const course of byCourse.values()) {
    course.total = course.directRevenue + course.packRevenue;
  }

  return {
    courses: [...byCourse.values()].sort((a, b) => b.total - a.total),
    packs: [...packTotals.values()].sort((a, b) => b.revenue - a.revenue),
  };
}
