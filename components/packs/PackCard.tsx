import Image from "next/image";
import Link from "next/link";
import { Layers, ArrowLeft, BookOpen } from "lucide-react";
import type { Pack } from "@/lib/data/packs";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * A pack, shown so it cannot be mistaken for a single course.
 *
 * Three things make the case, in this order: that it is SEVERAL courses
 * (the covers are stacked, not one image), what it costs, and what it
 * saves against buying the same courses one by one. The saving is the
 * whole argument, so it is stated in dinars rather than as a percentage
 * — "save 1300 DA" is a number a student can picture; "save 29%" is
 * one they have to work out.
 */
export async function PackCard({ pack }: { pack: Pack }) {
  const { dict } = await getDictionary();
  const t = dict.packs;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/[0.07] to-transparent">
      {/* Stacked covers — the visual signal that this is more than one
          thing, before a single word is read. */}
      <div className="relative flex h-[132px] items-center justify-center overflow-hidden bg-academy-lavender px-6">
        {pack.courses.slice(0, 3).map((c, i) => (
          <span
            key={c.id}
            className="relative h-[104px] w-[78px] shrink-0 overflow-hidden rounded-lg border-2 border-white shadow-md"
            style={{
              marginInlineStart: i === 0 ? 0 : "-22px",
              transform: `rotate(${(i - 1) * 5}deg)`,
              zIndex: 3 - i,
            }}
          >
            {c.cover_url ? (
              <Image src={c.cover_url} alt="" fill sizes="78px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary/10">
                <BookOpen size={18} className="text-primary/60" />
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
          <Layers size={12} />
          {t.badge}
        </span>

        <h3 className="mt-2.5 text-[16px] font-bold leading-snug text-text-primary-light">
          {pack.title}
        </h3>
        <p className="mt-1 text-[12.5px] text-text-muted-light">
          <span className="num">{pack.courses.length}</span>{" "}
          {pack.courses.length === 1 ? t.courseIn : t.coursesIn}
        </p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="num text-[22px] font-bold text-text-primary-light">
            {pack.price.toLocaleString("en-US")}
          </span>
          <span className="text-[12.5px] text-text-muted-light">{pack.currency}</span>

          {/* Shown only when it is real — see lib/data/packs.ts. */}
          {pack.saving > 0 && (
            <span className="num text-[12.5px] text-text-muted-light line-through">
              {t.separately} {pack.separateTotal.toLocaleString("en-US")}
            </span>
          )}
        </div>

        {pack.saving > 0 && (
          <p className="num mt-1.5 w-fit rounded-full bg-success/10 px-2.5 py-1 text-[12px] font-bold text-success">
            {t.save} {pack.saving.toLocaleString("en-US")} {pack.currency}
          </p>
        )}

        <Link
          href={`/packs/${pack.slug}`}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {t.viewPack}
          <ArrowLeft size={15} className="rtl:rotate-0 ltr:-scale-x-100" />
        </Link>
      </div>
    </article>
  );
}
