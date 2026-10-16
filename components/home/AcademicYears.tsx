import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { YearCard } from "@/components/home/YearCard";
import { getAcademicYears } from "@/lib/data/academic-years";
import { getAcademicYearCourseCounts } from "@/lib/data/homepage";
import { getDictionary } from "@/lib/i18n/locale";
import { SectionAura } from "@/components/home/SectionAura";

// The French year label is the same in both languages — it is what the
// faculty itself calls the year. The curriculum blurb beside it is real
// domain knowledge rather than platform data, so it lives in the
// dictionary (dict.home.years.blurbs) and not in the database.
const yearLabels: Record<number, string> = {
  1: "1ère année",
  2: "2ème année",
  3: "3ème année",
  4: "4ème année",
  5: "5ème année",
  6: "6ème année",
  7: "7ème année",
};

/**
 * The per-year course count is a real query (getAcademicYearCourseCounts)
 * — replacing what used to be hardcoded numbers. Each card now also
 * genuinely links to the course catalog pre-filtered by that year,
 * instead of being a cosmetic-only "interactive" card with nowhere to go.
 */
export async function AcademicYears() {
  const [years, counts] = await Promise.all([getAcademicYears(), getAcademicYearCourseCounts()]);
  const { locale, dict } = await getDictionary();
  const t = dict.home.years;

  return (
    <section className="relative isolate overflow-hidden bg-bg-light py-4xl">
      <SectionAura tone="light" />
      <Container>
        <Reveal className="text-center md:text-start">
          <Badge variant="violet">{t.badge}</Badge>
          <h2 className="mx-auto mt-4 max-w-lg md:mx-0">{t.title}</h2>
          <p className="mx-auto mt-2 max-w-xl text-text-secondary-light md:mx-0">
            {t.body}
          </p>
        </Reveal>

        {/* Two per row on a phone. Seven full-width cards made this one
            section roughly nine screens tall, which is what "everything is
            stacked lengthwise" meant. */}
        <div className="mt-7 grid grid-cols-2 gap-3 md:mt-10 md:gap-5 lg:grid-cols-4">
          {years.map((y, i) => {
            const label = yearLabels[y.year_number];
            // The blurb is keyed by year number in the dictionary.
            const blurb = t.blurbs[y.year_number as keyof typeof t.blurbs];
            // academic_years carries a real English name; fall back to
            // the Arabic one rather than showing an empty card if a row
            // was created without it.
            const yearName = locale === "en" ? (y.name_en ?? y.name_ar) : y.name_ar;
            const count = counts[y.year_number] ?? 0;
            return (
              <Reveal key={y.id} delay={i * 60}>
                <YearCard
                  href={`/courses?year=${y.id}`}
                  number={y.year_number}
                  label={label}
                  name={yearName}
                  blurb={blurb}
                  count={count}
                  labels={{
                    soon: t.soon,
                    soonHint: t.soonHint,
                    subjectOne: t.subjectOne,
                    subjectMany: t.subjectMany,
                  }}
                />
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
