import { Star } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { getHomepageTestimonials } from "@/lib/data/homepage";

/**
 * Real reviews only — pulled from students who actually rated a course
 * 4-5 stars and left a written comment (lib/data/homepage.ts). No
 * fabricated names/quotes. If no qualifying reviews exist yet, the
 * section is skipped entirely rather than showing something fake in
 * the meantime.
 */
export async function Testimonials() {
  const testimonials = await getHomepageTestimonials(3);
  if (testimonials.length === 0) return null;

  return (
    <section className="bg-bg-dark py-4xl">
      <Container>
        <Reveal className="text-center">
          <Badge variant="teal">آراء الطلبة</Badge>
          <h2 className="mx-auto mt-4 max-w-lg text-text-primary-dark">
            ماذا يقول طلبة الطب عن تبيان
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.id} delay={i * 80}>
              <Card tone="dark" className="h-full">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      size={14}
                      className={idx < t.rating ? "fill-gold text-gold" : "text-border-dark"}
                    />
                  ))}
                </div>
                <p className="mt-4 text-[14.5px] leading-relaxed text-text-secondary-dark">
                  {t.comment}
                </p>
                <div className="mt-5 flex items-center gap-3 border-t border-border-dark pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#9c7cf5] text-[13px] font-semibold text-white">
                    {t.studentName[0]}
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-text-primary-dark">{t.studentName}</div>
                    <div className="text-[12.5px] text-text-muted-dark">
                      {t.yearName ? `${t.yearName} · ` : ""}
                      {t.courseTitle}
                    </div>
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
