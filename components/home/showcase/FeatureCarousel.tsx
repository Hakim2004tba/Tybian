"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Check } from "lucide-react";
import { FeatureMock } from "@/components/home/showcase/FeatureMock";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type FeatureSlide = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  /* Two ends of the accent gradient. Passed as values, not class names:
     Tailwind only generates classes it can see written out, so a
     `bg-${colour}-500` built at runtime produces an unstyled element. */
  from: string;
  to: string;
};

const AUTOPLAY_MS = 6000;

/**
 * The platform's features, one at a time.
 *
 * WHY A CAROUSEL AND NOT THE OLD LIST: the six features used to be six
 * full-width rows stacked down the page, which asked a visitor to
 * scroll through all of them to see any of them, and gave every feature
 * the same weight as the page's own headings. One at a time, each gets
 * the whole width — a title big enough to read at a glance, its three
 * points, and a picture of the screen it lives on.
 *
 * It advances on its own because a visitor who does not touch it should
 * still see more than one feature; it stops the moment they take over,
 * and the pause button makes that control explicit rather than
 * hover-only. Both are needed: auto-advance with no way to stop it is
 * the reason carousels have a bad name.
 */
export function FeatureCarousel({ slides }: { slides: FeatureSlide[] }) {
  const { t, locale } = useI18n();
  const labels = t.home.showcase;
  const rtl = locale === "ar";

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  /* Remounts the progress bar so its CSS transition restarts from 0 on
     every slide, instead of animating from wherever it had reached. */
  const [tick, setTick] = useState(0);

  const count = slides.length;
  const go = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
      setTick((n) => n + 1);
    },
    [count]
  );

  /* Taking control stops the automatic advance for good: a slide that
     moves on while someone is reading it is worse than no movement. */
  const take = useCallback(
    (next: number) => {
      setPlaying(false);
      go(next);
    },
    [go]
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, index, go]);

  const slide = slides[index];

  return (
    <div className="relative mt-8 md:mt-12">
      {/* ---- the slide ---- */}
      <div className="overflow-hidden">
        <div
          key={slide.key}
          className="grid items-center gap-8 motion-safe:animate-[slideIn_520ms_cubic-bezier(0.22,1,0.36,1)] md:grid-cols-2 md:gap-12"
        >
          {/* words */}
          <div className="order-2 md:order-1">
            <span
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_10px_26px_-10px_rgba(10,7,20,0.5)] md:h-16 md:w-16"
              style={{ backgroundImage: `linear-gradient(135deg, ${slide.from}, ${slide.to})` }}
              aria-hidden
            >
              <span className="text-[22px] font-bold">{index + 1}</span>
            </span>

            <p className="mt-4 text-[12.5px] font-semibold uppercase tracking-wide" style={{ color: slide.to }}>
              {slide.eyebrow}
            </p>
            <h3 className="mt-1.5 text-[24px] font-bold leading-tight text-text-primary-light md:text-[32px]">
              {slide.title}
            </h3>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-text-secondary-light md:text-[16px]">
              {slide.body}
            </p>

            <ul className="mt-5 flex flex-col gap-2.5">
              {slide.points.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-[14px] text-text-primary-light">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundImage: `linear-gradient(135deg, ${slide.from}, ${slide.to})` }}
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* picture */}
          <div className="order-1 md:order-2">
            <div
              className="rounded-[26px] p-4 md:p-6"
              style={{ background: `linear-gradient(140deg, ${slide.from}14, ${slide.to}1F)` }}
            >
              <div
                className="aspect-[4/3] rounded-[20px] p-4 md:p-6"
                style={{ backgroundImage: `linear-gradient(140deg, ${slide.from}, ${slide.to})` }}
              >
                <FeatureMock feature={slide.key} accent={slide.to} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- the arrows ---- */}
      {[-1, 1].map((step) => {
        /* `start`/`end` rather than left/right: in Arabic "previous" is
           the button on the right. */
        const back = step === -1;
        const Icon = rtl === back ? ChevronRight : ChevronLeft;
        return (
          <button
            key={step}
            type="button"
            onClick={() => take(index + step)}
            aria-label={back ? labels.previous : labels.next}
            className={
              "absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border-light bg-white text-text-secondary-light shadow-[0_8px_24px_-12px_rgba(23,15,46,0.5)] transition hover:text-primary lg:flex " +
              (back ? "start-0 -ms-2" : "end-0 -me-2")
            }
          >
            <Icon size={20} />
          </button>
        );
      })}

      {/* ---- pause, dots, counter ---- */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? labels.pause : labels.play}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-light bg-white text-text-secondary-light transition hover:text-primary"
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <div className="flex items-center gap-1.5">
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => take(i)}
                aria-label={s.eyebrow}
                aria-current={active ? "true" : undefined}
                className={
                  "h-2 overflow-hidden rounded-full transition-all duration-300 " +
                  (active ? "w-9" : "w-2 bg-black/15 hover:bg-black/30")
                }
                style={active ? { background: `${slide.to}33` } : undefined}
              >
                {active && (
                  <span
                    key={tick}
                    className="block h-full rounded-full"
                    style={{
                      background: slide.to,
                      /* Fills across the life of the slide while it is
                         playing; sits full while it is paused, so the
                         dot never looks stuck mid-way. */
                      animation: playing
                        ? `dotFill ${AUTOPLAY_MS}ms linear forwards`
                        : undefined,
                      width: playing ? undefined : "100%",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <span className="num rounded-lg border border-border-light bg-white px-2.5 py-1.5 text-[12.5px] text-text-secondary-light">
          {index + 1} / {count}
        </span>
      </div>
    </div>
  );
}
