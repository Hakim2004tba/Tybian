import Link from "next/link";
import { ListChecks, Target, Clock } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import {
  listStudySubjects,
  getStudySubjectDetail,
  computeSubjectCompletion,
  STAGE_GROUPS,
} from "@/lib/data/study-tracking";
import { StageToggles } from "@/components/dashboard/study/StageToggles";
import { ExamDatePicker } from "@/components/dashboard/study/ExamDatePicker";
import { formatCourseMinutes } from "@/lib/format/duration";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * The student's view of the admin-authored syllabus: the lessons of one
 * subject, and their own seven marks per lesson laid out as the paper
 * tracking grid (1ère / 2ème / 3ème couche, QCM ×3, Révision).
 *
 * RLS decides which subjects appear (published + matching the student's
 * academic year, see can_view_study_subject in 0035), so this page holds
 * no visibility logic of its own — and no create/edit/delete controls,
 * because a student has no write access to the structure.
 *
 * The exam date is the one structural-looking field the student DOES
 * own; it is stored per student, not on the subject.
 */
export default async function StudentStudyPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { dict } = await getDictionary();
  const t = dict.dash;
  const { subject: subjectParam } = await searchParams;
  const user = await getSessionUser();
  const subjects = await listStudySubjects();

  if (subjects.length === 0) return <EmptyShell />;

  const activeId =
    subjectParam && subjects.some((s) => s.id === subjectParam) ? subjectParam : subjects[0].id;
  const detail = await getStudySubjectDetail(activeId, user!.id);

  if (!detail) return <EmptyShell />;

  const completion = computeSubjectCompletion(detail.items);
  const totalMinutes = detail.items.reduce((sum, i) => sum + (i.estimatedMinutes ?? 0), 0);

  return (
    <div className="flex flex-col gap-6 px-md py-lg md:px-xl md:py-xl">
      {subjects.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/study?subject=${s.id}`}
              className={
                s.id === activeId
                  ? "rounded-full bg-academy-deep px-4 py-2 text-[13px] font-semibold text-white"
                  : "rounded-full border border-academy-lavender-deep bg-white/70 px-4 py-2 text-[13px] text-text-secondary-light transition-colors hover:border-primary hover:text-primary"
              }
            >
              {s.title}
            </Link>
          ))}
        </nav>
      )}

      <section className="relative overflow-hidden rounded-xl bg-academy-deep p-lg md:p-xl">
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/25 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <h1 className="text-[24px] font-bold text-white md:text-[28px]">{detail.title}</h1>
          {detail.description && (
            <p className="mt-1.5 text-[14px] text-white/60">{detail.description}</p>
          )}

          <div className="mt-5">
            <ExamDatePicker subjectId={detail.id} examDate={detail.examDate} />
          </div>

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
            <HeaderStat icon={ListChecks} value={String(detail.itemCount)} label={t.common.lessons} />
            <HeaderStat
              icon={Clock}
              value={totalMinutes > 0 ? formatCourseMinutes(totalMinutes) : "—"}
              label={t.study.estimatedTime}
            />
            <HeaderStat icon={Target} value={`${completion.pct}%`} label={t.common.completed} />
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-l from-primary to-secondary"
              style={{ width: `${completion.pct}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-white/50">
            <span className="num">{completion.done}</span> {t.study.completedDot}{" "}
            <span className="num">{completion.inProgress}</span> {t.study.inProgressDot}{" "}
            <span className="num">{completion.notStarted}</span> {t.study.notStarted}
          </p>
        </div>
      </section>

      {detail.items.length === 0 ? (
        <p className="rounded-xl border border-white/70 bg-white px-lg py-10 text-center text-[13.5px] text-text-muted-light">
          {t.study.noLessons}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/70 bg-white">
          <table className="w-full min-w-[620px] border-collapse text-right">
            <thead>
              <tr className="border-b border-academy-lavender bg-academy-lavender-soft">
                <th
                  rowSpan={2}
                  className="px-lg py-2.5 text-right text-[13px] font-semibold text-text-primary-light"
                >
                  {t.common.lesson}
                </th>
                {STAGE_GROUPS.map((g) => (
                  <th
                    key={g.label}
                    colSpan={g.stages.length}
                    className="border-s border-academy-lavender px-2 py-2 text-center text-[12.5px] font-semibold text-text-primary-light"
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-academy-lavender bg-academy-lavender-soft">
                {STAGE_GROUPS.flatMap((g) =>
                  g.stages.map((stage, i) => (
                    <th
                      key={stage}
                      className="num border-s border-academy-lavender px-2 pb-2 text-center text-[10.5px] font-normal text-text-muted-light"
                    >
                      {g.stages.length > 1 ? i + 1 : " "}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-academy-lavender last:border-0 hover:bg-academy-lavender-soft/50"
                >
                  <td className="px-lg py-2.5">
                    <span className="text-[13.5px] text-text-primary-light">{item.title}</span>
                    {item.estimatedMinutes ? (
                      <span className="num mr-2 text-[11.5px] text-text-muted-light">
                        {item.estimatedMinutes} {t.common.minShort}
                      </span>
                    ) : null}
                  </td>
                  <StageToggles
                    itemId={item.id}
                    progress={item.progress}
                    revalidatePath="/dashboard/study"
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HeaderStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Target;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={17} className="text-secondary" strokeWidth={1.75} />
      <div>
        <div className="num text-[16px] font-bold leading-none text-white">{value}</div>
        <div className="mt-1 text-[11.5px] text-white/55">{label}</div>
      </div>
    </div>
  );
}

async function EmptyShell() {
  const { dict } = await getDictionary();
  const t = dict.dash;
  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <div className="rounded-xl border border-white/70 bg-white px-lg py-12 text-center">
        <Target size={28} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
        <p className="mt-3 text-[14px] text-text-secondary-light">{t.study.notPublished}</p>
        <p className="mt-1 text-[12.5px] text-text-muted-light">
          {t.study.adminPreparing}
        </p>
      </div>
    </div>
  );
}
