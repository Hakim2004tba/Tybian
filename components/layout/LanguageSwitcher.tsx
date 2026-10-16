"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/lib/actions/locale";
import type { Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * `currentLocale` is optional: without it the switcher reads the active
 * language from context.
 *
 * It used to be required, so dropping the switcher into a screen meant
 * threading the locale down to it — which is why it existed only in the
 * marketing navbar, and the dashboard and admin areas (where the
 * marketing chrome is deliberately hidden) had no way to change
 * language at all.
 */
export function LanguageSwitcher({ currentLocale }: { currentLocale?: Locale }) {
  const [pending, startTransition] = useTransition();
  const { locale: contextLocale } = useI18n();
  const active = currentLocale ?? contextLocale;

  function switchTo(locale: Locale) {
    if (locale === active) return;
    startTransition(() => {
      setLocaleAction(locale).then(() => {
        window.location.reload(); // dir/lang on <html> needs a full reload
      });
    });
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-border-light bg-surface-light p-0.5 text-[12px]">
      <Languages size={13} className="mx-1.5 text-text-muted-light" />
      <button
        onClick={() => switchTo("ar")}
        disabled={pending}
        className={cn(
          "rounded-full px-2.5 py-1 transition-colors",
          active === "ar" ? "bg-primary text-white" : "text-text-muted-light hover:text-primary"
        )}
      >
        ع
      </button>
      <button
        onClick={() => switchTo("en")}
        disabled={pending}
        className={cn(
          "rounded-full px-2.5 py-1 transition-colors",
          active === "en" ? "bg-primary text-white" : "text-text-muted-light hover:text-primary"
        )}
      >
        EN
      </button>
    </div>
  );
}
