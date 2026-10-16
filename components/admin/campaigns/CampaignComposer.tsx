"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Send, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  createCampaignAction, countAudienceAction, sendBatchAction,
} from "@/lib/admin/actions/campaigns";
import type { CampaignState } from "@/lib/admin/campaigns-shared";

type Audience = "all" | "course" | "year";

const initial: CampaignState = { error: null };

/**
 * Write once, send in batches, watch it go.
 *
 * Sending is the one action here that cannot be undone, so the flow is
 * deliberately two steps and not one button. Step one writes the list
 * and shows exactly how many people it reaches; step two sends, and
 * only after the admin has read that number and pressed again.
 *
 * The loop is driven from the browser on purpose. A server that tries
 * to send four hundred messages inside one request is killed halfway
 * on shared hosting; asking for twenty at a time, from here, means the
 * work survives and the admin can see it moving instead of waiting on
 * a spinner that may already be dead.
 */
export function CampaignComposer({
  courses,
  years,
}: {
  courses: { id: string; title: string }[];
  years: { id: string; name_ar: string }[];
}) {
  const [state, action] = useActionState(createCampaignAction, initial);
  const [audience, setAudience] = useState<Audience>("all");
  const [courseId, setCourseId] = useState("");
  const [yearId, setYearId] = useState("");

  const [count, setCount] = useState<number | null>(null);
  const [, startCount] = useTransition();

  /* The headcount follows the audience, so the number on the button is
     always the number the button will reach. */
  useEffect(() => {
    startCount(async () => {
      const n = await countAudienceAction(
        audience,
        audience === "course" ? courseId || null : null,
        audience === "year" ? yearId || null : null
      );
      setCount(n);
    });
  }, [audience, courseId, yearId]);

  /* ---- sending ---- */
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [sending, setSending] = useState(false);

  async function run(campaignId: string, total: number) {
    setSending(true);
    let sent = 0;
    let failed = 0;
    setProgress({ sent, failed, total });

    /* Until the server says there is nothing pending. The server is the
       one counting, so a reload mid-send does not double-send. */
    for (;;) {
      const result = await sendBatchAction(campaignId);
      sent += result.sent;
      failed += result.failed;
      setProgress({ sent, failed, total });
      if (result.done) break;
    }
    setSending(false);
  }

  const ready = state.campaignId && !sending && !progress;

  return (
    <div className="rounded-2xl border border-border-light bg-white p-4 md:p-5">
      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <p className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-[13px] text-error">
            <AlertTriangle size={15} /> {state.error}
          </p>
        )}

        {/* ---- who ---- */}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-text-primary-light">من يستلم؟</span>
          <div className="flex flex-wrap gap-2">
            {([
              ["all", "كل المسجّلين"],
              ["course", "طلبة دورة"],
              ["year", "طلبة سنة"],
            ] as const).map(([value, label]) => (
              <label
                key={value}
                className={
                  "cursor-pointer rounded-xl border px-3.5 py-2 text-[13px] transition " +
                  (audience === value
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border-light text-text-secondary-light hover:border-primary/40")
                }
              >
                <input
                  type="radio"
                  name="audience"
                  value={value}
                  checked={audience === value}
                  onChange={() => setAudience(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {audience === "course" && (
          <select
            name="courseId"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full rounded-lg border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px]"
          >
            <option value="">— اختر الدورة —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}

        {audience === "year" && (
          <select
            name="academicYearId"
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            className="w-full rounded-lg border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px]"
          >
            <option value="">— اختر السنة —</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name_ar}</option>
            ))}
          </select>
        )}

        <p className="flex items-center gap-2 rounded-lg bg-primary/[0.06] px-3 py-2 text-[13px] text-text-secondary-light">
          <Users size={15} className="text-primary" />
          {count === null ? "…" : <>تصل إلى <span className="num font-semibold text-text-primary-light">{count}</span> مستلماً</>}
        </p>

        {/* ---- what ---- */}
        <input
          name="subject"
          required
          placeholder="عنوان الرسالة"
          className="w-full rounded-lg border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
        />
        <textarea
          name="body"
          required
          rows={8}
          placeholder="نصّ الرسالة…"
          className="w-full resize-y rounded-lg border border-border-light bg-surface-light px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-primary"
        />

        {!state.campaignId && (
          <button
            type="submit"
            disabled={count === 0}
            className="flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
          >
            مراجعة قبل الإرسال
          </button>
        )}
      </form>

      {/* ---- the second step ---- */}
      {state.campaignId && (
        <div className="mt-4 rounded-xl border border-primary/25 bg-primary/[0.05] p-4">
          <p className="text-[13.5px] text-text-primary-light">{state.success}</p>

          {progress && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[12.5px] text-text-secondary-light">
                <span className="num">{progress.sent} / {progress.total}</span>
                {progress.failed > 0 && (
                  <span className="num text-error">فشل {progress.failed}</span>
                )}
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-500"
                  style={{ width: `${Math.round((progress.sent / Math.max(1, progress.total)) * 100)}%` }}
                />
              </div>
              {!sending && (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-success">
                  <CheckCircle2 size={14} /> تمّ الإرسال.
                </p>
              )}
            </div>
          )}

          {ready && (
            <button
              type="button"
              onClick={() => run(state.campaignId!, count ?? 0)}
              className="mt-3 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-primary/90"
            >
              <Send size={15} />
              أرسل الآن
            </button>
          )}
        </div>
      )}
    </div>
  );
}
