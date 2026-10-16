import "server-only";
import { query, queryOne, toBool, type SqlValue } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/db/guard";
import { STAGES, EMPTY_PROGRESS, type Stage } from "@/lib/study/tracking";

export {
  STAGES,
  STAGE_LABELS,
  STAGE_GROUPS,
  computeSubjectCompletion,
  daysUntilExam,
  type Stage,
} from "@/lib/study/tracking";

/**
 * Reads for the study tracker.
 *
 * The Supabase version said visibility was "the database's job, not this
 * layer's": can_view_study_subject (migration 0035) let an admin see
 * every subject while a student saw only published ones matching their
 * own academic year.
 *
 * That function is gone. Without a replacement, every student would see
 * every subject — including unpublished drafts an admin is still writing,
 * and other years' syllabi. `visibilityFilter()` below is that rule,
 * written out once and applied by both read paths.
 */

export type StudySubjectSummary = {
  id: string;
  title: string;
  description: string | null;
  academicYearId: string | null;
  isPublished: boolean;
  position: number;
  itemCount: number;
};

export type StudyItem = {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  position: number;
  progress: Record<Stage, boolean>;
};

export type StudySubjectDetail = StudySubjectSummary & {
  items: StudyItem[];
  /** The CALLER'S own exam date for this subject — students set their
   *  own, so this is per-student and null until they choose one. */
  examDate: string | null;
};

/**
 * The replacement for can_view_study_subject().
 *
 * An admin sees everything. Anyone else sees published subjects that
 * either carry no academic year (platform-wide) or match their own.
 * A signed-out visitor sees nothing — the tracker is not public.
 */
async function visibilityFilter(): Promise<{ sql: string; args: SqlValue[] } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.role === "admin") return { sql: "1 = 1", args: [] };

  return {
    sql: `s.is_published = 1
          AND (s.academic_year_id IS NULL
               OR s.academic_year_id = (SELECT academic_year_id FROM profiles WHERE id = ?))`,
    args: [user.id],
  };
}

/** Subjects the caller may see, with their lesson counts. */
export async function listStudySubjects(): Promise<StudySubjectSummary[]> {
  const visible = await visibilityFilter();
  if (!visible) return [];

  // COUNT in SQL rather than embedding every item row and filtering the
  // soft-deleted ones in JavaScript.
  const rows = await query<{
    id: string;
    title: string;
    description: string | null;
    academic_year_id: string | null;
    is_published: number;
    position: number;
    item_count: number;
  }>(
    `SELECT s.id, s.title, s.description, s.academic_year_id, s.is_published, s.position,
            (SELECT COUNT(*) FROM study_items i
              WHERE i.subject_id = s.id AND i.deleted_at IS NULL) AS item_count
       FROM study_subjects s
      WHERE s.deleted_at IS NULL AND ${visible.sql}
      ORDER BY s.position ASC, s.created_at ASC`,
    visible.args
  );

  return rows.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    academicYearId: s.academic_year_id,
    isPublished: toBool(s.is_published),
    position: s.position,
    itemCount: Number(s.item_count),
  }));
}

/**
 * One subject with its lessons, plus the CALLER'S own marks and exam
 * date merged on.
 *
 * Progress is fetched in a single query for the whole subject and joined
 * in memory — never one lookup per lesson. When `userId` is omitted (the
 * admin structure editor) no progress or exam query runs and every
 * lesson reports the empty set, which keeps that screen honest: it shows
 * the syllabus, not somebody's checkmarks.
 */
export async function getStudySubjectDetail(
  subjectId: string,
  userId?: string
): Promise<StudySubjectDetail | null> {
  const visible = await visibilityFilter();
  if (!visible) return null;

  // The same visibility clause as the list: without it, a student could
  // open an unpublished subject by guessing its id.
  const subject = await queryOne<{
    id: string;
    title: string;
    description: string | null;
    academic_year_id: string | null;
    is_published: number;
    position: number;
  }>(
    `SELECT s.id, s.title, s.description, s.academic_year_id, s.is_published, s.position
       FROM study_subjects s
      WHERE s.id = ? AND s.deleted_at IS NULL AND ${visible.sql}`,
    [subjectId, ...visible.args]
  );

  if (!subject) return null;

  const rows = await query<{
    id: string;
    title: string;
    estimated_minutes: number | null;
    position: number;
  }>(
    `SELECT id, title, estimated_minutes, position
       FROM study_items
      WHERE subject_id = ? AND deleted_at IS NULL
      ORDER BY position ASC`,
    [subjectId]
  );

  let progressByItem = new Map<string, Record<Stage, boolean>>();
  let examDate: string | null = null;

  if (userId) {
    const [progressRows, exam] = await Promise.all([
      rows.length > 0
        ? query<Record<string, unknown>>(
            `SELECT item_id, couche_1, couche_2, couche_3, qcm_1, qcm_2, qcm_3, revision
               FROM study_item_progress
              WHERE user_id = ? AND item_id IN (${rows.map(() => "?").join(",")})`,
            [userId, ...rows.map((r) => r.id)]
          )
        : Promise.resolve([]),
      queryOne<{ exam_date: string }>(
        `SELECT exam_date FROM study_subject_exams WHERE user_id = ? AND subject_id = ?`,
        [userId, subjectId]
      ),
    ]);

    progressByItem = new Map(
      progressRows.map((p) => [
        p.item_id as string,
        // TINYINT(1) comes back as 0/1, not a boolean.
        Object.fromEntries(STAGES.map((s) => [s, toBool(p[s] as number)])) as Record<Stage, boolean>,
      ])
    );
    examDate = exam?.exam_date ?? null;
  }

  return {
    id: subject.id,
    title: subject.title,
    description: subject.description,
    academicYearId: subject.academic_year_id,
    isPublished: toBool(subject.is_published),
    position: subject.position,
    itemCount: rows.length,
    examDate,
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      estimatedMinutes: r.estimated_minutes,
      position: r.position,
      progress: progressByItem.get(r.id) ?? { ...EMPTY_PROGRESS },
    })),
  };
}

export type StudentProgressSummary = {
  userId: string;
  fullName: string;
  doneItems: number;
  pct: number;
};

/**
 * Admin monitoring: how far each student has got in one subject.
 *
 * This reads every student's marks, which under RLS only an admin could
 * select. requireAdmin() is that restriction now — without it this is a
 * report on the whole cohort available to any of them.
 *
 * Students who have never touched the subject do not appear; the caller
 * renders "nobody has started" for an empty list rather than this
 * function inventing zero-rows for the whole student body.
 */
export async function getSubjectStudentProgress(
  subjectId: string
): Promise<{ students: StudentProgressSummary[]; itemCount: number }> {
  await requireAdmin();

  const items = await query<{ id: string }>(
    `SELECT id FROM study_items WHERE subject_id = ? AND deleted_at IS NULL`,
    [subjectId]
  );
  if (items.length === 0) return { students: [], itemCount: 0 };

  /*
    "Done" means all seven stages ticked, counted in SQL.

    The condition is spelled out rather than looped in JavaScript so the
    database returns one row per student instead of one per student per
    lesson — on a cohort of 300 with 40 lessons that is 300 rows rather
    than 12,000.
  */
  const rows = await query<{ user_id: string; full_name: string | null; done: number }>(
    `SELECT p.user_id, pr.full_name,
            SUM(CASE WHEN p.couche_1 = 1 AND p.couche_2 = 1 AND p.couche_3 = 1
                      AND p.qcm_1 = 1 AND p.qcm_2 = 1 AND p.qcm_3 = 1
                      AND p.revision = 1
                     THEN 1 ELSE 0 END) AS done
       FROM study_item_progress p
       JOIN profiles pr ON pr.id = p.user_id
      WHERE p.item_id IN (${items.map(() => "?").join(",")})
      GROUP BY p.user_id, pr.full_name`,
    items.map((i) => i.id)
  );

  const students = rows
    .map((r) => ({
      userId: r.user_id,
      fullName: r.full_name ?? "طالب",
      doneItems: Number(r.done),
      pct: Math.round((Number(r.done) / items.length) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);

  return { students, itemCount: items.length };
}
