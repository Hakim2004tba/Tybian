"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, X, Play, Shuffle, ListOrdered, Zap, FileCheck2, Check, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSessionAction } from "@/lib/actions/qcm-sessions";
import type { PickerTopic } from "@/lib/data/qcm-sessions";

const LENGTHS = [10, 20, 40, 60];

/**
 * Building a session: pick topics on the left, shape it on the right.
 *
 * THE COUNTS ARE SHOWN PER TOPIC AND SUMMED LIVE at the foot, because
 * the single thing a student is deciding here is how long this will
 * take. A picker that only reveals the total after you commit makes
 * that decision blind.
 */
export function NewSessionModal({
  topics,
  onClose,
  preselect,
}: {
  topics: PickerTopic[];
  onClose: () => void;
  /** A topic id to arrive with already ticked. */
  preselect?: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(preselect ? [preselect] : [])
  );
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<"instant" | "exam">("instant");
  const [ordering, setOrdering] = useState<"topic" | "random">("random");
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? topics.filter(
          (x) => x.title.toLowerCase().includes(q) || x.subjectName.toLowerCase().includes(q)
        )
      : topics;

    /* Grouped by subject: a flat list of forty topics from six
       subjects is unnavigable, and the subject is how a student
       thinks about where a topic lives. */
    const groups = new Map<string, PickerTopic[]>();
    for (const topic of list) {
      const arr = groups.get(topic.subjectName) ?? [];
      arr.push(topic);
      groups.set(topic.subjectName, arr);
    }
    return [...groups.entries()];
  }, [topics, search]);

  const available = useMemo(
    () => topics.filter((x) => picked.has(x.id)).reduce((n, x) => n + x.questionCount, 0),
    [topics, picked]
  );

  /* count = 0 means "all of them". */
  const willAsk = count === 0 ? available : Math.min(count, available);

  function toggle(id: string) {
    setError(null);
    setPicked((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function submit() {
    if (picked.size === 0) {
      setError(t.bank.pickTopicsFirst);
      return;
    }
    start(async () => {
      const res = await createSessionAction({
        title: title.trim() || `${t.bank.compilation} (${picked.size})`,
        topicIds: [...picked],
        count,
        mode,
        ordering,
      });
      if (res.ok) {
        router.push(`/dashboard/qcm/s/${res.id}`);
      } else {
        setError(res.error === "empty" ? t.bank.empty : t.bank.pickTopicsFirst);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-rise-in flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-surface-light shadow-2xl sm:rounded-3xl">
        {/* ================= head ================= */}
        <div className="flex items-center gap-3 border-b border-border-light p-4 md:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#D946C8] text-white">
            <Sparkles size={18} />
          </span>
          <h2 className="hidden shrink-0 text-[17px] font-extrabold text-text-primary-light sm:block">
            {t.bank.createSession}
          </h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.bank.sessionName}
            className="min-w-0 flex-1 rounded-2xl border border-border-light bg-bg-light px-4 py-2.5 text-[14px] text-text-primary-light outline-none transition focus:border-primary/50"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t.bank.back}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted-light transition hover:bg-black/[0.05] hover:text-text-primary-light"
          >
            <X size={18} />
          </button>
        </div>

        {/* ================= body ================= */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-[1.15fr_1fr] md:p-5">
          {/* ---- topics ---- */}
          <div className="flex min-h-0 flex-col rounded-2xl border border-border-light">
            <div className="relative border-b border-border-light p-3">
              <Search size={15} className="pointer-events-none absolute start-6 top-1/2 -translate-y-1/2 text-text-muted-light" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.bank.searchTopic}
                className="w-full rounded-xl bg-bg-light py-2.5 pe-3 ps-9 text-[13.5px] text-text-primary-light outline-none"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2 md:max-h-[46vh]">
              {shown.length === 0 ? (
                <p className="px-3 py-10 text-center text-[13px] text-text-muted-light">
                  {t.bank.empty}
                </p>
              ) : (
                shown.map(([subject, list]) => (
                  <div key={subject} className="mb-2">
                    <p className="px-2 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wide text-text-muted-light">
                      {subject}
                    </p>
                    {list.map((topic) => {
                      const on = picked.has(topic.id);
                      const empty = topic.questionCount === 0;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          disabled={empty}
                          onClick={() => toggle(topic.id)}
                          aria-pressed={on}
                          className={
                            "mb-1 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition " +
                            (on
                              ? "border-primary bg-primary/[0.07]"
                              : empty
                                ? "border-transparent opacity-40"
                                : "border-transparent hover:border-primary/30 hover:bg-primary/[0.03]")
                          }
                        >
                          <span
                            className={
                              "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition " +
                              (on ? "border-primary bg-primary text-white" : "border-border-light")
                            }
                          >
                            {on && <Check size={11} strokeWidth={3.5} />}
                          </span>
                          <span dir="auto" className="min-w-0 flex-1 truncate text-[13px] text-text-primary-light">
                            {topic.title}
                          </span>
                          <span className="num shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-semibold text-text-secondary-light">
                            {topic.questionCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ---- shape ---- */}
          <div className="flex flex-col gap-3">
            <Panel title={t.bank.howMany}>
              <div className="flex flex-wrap gap-2">
                {[...LENGTHS, 0].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    aria-pressed={count === n}
                    className={
                      "num min-w-[54px] rounded-xl border px-3.5 py-2 text-[13px] font-bold transition " +
                      (count === n
                        ? "border-primary bg-primary text-white"
                        : "border-border-light text-text-secondary-light hover:border-primary/40")
                    }
                  >
                    {n === 0 ? t.bank.all : n}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title={t.bank.modeLabel}>
              <div className="grid grid-cols-2 gap-2">
                <Choice on={mode === "instant"} onClick={() => setMode("instant")} icon={<Zap size={14} />} label={t.bank.modeInstant} />
                <Choice on={mode === "exam"} onClick={() => setMode("exam")} icon={<FileCheck2 size={14} />} label={t.bank.modeExam} />
              </div>
            </Panel>

            <Panel title={t.bank.orderLabel}>
              <div className="grid grid-cols-2 gap-2">
                <Choice on={ordering === "topic"} onClick={() => setOrdering("topic")} icon={<ListOrdered size={14} />} label={t.bank.orderTopic} />
                <Choice on={ordering === "random"} onClick={() => setOrdering("random")} icon={<Shuffle size={14} />} label={t.bank.orderRandom} />
              </div>
            </Panel>

            {picked.size > 0 && (
              <button
                type="button"
                onClick={() => setPicked(new Set())}
                className="self-start text-[12px] text-text-muted-light underline-offset-2 transition hover:text-error hover:underline"
              >
                {t.bank.clearAll}
              </button>
            )}
          </div>
        </div>

        {/* ================= foot ================= */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border-light p-4 md:p-5">
          <p className="num text-[13px] text-text-secondary-light">
            <span className="text-[19px] font-extrabold text-primary">{willAsk}</span>{" "}
            {t.bank.chosenQuestions}
            {picked.size > 0 && (
              <span className="ms-2 text-[11.5px] text-text-muted-light">
                · {picked.size} {t.bank.selectedTopics}
              </span>
            )}
          </p>

          {error && <p className="text-[12.5px] font-semibold text-error">{error}</p>}

          <span className="grow" />

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-2xl border border-border-light px-4 py-3 text-[13.5px] text-text-secondary-light transition hover:border-primary/40"
          >
            <ArrowLeft size={15} className="rtl:rotate-180" />
            {t.bank.back}
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={pending || picked.size === 0 || willAsk === 0}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[#D946C8] px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.99] disabled:bg-none disabled:bg-black/[0.07] disabled:text-text-muted-light disabled:shadow-none"
          >
            <Play size={15} fill="currentColor" />
            {t.bank.startNow}
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-light p-3.5">
      <p className="mb-2 text-[11.5px] font-bold text-text-secondary-light">{title}</p>
      {children}
    </div>
  );
}

function Choice({
  on, onClick, icon, label,
}: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={
        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-[12.5px] font-semibold transition " +
        (on
          ? "border-primary bg-primary/[0.07] text-primary"
          : "border-border-light text-text-secondary-light hover:border-primary/40")
      }
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
