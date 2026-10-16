import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/ui/Reveal";
import { getDictionary } from "@/lib/i18n/locale";
import { SectionAura } from "@/components/home/SectionAura";

export async function AboutTibyan() {
  const { dict } = await getDictionary();
  const t = dict.home.about;

  return (
    <section className="relative isolate overflow-hidden bg-bg-light py-4xl">
      <SectionAura tone="light" />
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal className="relative overflow-hidden rounded-xl border border-border-light">
          <Image
            src="/courses/neuro.svg"
            alt={t.imageAlt}
            width={600}
            height={400}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </Reveal>

        <Reveal delay={100} className="text-center lg:text-start">
          <Badge variant="violet">{t.badge}</Badge>
          <h2 className="mt-4">{t.title}</h2>
          <p className="mt-4 text-text-secondary-light leading-relaxed">
            {t.p1}
          </p>
          <p className="mt-4 text-text-secondary-light leading-relaxed">
            {t.p2}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-6">
            <div>
              <div className="num text-2xl font-bold text-primary">2025</div>
              <div className="mt-1 text-[13px] text-text-muted-light">{t.statYear}</div>
            </div>
            <div>
              <div className="num text-2xl font-bold text-primary">7</div>
              <div className="mt-1 text-[13px] text-text-muted-light">{t.statYears}</div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
