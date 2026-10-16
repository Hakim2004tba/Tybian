import { Users } from "lucide-react";
import { getTeacherScope, listStudents } from "@/lib/data/teacher";
import { getDictionary } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function TeacherStudentsPage() {
  const { dict, locale } = await getDictionary();
  const t = dict.teacher.students;

  const scope = await getTeacherScope();
  if (!scope) return null;
  const students = await listStudents(scope);

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "en-GB", { dateStyle: "medium" });

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{t.subtitle}</p>

      {students.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border-light bg-white px-lg py-12 text-center">
          <Users size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
          <p className="mt-3 text-[14px] text-text-secondary-light">{t.empty}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border-light bg-white">
          <table className="w-full min-w-[620px] text-[13.5px]">
            <thead className="border-b border-border-light text-[12.5px] text-text-muted-light">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{dict.student.fullName}</th>
                <th className="px-4 py-3 text-start font-medium">{dict.teacher.courses.title}</th>
                <th className="px-4 py-3 text-start font-medium">{t.progress}</th>
                <th className="px-4 py-3 text-start font-medium">{t.enrolledOn}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const pct =
                  s.total_lessons > 0
                    ? Math.round((s.completed_lessons / s.total_lessons) * 100)
                    : 0;
                return (
                  <tr key={`${s.user_id}-${s.course_id}`} className="border-b border-border-light last:border-0">
                    <td className="px-4 py-3 text-text-primary-light">{s.full_name}</td>
                    <td className="px-4 py-3 text-text-secondary-light">{s.course_title}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-light">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="num text-[12px] text-text-muted-light">{pct}%</span>
                      </div>
                    </td>
                    <td className="num px-4 py-3 text-text-muted-light">
                      {fmt.format(new Date(`${s.enrolled_at.replace(" ", "T")}Z`))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
