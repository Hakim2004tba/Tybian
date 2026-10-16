import "server-only";
import { query, queryOne, toBool, type SqlValue } from "@/lib/db";
import { requireAdmin } from "@/lib/db/guard";

/**
 * The admin list screens.
 *
 * Every function here reads the whole platform — every student's phone
 * number, every payment, every video. Under RLS the admin-bypass clauses
 * were what made that possible and what stopped anyone else doing it;
 * with no policies these queries are unfiltered for whoever runs them.
 * requireAdmin() at the top of each is the replacement, and it is not
 * optional in any of them.
 *
 * The pattern throughout: one page query plus one COUNT, both sharing a
 * WHERE clause, rather than Supabase's `count: "exact"` which fetched
 * rows to count them. Embedded selects become joins.
 */

const PAGE_SIZE = 15;

export type PaginatedResult<T> = { items: T[]; totalCount: number; page: number; pageSize: number };

const offsetFor = (page: number) => (page - 1) * PAGE_SIZE;

/** Page rows + total, for the common "list with a WHERE" shape. */
async function paginate<T>(
  select: string,
  countFrom: string,
  where: string,
  order: string,
  args: SqlValue[],
  page: number
): Promise<PaginatedResult<T>> {
  const [items, total] = await Promise.all([
    query<T>(`${select} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [
      ...args,
      PAGE_SIZE,
      offsetFor(page),
    ]),
    queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${countFrom} WHERE ${where}`, args),
  ]);

  return { items, totalCount: Number(total?.n ?? 0), page, pageSize: PAGE_SIZE };
}

// ---------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------
export type AdminStudentRow = {
  /** Live enrolments — what "following this student" actually means. */
  courseCount?: number;
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  academic_years: { name_ar: string } | null;
};

export type StudentFilters = {
  q?: string;
  /** Academic year id, or "none" for students who never chose one. */
  year?: string;
  /** "yes" = holds at least one live enrolment, "no" = holds none. */
  enrolled?: string;
  /** "name" | "newest" | "oldest" | "courses" */
  sort?: string;
};

export async function listStudents(
  page: number,
  filters: StudentFilters = {}
): Promise<PaginatedResult<AdminStudentRow>> {
  await requireAdmin();

  const where = ["p.role = 'student'", "p.deleted_at IS NULL"];
  const args: SqlValue[] = [];

  if (filters.q) {
    where.push("p.full_name LIKE ?");
    // Escape LIKE metacharacters, or a name containing % lists everyone.
    args.push(`%${filters.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
  }

  if (filters.year === "none") {
    /*
      Worth filtering for on its own. A student with no year sees almost
      no library material — the folders are year-scoped — so this is the
      list of accounts that look broken to the people holding them.
      Google sign-ups used to land here; see app/(auth)/choose-year.
    */
    where.push("p.academic_year_id IS NULL");
  } else if (filters.year) {
    where.push("p.academic_year_id = ?");
    args.push(filters.year);
  }

  /*
    A live enrolment: not deleted and not expired. Expressed as EXISTS
    rather than a join, so a student with four courses is still one row.
  */
  const LIVE = `EXISTS (
    SELECT 1 FROM enrollments e
     WHERE e.user_id = p.id AND e.deleted_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3)))`;

  if (filters.enrolled === "yes") where.push(LIVE);
  else if (filters.enrolled === "no") where.push(`NOT ${LIVE}`);

  const ORDER: Record<string, string> = {
    newest: "p.created_at DESC",
    oldest: "p.created_at ASC",
    name: "p.full_name ASC",
    courses: "course_count DESC, p.created_at DESC",
  };

  const result = await paginate<
    AdminStudentRow & { year_name: string | null; course_count: number }
  >(
    `SELECT p.id, p.full_name, p.phone, p.created_at, ay.name_ar AS year_name,
            (SELECT COUNT(*) FROM enrollments e2
              WHERE e2.user_id = p.id AND e2.deleted_at IS NULL
                AND (e2.expires_at IS NULL OR e2.expires_at > UTC_TIMESTAMP(3))
            ) AS course_count
       FROM profiles p
       LEFT JOIN academic_years ay ON ay.id = p.academic_year_id`,
    `profiles p`,
    where.join(" AND "),
    ORDER[filters.sort ?? "newest"] ?? ORDER.newest,
    args,
    page
  );

  return {
    ...result,
    items: result.items.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      created_at: r.created_at,
      courseCount: Number(r.course_count ?? 0),
      academic_years: r.year_name ? { name_ar: r.year_name } : null,
    })),
  };
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
  /** Successful payments only — free grants and full coupons excluded. */
  revenue: number;
  paidOrders: number;
  lastSaleAt: string | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
};

export async function listTeachersAdmin(page: number): Promise<PaginatedResult<AdminTeacherRow>> {
  await requireAdmin();

  /*
    EVERYTHING ABOUT A TEACHER IN ONE QUERY.

    The stored `students_count` and `courses_count` are maintained again
    (see lib/data/counters.ts), but the money is computed live and
    deliberately is NOT stored: revenue is the one number nobody should
    ever read from a column that might have drifted.

    REVENUE EXCLUDES FREE ACCESS. Only successful payments count —
    admin grants and 100%-discount coupons produce an enrolment and no
    payment, so they never appear here. `amount` is what the student
    actually paid, after any discount.

    Subqueries rather than joins: a teacher with three courses and
    twenty payments would otherwise be sixty rows to aggregate, and a
    teacher with none would vanish from an inner join.
  */
  const result = await paginate<
    Omit<AdminTeacherRow, "rating" | "profiles"> & {
      rating: string;
      full_name: string | null;
      avatar_url: string | null;
      live_students: number;
      revenue: string | null;
      paid_orders: number;
      last_sale_at: string | null;
    }
  >(
    `SELECT t.id, t.profile_id, t.title, t.specialty, t.institution, t.bio,
            t.rating, t.students_count, t.courses_count,
            p.full_name, p.avatar_url,

            (SELECT COUNT(DISTINCT e.user_id)
               FROM enrollments e
               JOIN courses c ON c.id = e.course_id
              WHERE c.teacher_id = t.id AND c.deleted_at IS NULL
                AND e.deleted_at IS NULL
                AND (e.expires_at IS NULL OR e.expires_at > UTC_TIMESTAMP(3))
            ) AS live_students,

            (SELECT COALESCE(SUM(pay.amount), 0)
               FROM payments pay
               JOIN courses c2 ON c2.id = pay.course_id
              WHERE c2.teacher_id = t.id AND pay.status = 'success'
            ) AS revenue,

            (SELECT COUNT(*)
               FROM payments pay2
               JOIN courses c3 ON c3.id = pay2.course_id
              WHERE c3.teacher_id = t.id AND pay2.status = 'success'
            ) AS paid_orders,

            (SELECT MAX(pay3.created_at)
               FROM payments pay3
               JOIN courses c4 ON c4.id = pay3.course_id
              WHERE c4.teacher_id = t.id AND pay3.status = 'success'
            ) AS last_sale_at

       FROM teachers t
       LEFT JOIN profiles p ON p.id = t.profile_id`,
    `teachers t`,
    "t.deleted_at IS NULL",
    "revenue DESC, t.created_at DESC",
    [],
    page
  );

  return {
    ...result,
    items: result.items.map((r) => ({
      id: r.id,
      profile_id: r.profile_id,
      title: r.title,
      specialty: r.specialty,
      institution: r.institution,
      bio: r.bio,
      rating: Number(r.rating),
      /* The live figure, not the stored one — they should agree, and
         showing the computed value means a drift is visible rather
         than silently believed. */
      students_count: Number(r.live_students ?? 0),
      courses_count: Number(r.courses_count ?? 0),
      revenue: Number(r.revenue ?? 0),
      paidOrders: Number(r.paid_orders ?? 0),
      lastSaleAt: r.last_sale_at,
      profiles: r.full_name ? { full_name: r.full_name, avatar_url: r.avatar_url } : null,
    })),
  };
}

// ---------------------------------------------------------------------
// Academic years — fixed 7 rows, no pagination needed
// ---------------------------------------------------------------------
export async function listAcademicYearsAdmin() {
  await requireAdmin();

  return query<{
    id: string;
    year_number: number;
    name_ar: string;
    name_en: string | null;
    name_fr: string | null;
    sort_order: number;
  }>(
    `SELECT id, year_number, name_ar, name_en, name_fr, sort_order
       FROM academic_years ORDER BY sort_order ASC`
  );
}

export async function getCourseCountsByYear(): Promise<Map<string, number>> {
  await requireAdmin();

  // GROUP BY, not a full read of every course tallied in a loop.
  const rows = await query<{ academic_year_id: string; n: number }>(
    `SELECT academic_year_id, COUNT(*) AS n
       FROM courses WHERE deleted_at IS NULL
      GROUP BY academic_year_id`
  );

  return new Map(rows.map((r) => [r.academic_year_id, Number(r.n)]));
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
  await requireAdmin();

  const result = await paginate<{
    id: string;
    plan_type: string;
    starts_at: string;
    expires_at: string | null;
    full_name: string | null;
    course_title: string | null;
  }>(
    `SELECT e.id, e.plan_type, e.starts_at, e.expires_at,
            p.full_name, c.title AS course_title
       FROM enrollments e
       LEFT JOIN profiles p ON p.id = e.user_id
       LEFT JOIN courses c  ON c.id = e.course_id`,
    `enrollments e`,
    "e.deleted_at IS NULL",
    "e.created_at DESC",
    [],
    page
  );

  return {
    ...result,
    items: result.items.map((r) => ({
      id: r.id,
      plan_type: r.plan_type,
      starts_at: r.starts_at,
      expires_at: r.expires_at,
      profiles: r.full_name ? { full_name: r.full_name } : null,
      courses: r.course_title ? { title: r.course_title } : null,
    })),
  };
}

// ---------------------------------------------------------------------
// Payments
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
  await requireAdmin();

  const result = await paginate<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    plan_type: string;
    created_at: string;
    full_name: string | null;
    course_title: string | null;
  }>(
    `SELECT pay.id, pay.amount, pay.currency, pay.status, pay.plan_type, pay.created_at,
            p.full_name, c.title AS course_title
       FROM payments pay
       LEFT JOIN profiles p ON p.id = pay.user_id
       LEFT JOIN courses c  ON c.id = pay.course_id`,
    `payments pay`,
    "1 = 1",
    "pay.created_at DESC",
    [],
    page
  );

  return {
    ...result,
    items: result.items.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      plan_type: r.plan_type,
      created_at: r.created_at,
      profiles: r.full_name ? { full_name: r.full_name } : null,
      courses: r.course_title ? { title: r.course_title } : null,
    })),
  };
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
  await requireAdmin();

  const result = await paginate<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    full_name: string | null;
    course_title: string | null;
  }>(
    `SELECT r.id, r.rating, r.comment, r.created_at,
            p.full_name, c.title AS course_title
       FROM reviews r
       LEFT JOIN profiles p ON p.id = r.user_id
       LEFT JOIN courses c  ON c.id = r.course_id`,
    `reviews r`,
    "r.deleted_at IS NULL",
    "r.created_at DESC",
    [],
    page
  );

  return {
    ...result,
    items: result.items.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      profiles: r.full_name ? { full_name: r.full_name } : null,
      courses: r.course_title ? { title: r.course_title } : null,
    })),
  };
}

// ---------------------------------------------------------------------
// Pricing overview
// ---------------------------------------------------------------------
export type AdminPricingRow = {
  courseId: string;
  courseTitle: string;
  threeMonthsPrice: number | null;
  lifetimePrice: number | null;
};

export async function listPricingOverview(page: number): Promise<PaginatedResult<AdminPricingRow>> {
  await requireAdmin();

  // Both plan prices pivoted into the row with correlated subqueries,
  // replacing a second query plus a filter-per-course in JavaScript.
  const result = await paginate<{
    id: string;
    title: string;
    three_months_price: string | null;
    lifetime_price: string | null;
  }>(
    `SELECT c.id, c.title,
            (SELECT price FROM course_prices cp
              WHERE cp.course_id = c.id AND cp.plan_type = 'three_months' AND cp.is_active = 1
              LIMIT 1) AS three_months_price,
            (SELECT price FROM course_prices cp
              WHERE cp.course_id = c.id AND cp.plan_type = 'lifetime' AND cp.is_active = 1
              LIMIT 1) AS lifetime_price
       FROM courses c`,
    `courses c`,
    "c.deleted_at IS NULL",
    "c.created_at DESC",
    [],
    page
  );

  return {
    ...result,
    items: result.items.map((c) => ({
      courseId: c.id,
      courseTitle: c.title,
      threeMonthsPrice: c.three_months_price === null ? null : Number(c.three_months_price),
      lifetimePrice: c.lifetime_price === null ? null : Number(c.lifetime_price),
    })),
  };
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
  /** How many files are attached under this lesson's video. */
  resourceCount: number;
};

export async function listLessonsAdmin(page: number): Promise<PaginatedResult<AdminLessonRow>> {
  await requireAdmin();

  const result = await paginate<{
    id: string;
    title: string;
    is_free_preview: number;
    video_id: string | null;
    section_title: string | null;
    course_title: string | null;
    resource_count: number;
  }>(
    /*
      The attachment count is a subquery, not a join with GROUP BY: a
      lesson with no attachments must still appear, and grouping a
      LEFT JOIN alongside the two above would multiply their rows. It
      reads lesson_resources_lesson_idx (lesson_id, sort_order).
    */
    `SELECT l.id, l.title, l.is_free_preview, l.video_id,
            s.title AS section_title,
            c.title AS course_title,
            (SELECT COUNT(*) FROM lesson_resources r
              WHERE r.lesson_id = l.id AND r.deleted_at IS NULL) AS resource_count
       FROM lessons l
       LEFT JOIN course_sections s ON s.id = l.section_id
       LEFT JOIN courses c         ON c.id = s.course_id`,
    `lessons l`,
    "l.deleted_at IS NULL",
    "l.created_at DESC",
    [],
    page
  );

  return {
    ...result,
    items: result.items.map((r) => ({
      id: r.id,
      title: r.title,
      is_free_preview: toBool(r.is_free_preview),
      hasVideo: r.video_id !== null,
      sectionTitle: r.section_title,
      courseTitle: r.course_title,
      resourceCount: Number(r.resource_count ?? 0),
    })),
  };
}

// ---------------------------------------------------------------------
// Videos (across all courses)
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
  await requireAdmin();

  // Provider ids are NOT selected: this list shows which lesson a video
  // belongs to and whether it is ready, and nothing on the page needs a
  // playable id.
  const result = await paginate<{
    id: string;
    title: string;
    status: string;
    source: string;
    duration_seconds: number;
    lesson_title: string | null;
    course_title: string | null;
  }>(
    `SELECT v.id, v.title, v.status, v.source, v.duration_seconds,
            l.title AS lesson_title,
            c.title AS course_title
       FROM videos v
       LEFT JOIN lessons l         ON l.video_id = v.id AND l.deleted_at IS NULL
       LEFT JOIN course_sections s ON s.id = l.section_id
       LEFT JOIN courses c         ON c.id = s.course_id`,
    `videos v`,
    "v.deleted_at IS NULL",
    "v.created_at DESC",
    [],
    page
  );

  return {
    ...result,
    items: result.items.map((v) => ({
      id: v.id,
      title: v.title,
      status: v.status,
      source: v.source,
      duration_seconds: v.duration_seconds,
      lessonTitle: v.lesson_title,
      courseTitle: v.course_title,
    })),
  };
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

export async function listSentNotifications(
  page: number
): Promise<PaginatedResult<AdminNotificationRow>> {
  await requireAdmin();

  /*
    A broadcast writes one row per recipient with identical
    (title, body, created_at), so the list groups them — showing
    thousands of identical rows would be useless.

    The grouping is a real GROUP BY now rather than a 500-row fetch
    folded into a Map. That also fixes a quiet bug: the old code capped
    at 500 notification rows before grouping, so on a platform with more
    than 500 notifications the older broadcasts simply disappeared from
    this list, and the recipient counts on the ones that remained were
    wrong.

    MIN(id) because a group has many ids and the list only needs a
    stable key.
  */
  const [rows, total] = await Promise.all([
    query<{
      id: string;
      title: string;
      body: string | null;
      type: string;
      created_at: string;
      recipient_count: number;
    }>(
      `SELECT MIN(id) AS id, title, body, type, created_at, COUNT(*) AS recipient_count
         FROM notifications
        GROUP BY title, body, type, created_at
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
      [PAGE_SIZE, offsetFor(page)]
    ),
    queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM (
         SELECT 1 FROM notifications GROUP BY title, body, type, created_at
       ) grouped`
    ),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      type: r.type,
      created_at: r.created_at,
      recipientCount: Number(r.recipient_count),
    })),
    totalCount: Number(total?.n ?? 0),
    page,
    pageSize: PAGE_SIZE,
  };
}
