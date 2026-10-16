import Link from "next/link";
import { Card } from "@/components/ui/Card";

/**
 * One academic year on the homepage.
 *
 * A YEAR WITH NOTHING IN IT IS NOT A LINK. Every card used to lead to
 * /courses?year=…, so a student clicking their own year landed on an
 * empty catalogue with no explanation. An empty year now says so on
 * its face and stops being clickable — there is nowhere for it to go.
 *
 * Presentational and prop-driven, so the empty state can be rendered
 * and looked at without a database that happens to contain an empty
 * year.
 */
export function YearCard({
  href,
  number,
  label,
  name,
  blurb,
  count,
  labels,
}: {
  href: string;
  number: number;
  label?: string;
  name: string;
  blurb?: string;
  count: number;
  labels: { soon: string; soonHint: string; subjectOne: string; subjectMany: string };
}) {
  const empty = count === 0;

  const card = (
    <Card
      interactive={!empty}
      className={
        "relative h-full overflow-hidden " + (empty ? "cursor-default select-none" : "cursor-pointer")
      }
    >
      {/* The sweep of light that says "being prepared". Behind the
          content, and gone for anyone who asked for less motion. */}
      {empty && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -inset-x-1/4 motion-safe:animate-sheen"
        >
          <span className="block h-full w-1/3 bg-gradient-to-r from-transparent via-primary/10 to-transparent blur-md" />
        </span>
      )}

      <div className="relative">
        <div className="flex items-start justify-between">
          <span className={"num text-sm font-bold " + (empty ? "text-text-muted-light" : "text-primary")}>
            {String(number).padStart(2, "0")}
          </span>
          {label && <span className="num text-[11px] text-text-muted-light">{label}</span>}
        </div>

        <h3
          className={
            "mt-2 text-[15px] md:mt-3 md:text-[17px] " + (empty ? "text-text-secondary-light" : "")
          }
        >
          {name}
        </h3>

        {blurb && (
          <p className="mt-1 hidden text-[14px] text-text-secondary-light md:mt-1.5 md:block">
            {blurb}
          </p>
        )}

        {empty ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 md:mt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11.5px] font-semibold text-primary">
              {/* A dot that breathes rather than blinks: a blink reads
                  as an error light, a breath reads as waiting. */}
              <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-breathe" />
              {labels.soon}
            </span>
            <span className="hidden text-[12px] text-text-muted-light md:inline">
              {labels.soonHint}
            </span>
          </div>
        ) : (
          <div className="mt-2.5 text-[12px] text-text-muted-light md:mt-4 md:text-[13px]">
            <span className="num">{count}</span>{" "}
            {count === 1 ? labels.subjectOne : labels.subjectMany}
          </div>
        )}
      </div>
    </Card>
  );

  /* aria-disabled rather than a disabled link: it is still readable
     content, just not a destination. */
  return empty ? (
    <div aria-disabled className="h-full">
      {card}
    </div>
  ) : (
    <Link href={href}>{card}</Link>
  );
}
