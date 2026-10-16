import Link from "next/link";
import { Radio, CalendarDays, Clock, Users } from "lucide-react";
import { query } from "@/lib/db";
import { getTeacherScope } from "@/lib/data/teacher";
import { joinWindow, listAttendance, type MeetingWithContext } from "@/lib/data/meetings";
import { getDictionary } from "@/lib/i18n/locale";
import { formatHoursMinutes } from "@/lib/format/duration";

export const dynamic = "force-dynamic";

export default async function TeacherMeetingsPage() {
  const { dict, locale } = await getDictionary();
  const t = dict.teacher.meetings;

  const scope = await getTeacherScope();
  if (!scope) return null;

  /*
    Sessions this account HOSTS, resolved through its own teachers row —
    not every session on its courses. An admin scheduling a session for
    another teacher should not have it appear here as the host's.
  */
  const meetings = await query<MeetingWithContext>(
    `SELECT m.id, m.title, m.description, m.course_id, m.academic_year_id, m.teacher_id,
            m.room_name, m.starts_at, m.duration_minutes, m.status, m.recording_url,
            c.title AS course_title, c.slug AS course_slug,
            y.name_ar AS year_name_ar, y.name_en AS year_name_en,
            p.full_name AS teacher_name
       FROM meetings m
       LEFT JOIN courses c        ON c.id = m.course_id
       LEFT JOIN academic_years y ON y.id = m.academic_year_id
       LEFT JOIN teachers t       ON t.id = m.teacher_id
       LEFT JOIN profiles p       ON p.id = t.profile_id
      WHERE m.deleted_at IS NULL
        AND m.teacher_id IN (SELECT id FROM teachers WHERE profile_id = ?)
      ORDER BY m.starts_at DESC
      LIMIT 50`,
    [scope.profileId]
  );

  const attendance = await Promise.all(meetings.map((m) => listAttendance(m.id)));

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{t.subtitle}</p>

      {meetings.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border-light bg-white px-lg py-12 text-center">
          <Radio size={26} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
          <p className="mt-3 text-[14px] text-text-secondary-light">{t.empty}</p>
          <p className="mt-1 text-[12.5px] text-text-muted-light">{t.askAdmin}</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {meetings.map((m, i) => {
            const win = joinWindow(m);
            const present = attendance[i];
            return (
              <li key={m.id} className="rounded-xl border border-border-light bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-text-primary-light">{m.title}</h2>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-muted-light">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={13} />
                        <span className="num">{fmt.format(new Date(`${m.starts_at.replace(" ", "T")}Z`))}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} />
                        <span className="num">{m.duration_minutes}</span> {dict.meetings.minutes}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users size={13} />
                        <span className="num">{present.length}</span>
                      </span>
                    </p>
                  </div>

                  {win.isOpen && (
                    <Link
                      href={`/dashboard/meetings/${m.id}`}
                      className="shrink-0 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white"
                    >
                      {dict.meetings.joinNow}
                    </Link>
                  )}
                </div>

                {present.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 border-t border-border-light pt-3 text-[12px] text-text-secondary-light">
                    {present.map((a) => (
                      <li key={a.user_id} className="flex justify-between gap-3">
                        <span className="truncate">{a.full_name}</span>
                        <span className="num shrink-0">{formatHoursMinutes(a.seconds_present)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
