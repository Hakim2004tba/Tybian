"use server";

import { revalidatePath } from "next/cache";
import { execute } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { columnExists } from "@/lib/db/tables";

export type ShareState = { error: string | null; success?: string | null };

/**
 * Sets one teacher's cut of their own sales.
 *
 * Stored as a percentage rather than as an amount, because the amount
 * changes with every sale and the agreement does not. What it works
 * out to is computed from payments each time it is asked for — see
 * lib/data/teacher-earnings.ts.
 */
export async function setTeacherShareAction(
  teacherId: string,
  _prev: ShareState,
  formData: FormData
): Promise<ShareState> {
  await requireRouteAccess("/admin");

  if (!(await columnExists("teachers", "revenue_share_percent"))) {
    return { error: "شغّل ملفّ 20-teacher-earnings.sql في phpMyAdmin أولاً." };
  }

  const percent = Number(formData.get("percent") ?? 0);

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return { error: "النسبة يجب أن تكون بين 0 و 100" };
  }

  await execute(`UPDATE teachers SET revenue_share_percent = ? WHERE id = ?`, [
    /* Two decimals: 62.5% is a real agreement, 62 or 63 is not it. */
    Math.round(percent * 100) / 100,
    teacherId,
  ]);

  revalidatePath("/admin/teachers");
  return { error: null, success: "حُفظت النسبة." };
}
