"use client";

import { useActionState, useEffect, useState } from "react";
import { createMeetingAction, type ActionState } from "@/lib/admin/actions/meetings";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { useI18n } from "@/lib/i18n/I18nProvider";

const initial: ActionState = { error: null };

export function MeetingForm({
  courses,
  years,
  teachers,
}: {
  courses: { id: string; title: string }[];
  years: { id: string; name_ar: string; name_en: string | null }[];
  teachers: { id: string; full_name: string }[];
}) {
  const [state, action] = useActionState(createMeetingAction, initial);
  const { t: T, locale } = useI18n();
  const t = T.admin.meetings;
  const [scope, setScope] = useState<"course" | "year">("course");

  /*
    The browser's offset travels with the form.

    `datetime-local` submits a wall-clock string with no zone, and the
    server stores UTC. Without this the session would be filed at
    whatever the server takes that clock to mean — an hour out on this
    host — which is exactly how a revision session gets announced for
    the wrong time.
  */
  const [tzOffset, setTzOffset] = useState(0);
  useEffect(() => setTzOffset(new Date().getTimezoneOffset()), []);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="tzOffset" value={tzOffset} />

      {state.error && (
        <p className="rounded-md border border-error/30 bg-error/10 px-3.5 py-2.5 text-[13.5px] text-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md border border-success/30 bg-success/10 px-3.5 py-2.5 text-[13.5px] text-success">
          {state.success}
        </p>
      )}

      <Input id="title" name="title" label={t.meetingTitle} required />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-[13.5px] font-semibold">
          {t.description}
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14.5px] outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">{t.scope}</span>
        <div className="flex flex-wrap gap-4 text-[13.5px]">
          <label className="flex items-center gap-2">
            <input type="radio" name="scope" value="course" checked={scope === "course"} onChange={() => setScope("course")} />
            {t.scopeCourse}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="scope" value="year" checked={scope === "year"} onChange={() => setScope("year")} />
            {t.scopeYear}
          </label>
        </div>
      </div>

      {scope === "course" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="courseId" className="text-[13.5px] font-semibold">{t.course}</label>
          <select id="courseId" name="courseId" required className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14.5px] outline-none focus:border-primary">
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="academicYearId" className="text-[13.5px] font-semibold">{t.year}</label>
          <select id="academicYearId" name="academicYearId" required className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14.5px] outline-none focus:border-primary">
            {years.map((y) => (
              <option key={y.id} value={y.id}>{locale === "en" ? y.name_en ?? y.name_ar : y.name_ar}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="teacherId" className="text-[13.5px] font-semibold">{t.teacher}</label>
        <select id="teacherId" name="teacherId" className="rounded-sm border border-border-light bg-surface-light px-3.5 py-2.5 text-[14.5px] outline-none focus:border-primary">
          <option value="">—</option>
          {teachers.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="startsAt" name="startsAt" type="datetime-local" label={t.startsAt} required />
        <Input id="durationMinutes" name="durationMinutes" type="number" label={t.duration} defaultValue="60" />
      </div>

      {/* The Vimeo link. Optional on purpose: a session is scheduled
          first and the event is usually created in Vimeo closer to the
          time, so demanding it here would block the scheduling. */}
      <div>
        <Input
          id="streamUrl"
          name="streamUrl"
          type="url"
          label={t.streamLink}
          placeholder="https://vimeo.com/event/..."
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted-light">
          {t.streamLinkHint}
        </p>
      </div>

      <SubmitButton className="w-fit">{t.save}</SubmitButton>
    </form>
  );
}
