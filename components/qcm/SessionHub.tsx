"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Target, Crosshair, Trophy, Clock, Layers } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { clock } from "@/lib/qcm/session";
import { QcmMark } from "@/components/qcm/QcmMark";
import { SessionCard } from "@/components/qcm/SessionCard";
import { NewSessionModal } from "@/components/qcm/NewSessionModal";
import type { SessionRow, BankStats, PickerTopic } from "@/lib/data/qcm-sessions";

/**
 * The QCM home: what you have done, and the way to do more.
 *
 * THIS REPLACED THE SUBJECT GRID as the destination of the sidebar
 * link. Browsing subjects was the first thing a student saw and the
 * last thing they needed — the common act is resuming the session they
 * left, and that was unreachable because sessions were not saved at
 * all. Subjects still exist, now inside the picker where choosing one
 * is actually part of a task.
 */
export function SessionHub({
  sessions,
  stats,
  topics,
}: {
  sessions: SessionRow[];
  stats: BankStats;
  topics: PickerTopic[];
}) {
  const { t } = useI18n();
  const params = useSearchParams();
  const preselect = params.get("topic");
  const [open, setOpen] = useState(Boolean(preselect));

  /* Arriving from a topic in the subject browser opens the picker with
     that topic already ticked, so "practise this topic" stays one
     click without a second, unsaved way of running questions. */
  useEffect(() => {
    if (preselect) setOpen(true);
  }, [preselect]);

  const coverage = stats.bankSize > 0 ? Math.round((stats.mastered / stats.bankSize) * 100) : 0;

  return (
    <div className="px-md py-lg md:px-xl md:py-xl">
      {/* ================= head ================= */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-[#3D1E8F] px-5 py-6 md:px-7 md:py-7">
        <div className="pointer-events-none absolute -end-12 -top-20 h-52 w-52 animate-drift rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 start-16 h-44 w-44 animate-drift rounded-full bg-[#D946C8]/25 blur-3xl [animation-delay:-9s]" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <QcmMark className="h-7 w-auto text-white" title="QCM" />
            <h1 className="mt-2.5 text-[22px] font-extrabold leading-tight text-white md:text-[26px]">
              {t.bank.hubHeading}
            </h1>
            <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-white/70">
              {t.bank.hubLead}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-5 py-3 text-[14px] font-bold text-primary shadow-lg transition hover:bg-white/90 active:scale-[0.99]"
          >
            <Plus size={17} strokeWidth={2.6} />
            {t.bank.newSession}
          </button>
        </div>

        {/* ---- the four figures ---- */}
        <div className="relative mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat icon={<Target size={14} />} value={String(stats.answered)} label={t.bank.statsAnswered} />
          <Stat
            icon={<Crosshair size={14} />}
            value={stats.answered > 0 ? `${stats.accuracy}%` : "—"}
            label={t.bank.statsAccuracy}
          />
          <Stat
            icon={<Trophy size={14} />}
            value={String(stats.mastered)}
            label={t.bank.statsMastered}
            hint={stats.bankSize > 0 ? `${coverage}% ${t.bank.ofBank}` : undefined}
          />
          <Stat icon={<Clock size={14} />} value={clock(stats.seconds)} label={t.bank.statsTime} />
        </div>
      </header>

      {/* ================= sessions ================= */}
      {sessions.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border-light bg-surface-light px-5 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Layers size={22} />
          </span>
          <p className="text-[15px] font-bold text-text-primary-light">{t.bank.noSessions}</p>
          <p className="max-w-sm text-[13px] text-text-secondary-light">{t.bank.noSessionsHint}</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-1 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[#D946C8] px-5 py-3 text-[14px] font-bold text-white shadow-lg shadow-primary/25 transition hover:brightness-110"
          >
            <Plus size={16} strokeWidth={2.6} />
            {t.bank.newSession}
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sessions.map((s, i) => (
            <SessionCard key={s.id} session={s} recent={i === 0 && !s.finished} />
          ))}
        </div>
      )}

      {/* Browsing the bank by subject is still reachable, just no longer
          the front door. */}
      <div className="mt-4 text-center">
        <Link
          href="/dashboard/qcm/subjects"
          className="text-[12.5px] text-text-muted-light underline-offset-4 transition hover:text-primary hover:underline"
        >
          {t.bank.hubSubtitle}
        </Link>
      </div>

      {open && (
        <NewSessionModal
          topics={topics}
          preselect={preselect}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({
  icon, value, label, hint,
}: { icon: React.ReactNode; value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.12] px-3.5 py-3 backdrop-blur-sm">
      <p className="flex items-center gap-1.5 text-[11px] text-white/70">
        {icon}
        {label}
      </p>
      <p className="num mt-1 text-[20px] font-extrabold leading-none text-white">{value}</p>
      {hint && <p className="num mt-1 text-[10.5px] text-white/55">{hint}</p>}
    </div>
  );
}
