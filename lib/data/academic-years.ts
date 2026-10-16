import "server-only";
import { query } from "@/lib/db";

export type AcademicYearOption = { id: string; name_ar: string; name_en: string | null; year_number: number };

/**
 * The seven academic years, in display order.
 *
 * No guard: this list is public by design — the registration form shows
 * it to people who have no account yet, which is exactly why the
 * Postgres policy allowed `select` to anon as well. Nothing here is
 * private, so there is nothing to authorize.
 *
 * Returns [] on failure rather than throwing, keeping the old contract:
 * the form renders with an empty select and refuses to submit, instead of
 * the whole page erroring.
 */
export async function getAcademicYears(): Promise<AcademicYearOption[]> {
  try {
    return await query<AcademicYearOption>(
      `SELECT id, name_ar, name_en, year_number
         FROM academic_years
        ORDER BY sort_order ASC`
    );
  } catch {
    return [];
  }
}
