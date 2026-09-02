import { createClient } from "@/lib/supabase/server";

export type AcademicYearOption = { id: string; name_ar: string; name_en: string | null; year_number: number };

export async function getAcademicYears(): Promise<AcademicYearOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name_ar, name_en, year_number")
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data;
}
