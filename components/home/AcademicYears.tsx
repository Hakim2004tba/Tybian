import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { getAcademicYears } from "@/lib/data/academic-years";
import { getAcademicYearCourseCounts } from "@/lib/data/homepage";

// Static per-year curriculum blurbs — genuine domain knowledge about
// what each year of the Algerian medical curriculum generally covers,
// not platform data, so no DB backing needed for these specifically.
const yearBlurbs: Record<number, { fr: string; desc: string }> = {
  1: { fr: "1ère année", desc: "التشريح العام، الكيمياء الحيوية، الفيزياء الطبية" },
  2: { fr: "2ème année", desc: "علم وظائف الأعضاء، الأنسجة، الأجنة" },
  3: { fr: "3ème année", desc: "الفيزيولوجيا المرضية، علم الأدوية، المناعة" },
  4: { fr: "4ème année", desc: "الأمراض الباطنية، بداية التداول السريري" },
  5: { fr: "5ème année", desc: "الجراحة العامة، النسائية والتوليد" },
  6: { fr: "6ème année", desc: "طب الأطفال، الطب الباطني المتقدم" },
  7: { fr: "7ème année", desc: "التداول الشامل، التحضير لمناقشة التخرج" },
};

/**
 * The per-year course count is a real query (getAcademicYearCourseCounts)
 * — replacing what used to be hardcoded numbers. Each card now also
 * genuinely links to the course catalog pre-filtered by that year,
 * instead of being a cosmetic-only "interactive" card with nowhere to go.
 */
export async function AcademicYears() {
  const [years, counts] = await Promise.all([getAcademicYears(), getAcademicYearCourseCounts()]);

  return (
    <section className="bg-bg-light py-4xl">
      <Container>
        <Reveal>
          <Badge variant="violet">السنوات الدراسية</Badge>
          <h2 className="mt-4 max-w-lg">محتوى منظّم من السنة الأولى إلى السابعة</h2>
          <p className="mt-2 max-w-xl text-text-secondary-light">
            كل سنة دراسية تضم مقاييسها الكاملة، من المقررات الأساسية إلى
            التداول السريري في السنوات النهائية.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {years.map((y, i) => {
            const blurb = yearBlurbs[y.year_number];
            const count = counts[y.year_number] ?? 0;
            return (
              <Reveal key={y.id} delay={i * 60}>
                <Link href={`/courses?year=${y.id}`}>
                  <Card interactive className="h-full cursor-pointer">
                    <div className="flex items-start justify-between">
                      <span className="num text-sm font-bold text-primary">
                        {String(y.year_number).padStart(2, "0")}
                      </span>
                      {blurb && <span className="num text-[11px] text-text-muted-light">{blurb.fr}</span>}
                    </div>
                    <h3 className="mt-3">{y.name_ar}</h3>
                    {blurb && <p className="mt-1.5 text-[14px] text-text-secondary-light">{blurb.desc}</p>}
                    <div className="mt-4 text-[13px] text-text-muted-light">
                      <span className="num">{count}</span> {count === 1 ? "مقياس" : "مقاييس"}
                    </div>
                  </Card>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
