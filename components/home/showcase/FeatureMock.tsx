/**
 * The pictures in the feature carousel — drawn, not photographed.
 *
 * WHY NOT SCREENSHOTS: a capture of a dense page, shrunk into a card,
 * shows a visitor a grey smudge — the control being described ends up
 * a few pixels tall.
 *
 * WHY THESE ONES HAVE WORDS IN THEM: the first drawn version was
 * abstract — bars and blocks standing in for content — and it looked
 * tidy while explaining nothing. A picture of a feature has to show
 * what the feature DOES, so each mock now carries the few real labels
 * that make it recognisable: the chips the assistant offers, the seven
 * boxes of a subject's tracker, the timer's own digits, the trees.
 *
 * The labels are deliberately language-neutral — numbers, "QCM",
 * "25:00", a subject name — so one drawing serves both dictionaries
 * instead of two needing to be kept in step.
 */

function Line({ w, tone = "soft" }: { w: string; tone?: "soft" | "strong" | "dark" }) {
  const bg =
    tone === "strong" ? "bg-white/75" : tone === "dark" ? "bg-black/15" : "bg-white/30";
  return <span className={`block h-1.5 rounded-full ${bg}`} style={{ width: w }} />;
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <span
      className="rounded-full px-2 py-[3px] text-[8.5px] font-semibold leading-none"
      style={
        accent
          ? { background: accent, color: "#fff" }
          : { background: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.85)" }
      }
    >
      {children}
    </span>
  );
}

function Screen({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={
        "h-full w-full overflow-hidden rounded-[14px] p-3 shadow-[0_18px_40px_-20px_rgba(10,7,20,0.55)] sm:p-3.5 " +
        (dark ? "bg-[#140F26]" : "bg-white")
      }
    >
      {children}
    </div>
  );
}

export function FeatureMock({ feature, accent }: { feature: string; accent: string }) {
  switch (feature) {
    /* The assistant, beside the lecture it is being asked about. */
    case "ai":
      return (
        <Screen dark>
          <div className="flex h-full gap-2.5">
            <div className="flex w-[45%] flex-col gap-1.5 rounded-lg bg-white/5 p-2.5">
              <span className="text-[8px] font-bold uppercase tracking-wide text-white/40">
                Osteology
              </span>
              <Line w="95%" tone="strong" />
              <Line w="78%" />
              <Line w="88%" />
              <Line w="52%" />
            </div>

            <div className="flex w-[55%] flex-col gap-1.5">
              <div className="flex flex-wrap gap-1">
                <Chip accent={accent}>Explain</Chip>
                <Chip>QCM</Chip>
                <Chip>Key points</Chip>
              </div>
              <span className="mt-auto ms-auto max-w-[85%] rounded-xl rounded-se-sm px-2.5 py-1.5" style={{ background: accent }}>
                <Line w="46px" tone="strong" />
              </span>
              <span className="me-auto max-w-[92%] space-y-1 rounded-xl rounded-ss-sm bg-white/10 px-2.5 py-2">
                <Line w="86px" tone="strong" />
                <Line w="70px" />
                <Line w="78px" />
              </span>
            </div>
          </div>
        </Screen>
      );

    /* The lecture: the player, and what comes next. */
    case "lesson":
      return (
        <Screen dark>
          <div className="flex h-full gap-2.5">
            <div className="flex w-[58%] flex-col gap-1.5">
              <div className="flex flex-1 items-center justify-center rounded-lg bg-white/[0.07]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: accent }}>
                  <span className="ms-0.5 block h-0 w-0 border-y-[6px] border-s-[10px] border-y-transparent border-s-white rtl:rotate-180" />
                </span>
              </div>
              <span className="block h-1.5 rounded-full bg-white/15">
                <span className="block h-full w-2/3 rounded-full" style={{ background: accent }} />
              </span>
              <span className="num text-[8px] text-white/45">12:40 / 18:05</span>
            </div>

            <div className="flex w-[42%] flex-col gap-1">
              {[
                { d: "08:12", done: true },
                { d: "14:03", done: true },
                { d: "18:05", done: false },
                { d: "09:47", done: false },
              ].map((l, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-md bg-white/5 px-1.5 py-1.5">
                  <span
                    className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[7px] text-white"
                    style={{ background: l.done ? accent : "rgba(255,255,255,0.18)" }}
                  >
                    {l.done ? "✓" : ""}
                  </span>
                  <Line w="60%" />
                  <span className="num ms-auto text-[7.5px] text-white/40">{l.d}</span>
                </span>
              ))}
            </div>
          </div>
        </Screen>
      );

    /* The tracker: three subjects, seven boxes each. */
    case "tracker":
      return (
        <Screen>
          <div className="flex h-full flex-col justify-center gap-2.5">
            <div className="flex justify-between text-[8px] font-semibold uppercase tracking-wide text-black/35">
              <span>Subject</span>
              <span>1 · 2 · 3 · QCM · QCM · QCM · REV</span>
            </div>
            {[
              { n: "Anatomy", done: 5 },
              { n: "Cytology", done: 3 },
              { n: "Biophysics", done: 6 },
            ].map((s) => (
              <div key={s.n} className="flex items-center gap-2">
                <span className="w-[62px] shrink-0 truncate text-[9px] font-medium text-black/60">
                  {s.n}
                </span>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span
                      key={i}
                      className="flex h-5 flex-1 items-center justify-center rounded-[5px] text-[8px] text-white"
                      style={{ background: i < s.done ? accent : "rgba(10,7,20,0.07)" }}
                    >
                      {i < s.done ? "✓" : ""}
                    </span>
                  ))}
                </div>
                <span className="num w-7 shrink-0 text-end text-[9px] font-semibold text-black/50">
                  {Math.round((s.done / 7) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </Screen>
      );

    /* The sketchpad: squared paper, a drawing, and the toolbar. */
    case "sketch":
      return (
        <Screen>
          <div className="flex h-full gap-2">
            <div className="flex w-8 shrink-0 flex-col items-center gap-1.5 rounded-lg bg-black/[0.04] py-2">
              {["✎", "▢", "◯", "A"].map((g, i) => (
                <span
                  key={g}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-[10px]"
                  style={
                    i === 0
                      ? { background: accent, color: "#fff" }
                      : { color: "rgba(10,7,20,0.4)" }
                  }
                >
                  {g}
                </span>
              ))}
              <span className="mt-0.5 h-3 w-3 rounded-full" style={{ background: accent }} />
            </div>

            <div
              className="flex-1 rounded-lg"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(10,7,20,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(10,7,20,0.06) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            >
              <svg viewBox="0 0 200 120" className="h-full w-full" preserveAspectRatio="none">
                <ellipse cx="60" cy="58" rx="30" ry="24" fill="none" stroke={accent} strokeWidth="4" />
                <path d="M90 58 H130" stroke={accent} strokeWidth="4" strokeLinecap="round" />
                <path d="M130 58 l-10 -7 M130 58 l-10 7" stroke={accent} strokeWidth="4" strokeLinecap="round" fill="none" />
                <circle cx="152" cy="58" r="16" fill="none" stroke={accent} strokeWidth="4" strokeDasharray="5 5" />
              </svg>
            </div>
          </div>
        </Screen>
      );

    /* The timer, mid-session. */
    case "timer":
      return (
        <Screen>
          <div className="flex h-full items-center justify-center gap-4">
            <div className="relative">
              <svg viewBox="0 0 120 120" className="h-[92px] w-[92px]">
                <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(10,7,20,0.07)" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="48" fill="none" stroke={accent} strokeWidth="10"
                  strokeLinecap="round" strokeDasharray="302" strokeDashoffset="96"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <span className="num absolute inset-0 flex items-center justify-center text-[17px] font-bold text-black/70">
                25:00
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {["25", "45", "50"].map((m, i) => (
                <span
                  key={m}
                  className="num rounded-lg px-2.5 py-1 text-[9.5px] font-semibold"
                  style={
                    i === 0
                      ? { background: accent, color: "#fff" }
                      : { background: "rgba(10,7,20,0.05)", color: "rgba(10,7,20,0.5)" }
                  }
                >
                  {m} min
                </span>
              ))}
            </div>
          </div>
        </Screen>
      );

    /* The plot and the ranking — the two halves of the competition. */
    case "compete":
      return (
        <Screen>
          <div className="flex h-full gap-2.5">
            <div className="w-[52%] rounded-lg bg-gradient-to-b from-[#EEF6EC] to-[#E3F0E4] p-2">
              <div className="grid h-full grid-cols-5 place-items-center gap-1">
                {Array.from({ length: 20 }, (_, i) => (
                  <svg key={i} viewBox="0 0 24 26" className="h-full w-full max-h-5">
                    <rect x="11" y="15" width="2" height="8" rx="1" fill={i < 12 ? "#8A5A2B" : "rgba(10,7,20,0.14)"} />
                    <circle cx="12" cy="9" r="6" fill={i < 12 ? accent : "rgba(10,7,20,0.10)"} />
                  </svg>
                ))}
              </div>
            </div>

            <div className="flex w-[48%] flex-col gap-1">
              {[
                { p: 1, h: "12h", t: 6, medal: "#E8A33D" },
                { p: 2, h: "11h", t: 5, medal: "#A8AEC0" },
                { p: 3, h: "10h", t: 5, medal: "#C77B4A" },
                { p: 4, h: "9h", t: 4, medal: null },
              ].map((r) => (
                <span
                  key={r.p}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5"
                  style={{ background: r.p === 4 ? `${accent}1A` : "rgba(10,7,20,0.03)" }}
                >
                  <span
                    className="num flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[7.5px] font-bold text-white"
                    style={{ background: r.medal ?? accent }}
                  >
                    {r.p}
                  </span>
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-black/10" />
                  <Line w="40%" tone="dark" />
                  <span className="num ms-auto text-[8px] font-semibold text-black/55">{r.h}</span>
                </span>
              ))}
            </div>
          </div>
        </Screen>
      );

    /* Discussion: the question, and the replies under it. */
    case "discussion":
    default:
      return (
        <Screen>
          <div className="flex h-full flex-col justify-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-wide text-black/35">
              Lesson 3 · 4 replies
            </span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-1.5" style={{ paddingInlineStart: i === 0 ? 0 : 20 }}>
                <span
                  className="h-6 w-6 shrink-0 rounded-full"
                  style={{ background: i === 0 ? accent : "rgba(10,7,20,0.10)" }}
                />
                <span className="flex-1 space-y-1 rounded-xl bg-black/[0.04] px-2 py-1.5">
                  <Line w={i === 0 ? "82%" : "62%"} tone="dark" />
                  <Line w={i === 0 ? "58%" : "42%"} tone="dark" />
                </span>
              </div>
            ))}
          </div>
        </Screen>
      );
  }
}
