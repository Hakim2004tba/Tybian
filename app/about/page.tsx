import { GraduationCap, Target, Heart, Users } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { getDictionary } from "@/lib/i18n/locale";

export default async function AboutPage() {
  const { dict } = await getDictionary();
  const t = dict.pages.about;
  const h = dict.home.about;
  return (
    <div className="bg-bg-light">
      <section className="bg-bg-dark py-4xl">
        <Container className="text-center">
          <Badge variant="violet">{h.badge}</Badge>
          <h1 className="mx-auto mt-4 max-w-2xl text-text-primary-dark">
            {h.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-text-secondary-dark">
            {h.p1}
          </p>
        </Container>
      </section>

      <section className="py-4xl">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="text-center">
              <Target size={22} className="mx-auto text-primary" />
              <h3 className="mt-3 text-[16px]">{t.mission}</h3>
              <p className="mt-2 text-[13.5px] text-text-secondary-light">
                {t.missionBody}
              </p>
            </Card>
            <Card className="text-center">
              <GraduationCap size={22} className="mx-auto text-primary" />
              <h3 className="mt-3 text-[16px]">{t.trusted}</h3>
              <p className="mt-2 text-[13.5px] text-text-secondary-light">
                {t.trustedBody}
              </p>
            </Card>
            <Card className="text-center">
              <Heart size={22} className="mx-auto text-primary" />
              <h3 className="mt-3 text-[16px]">{t.madeForYou}</h3>
              <p className="mt-2 text-[13.5px] text-text-secondary-light">
                {t.madeForYouBody}
              </p>
            </Card>
            <Card className="text-center">
              <Users size={22} className="mx-auto text-primary" />
              <h3 className="mt-3 text-[16px]">{t.community}</h3>
              <p className="mt-2 text-[13.5px] text-text-secondary-light">
                {t.communityBody}
              </p>
            </Card>
          </div>

          <Card className="mt-10 max-w-3xl mx-auto text-center">
            <p className="text-[14.5px] leading-relaxed text-text-secondary-light">
              {h.p2}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <div className="num text-2xl font-bold text-primary">2025</div>
                <div className="mt-1 text-[13px] text-text-muted-light">{h.statYear}</div>
              </div>
              <div>
                <div className="num text-2xl font-bold text-primary">7</div>
                <div className="mt-1 text-[13px] text-text-muted-light">{h.statYears}</div>
              </div>
            </div>
          </Card>
        </Container>
      </section>
    </div>
  );
}
