import "server-only";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 15;

export type PaginatedResult<T> = { items: T[]; totalCount: number; page: number; pageSize: number };

function pageRange(page: number) {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}

// ---------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------
export type AdminStudentRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  academic_years: { name_ar: string } | null;
};

export async function listStudents(page: number, query?: string): Promise<PaginatedResult<AdminStudentRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  let q = supabase
    .from("profiles")
    .select("id, full_name, phone, created_at, academic_years ( name_ar )", { count: "exact" })
    .eq("role", "student")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (query) q = q.ilike("full_name", `%${query}%`);

  const { data, count } = await q.range(from, to);

  const items = (data ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    phone: r.phone,
    created_at: r.created_at,
    academic_years: Array.isArray(r.academic_years) ? (r.academic_years[0] ?? null) : r.academic_years,
  }));

  return { items, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

// ---------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------
export type AdminTeacherRow = {
  id: string;
  profile_id: string;
  title: string | null;
  specialty: string | null;
  institution: string | null;
  bio: string | null;
  rating: number;
  students_count: number;
  courses_count: number;
  profiles: { full_name: string; avatar_url: string | null } | null;
};

export async function listTeachersAdmin(page: number): Promise<PaginatedResult<AdminTeacherRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  const { data, count } = await supabase
    .from("teachers")
    .select(
      "id, profile_id, title, specialty, institution, bio, rating, students_count, courses_count, profiles ( full_name, avatar_url )",
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  const items = (data ?? []).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles,
  }));

  return { items, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

// ---------------------------------------------------------------------
// Academic years — fixed 7 rows, no pagination needed
// ---------------------------------------------------------------------
export async function listAcademicYearsAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academic_years")
    .select("id, year_number, name_ar, name_en, name_fr, sort_order")
    .order("sort_order");
  return data ?? [];
}

export async function getCourseCountsByYear(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("academic_year_id")
    .is("deleted_at", null);

  const counts = new Map<string, number>();
  (data ?? []).forEach((c) => counts.set(c.academic_year_id, (counts.get(c.academic_year_id) ?? 0) + 1));
  return counts;
}

// ---------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------
export type AdminEnrollmentRow = {
  id: string;
  plan_type: string;
  starts_at: string;
  expires_at: string | null;
  profiles: { full_name: string } | null;
  courses: { title: string } | null;
};

export async function listEnrollments(page: number): Promise<PaginatedResult<AdminEnrollmentRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  const { data, count } = await supabase
    .from("enrollments")
    .select("id, plan_type, starts_at, expires_at, profiles ( full_name ), courses ( title )", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  const items = (data ?? []).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles,
    courses: Array.isArray(r.courses) ? (r.courses[0] ?? null) : r.courses,
  }));

  return { items, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

// ---------------------------------------------------------------------
// Payments (full paginated version — admin-dashboard.ts only has "recent 5")
// ---------------------------------------------------------------------
export type AdminPaymentRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  plan_type: string;
  created_at: string;
  profiles: { full_name: string } | null;
  courses: { title: string } | null;
};

export async function listPayments(page: number): Promise<PaginatedResult<AdminPaymentRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  const { data, count } = await supabase
    .from("payments")
    .select("id, amount, currency, status, plan_type, created_at, profiles ( full_name ), courses ( title )", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  const items = (data ?? []).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles,
    courses: Array.isArray(r.courses) ? (r.courses[0] ?? null) : r.courses,
  }));

  return { items, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

// ---------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------
export type AdminReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
  courses: { title: string } | null;
};

export async function listReviewsAdmin(page: number): Promise<PaginatedResult<AdminReviewRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  const { data, count } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, profiles ( full_name ), courses ( title )", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  const items = (data ?? []).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles,
    courses: Array.isArray(r.courses) ? (r.courses[0] ?? null) : r.courses,
  }));

  return { items, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

// ---------------------------------------------------------------------
// Pricing overview (across all courses)
// ---------------------------------------------------------------------
export type AdminPricingRow = {
  courseId: string;
  courseTitle: string;
  threeMonthsPrice: number | null;
  lifetimePrice: number | null;
};

export async function listPricingOverview(page: number): Promise<PaginatedResult<AdminPricingRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  const { data: courses, count } = await supabase
    .from("courses")
    .select("id, title", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: prices } = courseIds.length
    ? await supabase
        .from("course_prices")
        .select("course_id, plan_type, price")
        .in("course_id", courseIds)
        .eq("is_active", true)
    : { data: [] as { course_id: string; plan_type: string; price: number }[] };

  const items = (courses ?? []).map((c) => {
    const coursePrices = (prices ?? []).filter((p) => p.course_id === c.id);
    return {
      courseId: c.id,
      courseTitle: c.title,
      threeMonthsPrice: coursePrices.find((p) => p.plan_type === "three_months")?.price ?? null,
      lifetimePrice: coursePrices.find((p) => p.plan_type === "lifetime")?.price ?? null,
    };
  });

  return { items, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

// ---------------------------------------------------------------------
// Lessons (across all courses)
// ---------------------------------------------------------------------
export type AdminLessonRow = {
  id: string;
  title: string;
  is_free_preview: boolean;
  courseTitle: string | null;
  sectionTitle: string | null;
  hasVideo: boolean;
};

export async function listLessonsAdmin(page: number): Promise<PaginatedResult<AdminLessonRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  const { data, count } = await supabase
    .from("lessons")
    .select(
      "id, title, is_free_preview, video_id, course_sections ( title, courses ( title ) )",
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  const items = (data ?? []).map((r) => {
    const sectionRaw = Array.isArray(r.course_sections) ? r.course_sections[0] : r.course_sections;
    const courseRaw = sectionRaw ? (Array.isArray(sectionRaw.courses) ? sectionRaw.courses[0] : sectionRaw.courses) : null;
    return {
      id: r.id,
      title: r.title,
      is_free_preview: r.is_free_preview,
      hasVideo: !!r.video_id,
      sectionTitle: sectionRaw?.title ?? null,
      courseTitle: courseRaw?.title ?? null,
    };
  });

  return { items, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

// ---------------------------------------------------------------------
// Videos (across all courses) — admin-only table, safe to read directly
// ---------------------------------------------------------------------
export type AdminVideoRow = {
  id: string;
  title: string;
  status: string;
  source: string;
  duration_seconds: number;
  lessonTitle: string | null;
  courseTitle: string | null;
};

export async function listVideosAdmin(page: number): Promise<PaginatedResult<AdminVideoRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  const { data, count } = await supabase
    .from("videos")
    .select("id, title, status, source, duration_seconds", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  const videoIds = (data ?? []).map((v) => v.id);
  const { data: lessons } = videoIds.length
    ? await supabase
        .from("lessons")
        .select("title, video_id, course_sections ( courses ( title ) )")
        .in("video_id", videoIds)
    : { data: [] as { title: string; video_id: string | null; course_sections: unknown }[] };

  const lessonByVideo = new Map(
    (lessons ?? []).map((l) => {
      const sectionRaw = Array.isArray(l.course_sections) ? l.course_sections[0] : l.course_sections;
      const courseRaw = sectionRaw
        ? Array.isArray((sectionRaw as { courses: unknown }).courses)
          ? (sectionRaw as { courses: { title: string }[] }).courses[0]
          : (sectionRaw as { courses: { title: string } }).courses
        : null;
      return [l.video_id, { lessonTitle: l.title, courseTitle: courseRaw?.title ?? null }];
    })
  );

  const items = (data ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    status: v.status,
    source: v.source,
    duration_seconds: v.duration_seconds,
    lessonTitle: lessonByVideo.get(v.id)?.lessonTitle ?? null,
    courseTitle: lessonByVideo.get(v.id)?.courseTitle ?? null,
  }));

  return { items, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

// ---------------------------------------------------------------------
// Notifications sent (admin broadcast history)
// ---------------------------------------------------------------------
export type AdminNotificationRow = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  created_at: string;
  recipientCount: number;
};

export async function listSentNotifications(page: number): Promise<PaginatedResult<AdminNotificationRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  // Broadcasts insert one row per recipient with identical
  // (title, body, created_at) — grouped here for a readable admin list
  // rather than showing thousands of individual rows.
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, type, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const grouped = new Map<string, AdminNotificationRow>();
  (data ?? []).forEach((n) => {
    const key = `${n.title}|${n.body}|${n.created_at}`;
    const existing = grouped.get(key);
    if (existing) existing.recipientCount++;
    else grouped.set(key, { ...n, recipientCount: 1 });
  });

  const all = [...grouped.values()];
  const items = all.slice(from, to + 1);

  return { items, totalCount: all.length, page, pageSize: PAGE_SIZE };
}
