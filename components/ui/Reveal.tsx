"use client";

import { useEffect, useRef, useState, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * CSS-only scroll reveal — fade + translateY (or a subtle scale variant)
 * fires once per element via IntersectionObserver. No animation
 * library; matches DESIGN_SYSTEM.md §12 (motion serves state change,
 * orchestrated once, not scattered/looping). The custom cubic-bezier
 * below gives a slightly springy-but-controlled settle rather than
 * linear ease-out, without crossing into a "bounce" that would feel
 * unscientific for a medical platform.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
  ...props
}: HTMLAttributes<HTMLDivElement> & { delay?: number; variant?: "up" | "scale" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hiddenState =
    variant === "scale" ? "opacity-0 scale-95" : "opacity-0 translate-y-5";
  const shownState = variant === "scale" ? "opacity-100 scale-100" : "opacity-100 translate-y-0";

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      className={cn(
        "transition-all duration-700 motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100",
        hiddenState,
        visible && shownState,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
