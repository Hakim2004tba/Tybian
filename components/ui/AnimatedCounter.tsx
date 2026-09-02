"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number counting up from 0 to its target once the element
 * scrolls into view — reuses the same IntersectionObserver-once pattern
 * as Reveal.tsx rather than a separate library. `prefix`/`suffix` let
 * the caller keep non-numeric parts (like "+" or "/5") static so only
 * the actual digits animate.
 */
export function AnimatedCounter({
  value,
  duration = 1400,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();

          function tick(now: number) {
            const elapsed = now - start;
            const progress = Math.min(1, elapsed / duration);
            // ease-out-quart — fast start, gentle settle, matches Reveal's feel
            const eased = 1 - Math.pow(1 - progress, 4);
            setDisplay(value * eased);
            if (progress < 1) requestAnimationFrame(tick);
            else setDisplay(value);
          }
          requestAnimationFrame(tick);
          io.unobserve(el);
        }
      },
      { threshold: 0.4 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className="num">
      {prefix}
      {display.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
