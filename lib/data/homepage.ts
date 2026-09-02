import "server-only";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------
// Homepage stats — the numbers shown in the Hero's stats panel. Every
// value is a real aggregate query, no hardcoded figures.
// ---------------------------------------------------------------------
export type HomepageStats = {
  studentCount: number;
  courseCount: number;
  avgRating: number;
  totalHours: number;
};

export async function getHomepageStats(): Promise<HomepageStats> {
  const supabase = await createClient();

  const [studentsRes, coursesRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").is("deleted_at", null),
    supabase
      .from("courses")
      .select("rating, rating_count, duration_minutes", { count: "exact" })
      .eq("status", "published")
      .is("deleted_at", null),
  ]);

  const courses = coursesRes.data ?? [];
  // Only courses with at least one real review contribute to the
  // average — otherwise every never-reviewed course's rating=0 default
  // would silently drag the platform-wide average down.
  const reviewed = courses.filter((c) => c.rating_count > 0);
  const avgRating = reviewed.length
    ? Math.round((reviewed.reduce((sum, c) => sum + Number(c.rating), 0) / reviewed.length) * 10) / 10
    : 0;
  const totalMinutes = courses.reduce((sum, c) => sum + c.duration_minutes, 0);

  return {
    studentCount: studentsRes.count ?? 0,
    courseCount: coursesRes.count ?? 0,
    avgRating,
    totalHours: Math.round(totalMinutes / 60),
  };
}

// ---------------------------------------------------------------------
// Featured courses — admin-curated via courses.is_featured/featured_order
// (0033_featured_courses.sql). Only ever published courses, regardless
// of the featured flag, so an admin toggling "featured" on a course
// still mid-edit can never leak it onto the public homepage.
// ---------------------------------------------------------------------
export type FeaturedCourse = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  teacherName: string;
  yearName: string;
  rating: number;
  ratingCount: number;
  studentsCount: number;
  durationHours: number;
  lessonsCount: number;
  minPrice: number | null;
  isNew: boolean;
};

export async function getFeaturedCourses(limit = 6): Promise<FeaturedCourse[]> {
  const supabase = await createClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("courses")
    .select(
      `id, slug, title, cover_url, rating, rating_count, students_count, duration_minutes, lessons_count, min_price, created_at,
       academic_years ( name_ar ),
       teachers ( profiles ( full_name ) )`
    )
    .eq("status", "published")
    .eq("is_featured", true)
    .is("deleted_at", null)
    .order("featured_order", { ascending: true, nullsFirst: false })
    .limit(limit);

  return (data ?? []).map((c) => {
    const teacherRaw = Array.isArray(c.teachers) ? c.teachers[0] : c.teachers;
    const profileRaw = teacherRaw
      ? (Array.isArray(teacherRaw.profiles) ? teacherRaw.profiles[0] : teacherRaw.profiles)
      : null;
    const yearRaw = Array.isArray(c.academic_years) ? c.academic_years[0] : c.academic_years;

    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      coverUrl: c.cover_url,
      teacherName: profileRaw?.full_name ?? "أستاذ غير محدد",
      yearName: yearRaw?.name_ar ?? "—",
      rating: Number(c.rating),
      ratingCount: c.rating_count,
      studentsCount: c.students_count,
      durationHours: Math.round(c.duration_minutes / 60),
      lessonsCount: c.lessons_count,
      minPrice: c.min_price,
      isNew: c.created_at >= thirtyDaysAgo,
    };
  });
}

// ---------------------------------------------------------------------
// Per-year published course counts — powers the real "count" shown on
// each academic-year card, replacing the previously hardcoded numbers.
// ---------------------------------------------------------------------
export async function getAcademicYearCourseCounts(): Promise<Record<number, number>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("courses")
    .select("academic_years ( year_number )")
    .eq("status", "published")
    .is("deleted_at", null);

  const counts: Record<number, number> = {};
  for (const row of data ?? []) {
    const yearRaw = Array.isArray(row.academic_years) ? row.academic_years[0] : row.academic_years;
    const yearNumber = yearRaw?.year_number;
    if (yearNumber) counts[yearNumber] = (counts[yearNumber] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------
// Real testimonials — genuine student reviews, not fabricated quotes.
// Only 4/5-star reviews with actual written comments qualify, so the
// section never shows a bare rating with no real voice behind it.
// ---------------------------------------------------------------------
export type HomepageTestimonial = {
  id: string;
  studentName: string;
  courseTitle: string;
  yearName: string | null;
  rating: number;
  comment: string;
};

export async function getHomepageTestimonials(limit = 3): Promise<HomepageTestimonial[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reviews")
    .select(
      `id, rating, comment,
       profiles ( full_name, academic_years ( name_ar ) ),
       courses ( title )`
    )
    .gte("rating", 4)
    .not("comment", "is", null)
    .is("deleted_at", null)
    .order("rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? [])
    .map((r) => {
      const profileRaw = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      const courseRaw = Array.isArray(r.courses) ? r.courses[0] : r.courses;
      const yearRaw = profileRaw
        ? (Array.isArray(profileRaw.academic_years) ? profileRaw.academic_years[0] : profileRaw.academic_years)
        : null;

      if (!profileRaw || !courseRaw || !r.comment) return null;

      return {
        id: r.id,
        studentName: profileRaw.full_name,
        courseTitle: courseRaw.title,
        yearName: yearRaw?.name_ar ?? null,
        rating: r.rating,
        comment: r.comment,
      };
    })
    .filter((x): x is HomepageTestimonial => x !== null);
}
