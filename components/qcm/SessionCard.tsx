"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Play, RotateCcw, BarChart3, Trash2, Clock, Pencil, Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { clock } from "@/lib/qcm/session";
import type { SessionRow } from "@/lib/data/qcm-sessions";
import { deleteSessionAction, restartSessionAction, renameSessionAction } from "@/lib/actions/qcm-sessions";

/**
 * One past session.
 *
 * TWO NUMBERS, NOT ONE, because they answer different questions and a
 * student needs both: the ring is PROGRESS (how far through the set)
 * and "accuracy" is how much of what they attempted was right. A
 * session can be 20% done and 100% accurate; collapsing them into one
 * percentage hides whichever one the student actually needed.
 */
export function SessionCard({ session, recent }: { session: SessionRow; recent: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title);

  const CIRC = universalCircumference;
  const ring = session.percent;

  /* Accuracy is the one that carries a judgement, so it is the one
     that takes a colour. */
  const accTone =
    session.answered === 0
      ? "text-text-muted-light"
      : session.accuracy >= 70
        ? "text-success"
        : session.accuracy >= 50
          ? "text-gold"
          : "text-error";

  const date = new Date(session.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className={
        "animate-rise-in relative overflow-hidden rounded-3xl border p-4 transition md:p-5 " +
        (recent
          ? "border-success/40 bg-gradient-to-br from-success/[0.06] to-transparent"
          : "border-border-light bg-surface-light")
      }
    >
      {recent && (
        <span className="absolute -start-px -top-px flex items-center gap-1.5 rounded-br-2xl rounded-tl-3xl bg-success px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white/90 motion-safe:animate-breathe" />
          {t.bank.recent}
        </span>
      )}

      <div className={"flex items-start gap-4 " + (recent ? "mt-6" : "")}>
        {/* ---- the progress ring ---- */}
        <div className="relative h-[72px] w-[72px] shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" strokeWidth="11" className="stroke-primary/12" />
            <circle
              cx="60" cy="60" r="52" fill="none" strokeWidth="11" strokeLinecap="round"
              className="stroke-primary transition-[stroke-dashoffset] duration-700"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - ring / 100)}
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="num text-[20px] font-extrabold text-primary">{ring}</span>
            <span className="num text-[10px] text-primary/60">%</span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {editing ? (
              <form
                className="flex min-w-0 flex-1 items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    await renameSessionAction(session.id, title);
                    setEditing(false);
                  });
                }}
              >
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-primary/40 bg-surface-light px-2 py-1 text-[14px] text-text-primary-light outline-none"
                />
                <button type="submit" className="text-success" aria-label="OK"><Check size={15} /></button>
                <button type="button" onClick={() => { setTitle(session.title); setEditing(false); }} className="text-text-muted-light" aria-label="X"><X size={15} /></button>
              </form>
            ) : (
              <h3 dir="auto" className="min-w-0 flex-1 truncate text-[16px] font-extrabold text-text-primary-light">
                {session.title}
              </h3>
            )}

            {!editing && (
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label={t.bank.sessionName}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted-light transition hover:bg-black/[0.05] hover:text-primary"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(t.bank.confirmDelete)) {
                      start(() => deleteSessionAction(session.id).then(() => {}));
                    }
                  }}
                  aria-label={t.bank.deleteSession}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted-light transition hover:bg-error/10 hover:text-error"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>

          <p className="num mt-1 flex items-center gap-1.5 text-[11.5px] text-text-muted-light">
            <Clock size={11.5} />
            {date}
            {session.seconds > 0 && <span className="tabular-nums">· {clock(session.seconds)}</span>}
            <span className={session.finished ? "text-success" : "text-primary"}>
              · {session.finished ? t.bank.sessionDone : t.bank.sessionOpen}
            </span>
          </p>

          {/* ---- the two figures ---- */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-black/[0.035] px-3 py-2">
              <p className="text-[10.5px] text-text-secondary-light">{t.bank.answeredLabel}</p>
              <p className="num text-[14px] font-extrabold text-text-primary-light">
                {session.answered}
                <span className="text-[11px] font-semibold text-text-muted-light">/{session.total}</span>
              </p>
            </div>
            <div className="rounded-xl bg-black/[0.035] px-3 py-2">
              <p className="text-[10.5px] text-text-secondary-light">{t.bank.accuracyLabel}</p>
              <p className={"num text-[14px] font-extrabold " + accTone}>
                {session.answered === 0 ? "—" : `${session.accuracy}%`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---- progress bar ---- */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between px-0.5 pb-1.5">
          <span className="text-[11px] text-text-secondary-light">{t.bank.progressLabel}</span>
          <span className="num text-[11.5px] font-bold text-primary">
            {session.answered} / {session.total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/[0.07]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-[#D946C8] transition-[width] duration-700"
            style={{ width: `${ring}%` }}
          />
        </div>
      </div>

      {/* ---- actions ---- */}
      <div className="mt-3.5 flex items-center gap-2">
        <Link
          href={`/dashboard/qcm/s/${session.id}`}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[#D946C8] text-[14px] font-bold text-white shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.99]"
        >
          <Play size={15} fill="currentColor" />
          {session.finished ? t.bank.reviewSession : t.bank.continueSession}
        </Link>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(t.bank.confirmRestart)) {
              start(() => restartSessionAction(session.id).then(() => {}));
            }
          }}
          aria-label={t.bank.restartSession}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-light text-text-secondary-light transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
        >
          <RotateCcw size={16} />
        </button>

        <Link
          href={`/dashboard/qcm/s/${session.id}?view=analysis`}
          aria-label={t.bank.analysisTitle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-light text-text-secondary-light transition hover:border-primary/40 hover:text-primary"
        >
          <BarChart3 size={16} />
        </Link>
      </div>
    </div>
  );
}

/* 2πr for r=52, the radius every ring in this feature uses. */
const universalCircumference = 326.7;
