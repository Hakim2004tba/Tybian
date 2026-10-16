import { ShieldCheck, Brain, Video, LineChart, MessagesSquare, Smartphone } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { getDictionary } from "@/lib/i18n/locale";
import { SectionAura } from "@/components/home/SectionAura";

/* Icons stay here; the words live in the dictionary so both languages
   read the same list. The keys match lib/i18n/dictionaries. */
const featureIcons = [
  { key: "video", icon: Video },
  { key: "progress", icon: LineChart },
  { key: "trusted", icon: ShieldCheck },
  { key: "discussion", icon: MessagesSquare },
  { key: "spaced", icon: Brain },
  { key: "devices", icon: Smartphone },
] as const;

export async function PlatformFeatures() {
  const { dict } = await getDictionary();
  const t = dict.home.features;
  const features = featureIcons.map((f) => ({ icon: f.icon, ...t.items[f.key] }));

  return (
    <section className="relative isolate overflow-hidden bg-bg-light py-4xl">
      <SectionAura tone="light" />
      <Container>
        <Reveal className="text-center">
          <Badge variant="violet">{t.badge}</Badge>
          <h2 className="mx-auto mt-4 max-w-lg">{t.title}</h2>
        </Reveal>

        <div className="mt-7 grid grid-cols-2 gap-3 md:mt-10 md:gap-5 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <Card className="h-full">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 md:h-11 md:w-11">
                  <f.icon size={20} className="text-primary" strokeWidth={1.6} />
                </div>
                <h3 className="mt-3 text-[14.5px] leading-snug md:mt-4 md:text-[17px]">{f.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-secondary-light md:mt-2 md:text-[14px]">{f.desc}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
