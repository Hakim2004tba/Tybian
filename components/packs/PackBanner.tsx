import Link from "next/link";
import { Layers, ArrowLeft } from "lucide-react";
import type { Pack } from "@/lib/data/packs";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * "This course is part of a pack", shown on the course's own page.
 *
 * This is where the offer converts. A student reading a course page has
 * already decided they want this subject; "two more for a little extra"
 * lands here in a way it never does on a catalogue page they scrolled
 * past. It appears only when the pack genuinely saves money — an offer
 * that saves nothing is an advert, not an offer.
 */
export async function PackBanner({ packs }: { packs: Pack[] }) {
  const { dict } = await getDictionary();
  const t = dict.packs;

  const worthwhile = packs.filter((p) => p.saving > 0);
  if (worthwhile.length === 0) return null;

  /* The one that saves most, when a course sits in several. */
  const best = worthwhile.reduce((a, b) => (b.saving > a.saving ? b : a));

  return (
    <Link
      href={`/packs/${best.slug}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-4 transition-colors hover:border-primary/60"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-primary">
          <Layers size={13} />
          {t.partOfPack}
        </span>
        <span className="mt-1 block text-[14px] font-semibold text-text-primary-light">
          {best.title}
        </span>
        <span className="num mt-0.5 block text-[12.5px] text-text-secondary-light">
          {best.courses.length} {t.coursesIn} ·{" "}
          <span className="font-bold text-success">
            {t.save} {best.saving.toLocaleString("en-US")} {best.currency}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white">
        {t.viewPack}
        <ArrowLeft size={14} className="rtl:rotate-0 ltr:-scale-x-100" />
      </span>
    </Link>
  );
}
