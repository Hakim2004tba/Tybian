"use server";

import { revalidatePath } from "next/cache";
import { newId, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { parseDuration } from "@/lib/plans/duration";

export type ActionState = { error: string | null; success?: string | null };

/**
 * Sets both plan prices for a course.
 *
 * course_prices_admin_write used to reject this write independently of
 * the route guard, so "a teacher hitting this action directly would
 * still be rejected at the database layer". Not any more —
 * requireRouteAccess("/admin") is the only check, and it is what stops a
 * teacher repricing their own course.
 *
 * The history design is preserved: old prices stay as inactive rows
 * rather than being overwritten, so a past sale can still be reconciled
 * against the price that was live when it happened. That is why this is
 * update-if-active-exists / insert-otherwise rather than an upsert —
 * and why there is no unique key to upsert against.
 */
export async function updateCoursePricingAction(
  courseId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  const planAPrice = Number(formData.get("threeMonthsPrice") ?? "");
  const planBPrice = Number(formData.get("lifetimePrice") ?? "");

  if (!Number.isFinite(planAPrice) || planAPrice < 0) {
    return { error: "سعر الخطّة الأولى غير صالح" };
  }
  if (!Number.isFinite(planBPrice) || planBPrice < 0) {
    return { error: "سعر الخطّة الثانية غير صالح" };
  }

  /*
    BOTH plans carry their own length now, and either may be lifetime.

    The first version assumed the second slot was always "forever" —
    it was named `lifetime` in the enum, so it read as a fact rather
    than as a default. It is not: a course may perfectly well be sold
    as three months and one year, with no permanent option at all.

    `plan_type` stays as the SLOT name in the database ('three_months',
    'lifetime'); what each slot means is these two numbers. See the
    note in tibyan-db/mysql/10-plan-duration.sql for why the enum was
    left alone.
  */
  const planA = parseDuration(
    formData.get("planALifetime") === "on" ? "" : String(formData.get("planADays") ?? "")
  );
  const planB = parseDuration(
    formData.get("planBLifetime") === "on" ? "" : String(formData.get("planBDays") ?? "")
  );

  if (!planA.ok || !planB.ok) {
    return { error: "المدّة يجب أن تكون عدد أيّام بين 1 و 3650، أو «مدى الحياة»" };
  }

  /*
    Two plans of the same length are two ways to buy the same thing,
    priced differently — which looks like a mistake to a student and
    usually is one.
  */
  if (planA.days === planB.days) {
    return { error: "الخطّتان بنفس المدّة — غيّر إحداهما." };
  }

  try {
    // Both plans in one transaction: a failure partway through would
    // otherwise leave the course priced with one new figure and one old.
    await transaction(async (tx) => {
      for (const [planType, price, durationDays] of [
        ["three_months", planAPrice, planA.days],
        ["lifetime", planBPrice, planB.days],
      ] as const) {
        const [rows] = await tx.execute(
          `SELECT id FROM course_prices
            WHERE course_id = ? AND plan_type = ? AND is_active = 1
            LIMIT 1
            FOR UPDATE`,
          [courseId, planType]
        );
        const existing = (rows as { id: string }[])[0];

        if (existing) {
          await tx.execute(`UPDATE course_prices SET price = ?, duration_days = ? WHERE id = ?`, [
            price,
            durationDays,
            existing.id,
          ]);
        } else {
          await tx.execute(
            `INSERT INTO course_prices (id, course_id, plan_type, price, duration_days, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [newId(), courseId, planType, price, durationDays]
          );
        }
      }

      /*
        KEEP courses.min_price IN STEP.

        The catalogue does not join course_prices — it reads a
        denormalised `min_price` column on `courses`, and so do the
        price filter and the price sort. Nothing in the application
        has ever written that column: it was filled once during the
        move off Supabase and has been frozen since, which is why a
        price changed here never appeared on /courses.

        Recomputed from the rows just written, inside the same
        transaction, so the column cannot disagree with the prices it
        summarises. Denormalisation is the right call for a sortable,
        filterable field — it just has to be maintained.
      */
      await tx.execute(
        `UPDATE courses c
            SET c.min_price = (
              SELECT MIN(p.price) FROM course_prices p
               WHERE p.course_id = c.id AND p.is_active = 1
            )
          WHERE c.id = ?`,
        [courseId]
      );
    });
  } catch (error) {
    return { error: "تعذّر حفظ الأسعار: " + (error as Error).message };
  }

  revalidatePath(`/admin/courses/${courseId}`);
  /*
    The public pages are dynamic, so they need no eviction — they were
    showing a stale column, not a stale render. Kept anyway for the
    course page, which is cheap and correct if caching is ever added.
  */
  revalidatePath("/courses/[slug]", "page");
  return { error: null, success: "تم حفظ الأسعار" };
}
