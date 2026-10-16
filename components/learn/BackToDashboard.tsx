"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * The lesson player is the one signed-in page with no navigation of its
 * own: the student rail is deliberately absent so the video, the lesson
 * list and the QCM get the full width. This is what replaces it.
 *
 * router.back() rather than a Link to a fixed route, because "back"
 * here genuinely means wherever they came from — the course page, the
 * catalogue, their dashboard, or the previous lesson. `fallback` covers
 * the case with no history to return to (a shared link opened cold),
 * where back() would leave them on the same page.
 *
 * The arrow follows the writing direction: pointing left in English,
 * right in Arabic. A single hard-coded ArrowLeft points INTO the page
 * in RTL, which reads as "forward".
 */
export function BackToDashboard({ fallback }: { fallback: string }) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const Arrow = locale === "ar" ? ArrowRight : ArrowLeft;

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[13px] text-white/85 transition hover:border-white/30 hover:bg-white/[0.12] hover:text-white"
    >
      <Arrow size={15} />
      {t.dash.common.back}
    </button>
  );
}
