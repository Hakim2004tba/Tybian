"use server";

import { revalidatePath } from "next/cache";
import { execute, newId, queryOne, transaction } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/locale";
import { tablesExist, columnExists } from "@/lib/db/tables";
import { parseDuration } from "@/lib/plans/duration";

export type ActionState = { error: string | null; success?: string | null };

/** A URL-safe slug from the pack's title, with a suffix if taken. */
function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "pack";
}

export async function createPackAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");
  const { dict } = await getDictionary();
  const t = dict.admin.packs;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const price = Number(formData.get("price") ?? 0);
  const courseIds = formData.getAll("courseIds").map(String).filter(Boolean);

  if (!title) return { error: t.errTitle };
  if (!Number.isFinite(price) || price <= 0) return { error: t.errPrice };
  /* Chargily takes whole dinars — see lib/payment/chargily-logic.ts. */
  if (!Number.isInteger(price)) return { error: t.errWholePrice };

  /*
    Two courses minimum. A "pack" of one is a course with a second
    price, and it would show a saving computed against itself.
  */
  if (courseIds.length < 2) return { error: t.errTwoCourses };

  let slug = slugify(title);
  const taken = await queryOne<{ id: string }>(
    `SELECT id FROM course_packs WHERE slug = ? LIMIT 1`,
    [slug]
  );
  if (taken) slug = `${slug}-${newId().slice(0, 6)}`;

  const packId = newId();

  await transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO course_packs (id, slug, title, description, price, currency)
       VALUES (?, ?, ?, ?, ?, 'DZD')`,
      [packId, slug, title, description, price]
    );
    for (const [i, courseId] of courseIds.entries()) {
      await tx.execute(
        `INSERT INTO course_pack_items (id, pack_id, course_id, sort_order) VALUES (?, ?, ?, ?)`,
        [newId(), packId, courseId, i]
      );
    }
  });

  revalidatePath("/admin/packs");
  return { error: null, success: t.created };
}

export async function togglePackAction(packId: string): Promise<ActionState> {
  await requireRouteAccess("/admin");
  const { dict } = await getDictionary();

  await execute(`UPDATE course_packs SET is_active = 1 - is_active WHERE id = ?`, [packId]);
  revalidatePath("/admin/packs");
  return { error: null, success: dict.admin.packs.updated };
}

/**
 * The two plans a pack is sold under — same shape as a course's.
 *
 * Packs used to carry ONE price and ONE duration, so a student had no
 * choice: one amount, one length, take it or leave it. Courses have
 * offered two since 10-plan-duration.sql, and there was never a reason
 * for a pack to be different — it is the same decision about the same
 * kind of thing.
 *
 * `course_packs.price` is kept in step with the cheaper plan, for the
 * same reason `courses.min_price` is: the cards and the saving read
 * that column, and a stale one advertises a price nobody can buy at.
 */
export async function updatePackPricingAction(
  packId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  if (!(await tablesExist(["course_pack_prices"]))) {
    return { error: "شغّل ملفّ 18-pack-plans.sql في phpMyAdmin أولاً." };
  }

  const priceA = Number(formData.get("planAPrice") ?? 0);
  const priceB = Number(formData.get("planBPrice") ?? 0);

  for (const price of [priceA, priceB]) {
    if (!Number.isFinite(price) || price <= 0) return { error: "السعر يجب أن يكون رقماً أكبر من صفر" };
    /* Chargily takes whole dinars — see lib/payment/chargily-logic.ts. */
    if (!Number.isInteger(price)) return { error: "السعر يجب أن يكون بالدينار الكامل" };
  }

  const planA = parseDuration(
    formData.get("planALifetime") === "on" ? "" : String(formData.get("planADays") ?? "")
  );
  const planB = parseDuration(
    formData.get("planBLifetime") === "on" ? "" : String(formData.get("planBDays") ?? "")
  );

  if (!planA.ok || !planB.ok) {
    return { error: "المدّة يجب أن تكون عدد أيّام بين 1 و 3650، أو «مدى الحياة»" };
  }

  /* Two plans of the same length are two ways to buy the same thing at
     two prices — which looks like a mistake to a student, and is one. */
  if (planA.days === planB.days) {
    return { error: "الخطّتان بنفس المدّة — غيّر إحداهما." };
  }

  await transaction(async (tx) => {
    for (const [planType, price, durationDays] of [
      ["three_months", priceA, planA.days],
      ["lifetime", priceB, planB.days],
    ] as const) {
      const [rows] = await tx.execute(
        `SELECT id FROM course_pack_prices
          WHERE pack_id = ? AND plan_type = ?
          LIMIT 1
          FOR UPDATE`,
        [packId, planType]
      );
      const existing = (rows as { id: string }[])[0];

      if (existing) {
        await tx.execute(
          `UPDATE course_pack_prices
              SET price = ?, duration_days = ?, is_active = 1
            WHERE id = ?`,
          [price, durationDays, existing.id]
        );
      } else {
        await tx.execute(
          `INSERT INTO course_pack_prices
             (id, pack_id, plan_type, price, duration_days, is_active)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [newId(), packId, planType, price, durationDays]
        );
      }
    }

    await tx.execute(`UPDATE course_packs SET price = ? WHERE id = ?`, [
      Math.min(priceA, priceB),
      packId,
    ]);
  });

  revalidatePath("/admin/packs");
  revalidatePath("/packs");
  return { error: null, success: "حُدِّثت أسعار الباقة." };
}

/**
 * How a pack's income is divided between its courses.
 *
 * Relative weights, not percentages: "3 and 1" is easier to reason
 * about than "75% and 25%", and it cannot be made to add up to
 * anything other than 100 by accident. The split itself normalises
 * them — see splitAmount.
 *
 * Empty clears the weight, which puts that course back on its own
 * price. That is the default for every pack until somebody says
 * otherwise, so an untouched pack keeps behaving exactly as before.
 */
export async function savePackWeightsAction(
  packId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRouteAccess("/admin");

  if (!(await columnExists("course_pack_items", "revenue_weight"))) {
    return { error: "شغّل ملفّ 22-pack-revenue.sql في phpMyAdmin أولاً." };
  }

  const courseIds = formData.getAll("courseId").map(String);
  const weights = formData.getAll("weight").map(String);

  for (let i = 0; i < courseIds.length; i++) {
    const raw = weights[i]?.trim() ?? "";
    let weight: number | null = null;

    if (raw !== "") {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 9999) {
        return { error: "الوزن يجب أن يكون رقماً بين 0 و 9999" };
      }
      weight = Math.round(value * 100) / 100;
    }

    await execute(
      `UPDATE course_pack_items SET revenue_weight = ? WHERE pack_id = ? AND course_id = ?`,
      [weight, packId, courseIds[i]]
    );
  }

  revalidatePath("/admin/packs");
  revalidatePath("/admin/revenue");
  return { error: null, success: "حُفظت الأوزان." };
}
