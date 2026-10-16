import "server-only";
import { query, queryOne } from "@/lib/db";

/**
 * Public homepage reads.
 *
 * No guard in this file, deliberately: everything here is filtered to
 * `status = 'published'` and is meant to be seen by signed-out visitors,
 * which is what the Postgres policies allowed anon to select. The
 * published filter IS the authorization — drop it and a draft course
 * appears on the front page.
 *
 * The nested Supabase selects (`teachers ( profiles ( full_name ) )`)
 * become ordinary joins, and the aggregates that used to be computed in
 * JavaScript over a full table read are now computed in SQL. That is not
 * a stylistic change: `select("id", { count: "exact" })` fetched every
 * matching row to count it, which is fine at ten courses and not at a
 * thousand.
 */

// ---------------------------------------------------------------------
// Homepage stats — the numbers in the Hero's stats panel. Every value is
// a real aggregate, no hardcoded figures.
// ---------------------------------------------------------------------
export type HomepageStats = {
  studentCount: number;
  courseCount: number;
  avgRating: number;
  totalHours: number;
};

export async function getHomepageStats(): Promise<HomepageStats> {
  try {
    const [students, courses] = await Promise.all([
      queryOne<{ n: number }>(
        `SELECT COUNT(*) AS n FROM profiles WHERE role = 'student' AND deleted_at IS NULL`
      ),
      queryOne<{ n: number; avg_rating: string | null; total_minutes: string | null }>(
        /*
          AVG over only the reviewed courses, via the CASE.

          A course that nobody has rated carries rating = 0 by default,
          and averaging those in would drag the platform figure toward
          zero — the more new courses are published, the worse the
          platform appears to be. CASE yields NULL for them, and SQL's
          AVG skips NULLs, so unreviewed courses count toward the course
          total without touching the rating.
        */
        `SELECT COUNT(*) AS n,
                AVG(CASE WHEN rating_count > 0 THEN rating END) AS avg_rating,
                SUM(duration_minutes) AS total_minutes
           FROM courses
          WHERE status = 'published' AND deleted_at IS NULL`
      ),
    ]);

    return {
      studentCount: Number(students?.n ?? 0),
      courseCount: Number(courses?.n ?? 0),
      avgRating: courses?.avg_rating ? Math.round(Number(courses.avg_rating) * 10) / 10 : 0,
      totalHours: Math.round(Number(courses?.total_minutes ?? 0) / 60),
    };
  } catch {
    return { studentCount: 0, courseCount: 0, avgRating: 0, totalHours: 0 };
  }
}

// ---------------------------------------------------------------------
// Featured courses — admin-curated via courses.is_featured/featured_order
// (0033). Published only, regardless of the featured flag, so an admin
// toggling "featured" on a course still mid-edit cannot leak it onto the
// public homepage.
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

type FeaturedRow = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  rating: string;
  rating_count: number;
  students_count: number;
  duration_minutes: number;
  lessons_count: number;
  min_price: string | null;
  is_new: number;
  teacher_name: string | null;
  year_name: string | null;
};

export async function getFeaturedCourses(limit = 6): Promise<FeaturedCourse[]> {
  try {
    const rows = await query<FeaturedRow>(
      /*
        LEFT JOIN on teacher and year, not INNER.

        Both are NOT NULL columns, so an inner join would normally be
        equivalent — but if a teacher row were ever missing, an inner
        join would make the course silently vanish from the homepage
        with no error anywhere. A left join shows the course with the
        fallback name below instead, which is visible and fixable.

        `is_new` is computed here rather than compared against an
        ISO string in JS, so the 30-day boundary is measured on the
        database's clock, in UTC, like every other time in this schema.

        NULLs sort last in `featured_order ASC` in MariaDB — the same as
        the `nullsFirst: false` the Supabase query asked for — so an
        unordered featured course falls to the end rather than the front.
      */
      `SELECT c.id, c.slug, c.title, c.cover_url, c.rating, c.rating_count,
              c.students_count, c.duration_minutes, c.lessons_count, c.min_price,
              (c.created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 30 DAY)) AS is_new,
              p.full_name AS teacher_name,
              ay.name_ar  AS year_name
         FROM courses c
         LEFT JOIN teachers t        ON t.id  = c.teacher_id
         LEFT JOIN profiles p        ON p.id  = t.profile_id
         LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
        WHERE c.status = 'published'
          AND c.is_featured = 1
          AND c.deleted_at IS NULL
        ORDER BY c.featured_order ASC
        LIMIT ?`,
      [limit]
    );

    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      coverUrl: c.cover_url,
      teacherName: c.teacher_name ?? "أستاذ غير محدد",
      yearName: c.year_name ?? "—",
      rating: Number(c.rating),
      ratingCount: c.rating_count,
      studentsCount: c.students_count,
      durationHours: Math.round(c.duration_minutes / 60),
      // DECIMAL comes back as a string so money keeps its precision; the
      // public type is a number, so convert only here.
      minPrice: c.min_price === null ? null : Number(c.min_price),
      lessonsCount: c.lessons_count,
      isNew: c.is_new === 1,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------
// Per-year published course counts — the real "count" on each
// academic-year card.
// ---------------------------------------------------------------------
export async function getAcademicYearCourseCounts(): Promise<Record<number, number>> {
  try {
    // Was a full read of every published course, tallied in a JS loop.
    const rows = await query<{ year_number: number; n: number }>(
      `SELECT ay.year_number, COUNT(*) AS n
         FROM courses c
         JOIN academic_years ay ON ay.id = c.academic_year_id
        WHERE c.status = 'published' AND c.deleted_at IS NULL
        GROUP BY ay.year_number`
    );

    const counts: Record<number, number> = {};
    for (const row of rows) counts[row.year_number] = Number(row.n);
    return counts;
  } catch {
    return {};
  }
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

type TestimonialRow = {
  id: string;
  rating: number;
  comment: string;
  student_name: string;
  course_title: string;
  year_name: string | null;
};

export async function getHomepageTestimonials(limit = 3): Promise<HomepageTestimonial[]> {
  try {
    return await query<TestimonialRow>(
      /*
        Inner joins to profiles and courses, plus the empty-string test.

        The Supabase version fetched rows, then dropped any whose author,
        course or comment turned out to be missing — which meant asking
        for 3 and sometimes rendering 2. Requiring them in the WHERE
        clause means LIMIT counts only rows that will actually be shown.

        `comment <> ''` as well as NOT NULL: the column is nullable here,
        but a whitespace-only comment would pass a null check and render
        as an empty quote card.
      */
      `SELECT r.id, r.rating, r.comment,
              p.full_name AS student_name,
              c.title     AS course_title,
              ay.name_ar  AS year_name
         FROM reviews r
         JOIN profiles p             ON p.id  = r.user_id
         JOIN courses  c             ON c.id  = r.course_id
         LEFT JOIN academic_years ay ON ay.id = p.academic_year_id
        WHERE r.rating >= 4
          AND r.comment IS NOT NULL
          AND TRIM(r.comment) <> ''
          AND r.deleted_at IS NULL
          AND c.status = 'published'
          AND c.deleted_at IS NULL
        ORDER BY r.rating DESC, r.created_at DESC
        LIMIT ?`,
      [limit]
    ).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        studentName: r.student_name,
        courseTitle: r.course_title,
        yearName: r.year_name,
        rating: r.rating,
        comment: r.comment,
      }))
    );
  } catch {
    return [];
  }
}
