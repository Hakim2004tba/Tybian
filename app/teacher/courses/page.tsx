import Link from "next/link";
import { BookOpen, Star, Users, ArrowLeft } from "lucide-react";
import { getTeacherScope, listCourses } from "@/lib/data/teacher";
import { getDictionary } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * A teacher sees only the courses whose `courses.teacher_id` maps back
 * to their own `teachers` row.
 *
 * That scoping used to be described as coming from an RLS policy. It
 * does not any more — the policies went with Supabase — so it is done
 * in one place, lib/data/teacher.ts, and every page in this space reads
 * through it. An unfiltered SELECT here would show each teacher every
 * other teacher's drafts.
 */
export default async function TeacherCoursesPage() {
  const { dict } = await getDictionary();
  const t = dict.teacher.courses;

  const scope = await getTeacherScope();
  if (!scope) return null;
  const courses = await listCourses(scope);

  const statusLabel: Record<string, string> = {
    published: t.statusPublished,
    draft: t.statusDraft,
    archived: t.statusArchived,
  };

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>

      {courses.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border-light bg-white px-lg py-12 text-center">
          <BookOpen size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
          <p className="mt-3 text-[14px] text-text-secondary-light">{dict.teacher.noCourses}</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id} className="rounded-xl border border-border-light bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 text-[15px] font-semibold text-text-primary-light">{c.title}</h2>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {statusLabel[c.status] ?? c.status}
                </span>
              </div>

              <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-muted-light">
                <span className="flex items-center gap-1.5">
                  <BookOpen size={13} />
                  <span className="num">{c.lesson_count}</span> {t.lessons}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={13} />
                  <span className="num">{c.students_count}</span> {t.students}
                </span>
                {Number(c.rating) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Star size={13} className="text-gold" fill="currentColor" />
                    <span className="num">{Number(c.rating).toFixed(1)}</span>
                  </span>
                )}
              </p>

              <Link
                href={`/courses/${c.slug}`}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"
              >
                {t.open}
                <ArrowLeft size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
