import { CalendarClock, Users } from "lucide-react";
import { query } from "@/lib/db";
import { requireRouteAccess } from "@/lib/auth/session";
import { listMeetingsForAdmin, listAttendance, joinWindow } from "@/lib/data/meetings";
import { getDictionary } from "@/lib/i18n/locale";
import { MeetingForm } from "@/components/admin/meetings/MeetingForm";
import { formatHoursMinutes } from "@/lib/format/duration";

export const dynamic = "force-dynamic";

export default async function AdminMeetingsPage() {
  await requireRouteAccess("/admin");
  const { dict, locale } = await getDictionary();
  const t = dict.admin.meetings;

  const [meetings, courses, years, teachers] = await Promise.all([
    listMeetingsForAdmin(),
    query<{ id: string; title: string }>(
      `SELECT id, title FROM courses WHERE deleted_at IS NULL ORDER BY title LIMIT 200`
    ),
    query<{ id: string; name_ar: string; name_en: string | null }>(
      `SELECT id, name_ar, name_en FROM academic_years ORDER BY sort_order`
    ),
    query<{ id: string; full_name: string }>(
      `SELECT t.id, p.full_name
         FROM teachers t
         JOIN profiles p ON p.id = t.profile_id
        WHERE p.deleted_at IS NULL
        ORDER BY p.full_name LIMIT 200`
    ),
  ]);

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const statusLabel = {
    scheduled: t.statusScheduled,
    live: t.statusLive,
    ended: t.statusEnded,
    cancelled: t.statusCancelled,
  } as const;

  const attendance = await Promise.all(meetings.map((m) => listAttendance(m.id)));

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{t.subtitle}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          {meetings.length === 0 ? (
            <div className="rounded-xl border border-border-light bg-white px-lg py-12 text-center">
              <CalendarClock size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
              <p className="mt-3 text-[14px] text-text-secondary-light">{t.noneYet}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {meetings.map((m, i) => {
                const win = joinWindow(m);
                const present = attendance[i];
                return (
                  <li key={m.id} className="rounded-xl border border-border-light bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-[15px] font-semibold text-text-primary-light">{m.title}</h2>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-primary">
                        {win.isOpen ? t.statusLive : statusLabel[m.status]}
                      </span>
                    </div>

                    <p className="num mt-1.5 text-[12.5px] text-text-muted-light">
                      {fmt.format(new Date(`${m.starts_at.replace(" ", "T")}Z`))} · {m.duration_minutes} min
                    </p>

                    <p className="mt-1 text-[12.5px] text-text-secondary-light">
                      {m.course_title ?? (locale === "en" ? m.year_name_en ?? m.year_name_ar : m.year_name_ar)}
                      {m.teacher_name ? ` · ${m.teacher_name}` : ""}
                    </p>

                    <div className="mt-3 border-t border-border-light pt-3">
                      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-primary-light">
                        <Users size={13} />
                        {t.attendance} (<span className="num">{present.length}</span>)
                      </p>
                      {present.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1 text-[12px] text-text-secondary-light">
                          {present.map((a) => (
                            <li key={a.user_id} className="flex justify-between gap-3">
                              <span className="truncate">{a.full_name}</span>
                              <span className="num shrink-0">{formatHoursMinutes(a.seconds_present)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="rounded-xl border border-border-light bg-white p-4">
          <h2 className="mb-4 text-[15px] font-semibold text-text-primary-light">{t.create}</h2>
          <MeetingForm courses={courses} years={years} teachers={teachers} />
        </aside>
      </div>
    </div>
  );
}
