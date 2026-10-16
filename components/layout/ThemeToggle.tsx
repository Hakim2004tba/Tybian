"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * Light / dark, in one tap.
 *
 * It flips the class on <html> immediately and writes the cookie for the
 * next server render — it deliberately does NOT reload. Re-fetching a
 * whole page to change a colour would throw away scroll position, an
 * open panel and anything half-typed, to apply something CSS can do in
 * a frame.
 *
 * `mounted` guards the icon, not the behaviour: the server does not
 * know what a "system" reader resolved to, so rendering a sun or a moon
 * before hydration would be a coin flip and React would report a
 * hydration mismatch. Until then it renders the icon in its neutral
 * state and is still clickable.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    /*
      One year, Lax, site-wide — the same shape as the locale cookie.
      Not httpOnly: this one is set from the browser by design, and it
      carries a colour preference, not a credential.
    */
    document.cookie = `theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  }

  const label = dark ? t.theme.toLight : t.theme.toDark;

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={
        "relative flex items-center justify-center rounded-full border border-border-light bg-surface-light text-text-secondary-light transition hover:border-primary/40 hover:text-primary active:scale-95 " +
        (compact ? "h-9 w-9" : "h-10 w-10")
      }
    >
      {/*
        Both icons are always rendered and cross-rotate, so the change
        reads as one control turning rather than two icons swapping.
      */}
      <Sun
        size={17}
        className={
          "absolute transition-all duration-300 " +
          (mounted && dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")
        }
      />
      <Moon
        size={17}
        className={
          "absolute transition-all duration-300 " +
          (mounted && dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")
        }
      />
    </button>
  );
}
