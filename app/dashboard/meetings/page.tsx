import Link from "next/link";
import { Video, Clock, CalendarDays, UserRound, MessagesSquare } from "lucide-react";
import { listMeetingsForStudent, joinWindow } from "@/lib/data/meetings";
import { getDictionary } from "@/lib/i18n/locale";
import { requireRouteAccess } from "@/lib/auth/session";

export default async function StudentMeetingsPage() {
  await requireRouteAccess("/dashboard");
  const { dict, locale } = await getDictionary();
  const t = dict.meetings;
  const meetings = await listMeetingsForStudent();

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      <h1 className="text-[22px] font-bold text-text-primary-light">{t.title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary-light">{t.subtitle}</p>

      {meetings.length === 0 ? (
        <div className="mt-8 rounded-xl border border-white/70 bg-white px-lg py-12 text-center">
          <Video size={28} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
          <p className="mt-3 text-[14px] text-text-secondary-light">{t.empty}</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {meetings.map((m) => {
            const win = joinWindow(m);
            const scope =
              m.course_title ??
              (locale === "en" ? m.year_name_en ?? m.year_name_ar : m.year_name_ar);

            return (
              <li key={m.id} className="rounded-xl border border-white/70 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15.5px] font-semibold text-text-primary-light">{m.title}</h2>
                      {win.isOpen && (
                        <span className="flex items-center gap-1.5 rounded-full bg-error/10 px-2 py-0.5 text-[11px] font-semibold text-error">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
                          {t.liveNow}
                        </span>
                      )}
                    </div>

                    {m.description && (
                      <p className="mt-1 text-[13px] leading-relaxed text-text-secondary-light">
                        {m.description}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-text-muted-light">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={13} />
                        <span className="num">{fmt.format(new Date(`${m.starts_at.replace(" ", "T")}Z`))}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} />
                        <span className="num">{m.duration_minutes}</span> {t.minutes}
                      </span>
                      {m.teacher_name && (
                        <span className="flex items-center gap-1.5">
                          <UserRound size={13} />
                          {m.teacher_name}
                        </span>
                      )}
                      {scope && (
                        <span>
                          {m.course_title ? t.forCourse : t.forYear} {scope}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {win.isOpen ? (
                      <Link
                        href={`/dashboard/meetings/${m.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
                      >
                        <Video size={15} />
                        {t.joinNow}
                      </Link>
                    ) : (
                      /* Still a link: the discussion is open even when
                         the room is not. */
                      <Link
                        href={`/dashboard/meetings/${m.id}`}
                        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary"
                      >
                        <MessagesSquare size={14} />
                        {dict.meetingChat.title}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
