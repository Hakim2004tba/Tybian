"use client";

import { createContext, useContext } from "react";
import { dictionaries, DEFAULT_LOCALE, type Dictionary, type Locale } from "@/lib/i18n/dictionaries";

/**
 * Makes the active language reachable from CLIENT components.
 *
 * `getDictionary()` in lib/i18n/locale.ts reads a cookie through
 * `next/headers` and is therefore server-only. Server components can
 * call it; a `"use client"` component cannot, and passing `dict` down as
 * a prop stops at the first client boundary — which is why every button,
 * drawer and form deep in the tree ended up with its Arabic text
 * hardcoded. There was no way for it to ask what language to speak.
 *
 * The provider carries only the LOCALE across the boundary, not the
 * dictionary: the dictionary is a plain module, so the client looks the
 * language up itself. That keeps it out of the RSC payload of every
 * page — one copy in the bundle rather than a copy per navigation.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/**
 * The active language and its dictionary, inside a client component.
 *
 *   const { t, locale, isRtl } = useI18n();
 *   <button>{t.lesson.markComplete}</button>
 */
export function useI18n(): { locale: Locale; t: Dictionary; isRtl: boolean } {
  const locale = useContext(LocaleContext);
  return { locale, t: dictionaries[locale], isRtl: locale === "ar" };
}
