import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { SectionAura } from "@/components/home/SectionAura";
import { FeatureCarousel, type FeatureSlide } from "@/components/home/showcase/FeatureCarousel";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * What the platform does, one feature at a time.
 *
 * WHY THIS IS NO LONGER SIX STACKED ROWS: every feature had the full
 * width of the page and none of them had the visitor's attention. The
 * section ran for six screens, so the sixth was seen by nobody, and a
 * feature list that long reads as a specification rather than a reason
 * to sign up. It is now one carousel: each feature gets a whole slide,
 * a title large enough to read at a glance, its three points, and a
 * picture of the screen it belongs to.
 *
 * WHY THE SCREENSHOTS ARE GONE: a capture of a dense page shrunk into a
 * card shows a grey smudge — the control being described ends up a few
 * pixels tall. The pictures are now drawn (see FeatureMock): they read
 * at any size, weigh nothing, and cannot go stale when the real UI
 * moves.
 *
 * Every slide must correspond to something shipped. A front page that
 * promises what the product does not do is discovered on day one, and
 * by then it has cost trust rather than bought attention.
 */

/*
  The order is the order a student meets these things, not the order
  they were built. Each carries its own accent: a colour per feature is
  what makes the slides feel like different places rather than one
  template with the words swapped.

  Values, not class names — Tailwind only generates classes it can read
  in the source, so a colour chosen at runtime has to travel as a value.
*/
const accents: Record<string, { from: string; to: string }> = {
  ai: { from: "#8B6CF6", to: "#6C4CF1" },
  lesson: { from: "#3EA7F5", to: "#2563EB" },
  tracker: { from: "#34D399", to: "#0EA371" },
  sketch: { from: "#FBBF5C", to: "#E8A33D" },
  timer: { from: "#FB7BA2", to: "#E1487C" },
  compete: { from: "#6EE7A8", to: "#3FA96B" },
  discussion: { from: "#43E0C8", to: "#22D3B8" },
};

const order = ["ai", "sketch", "compete", "tracker", "lesson", "timer", "discussion"] as const;

export async function PlatformShowcase() {
  const { dict } = await getDictionary();
  const t = dict.home.showcase;

  const slides: FeatureSlide[] = order.map((key) => {
    const row = t.rows[key];
    return {
      key,
      eyebrow: row.eyebrow,
      title: row.title,
      body: row.body,
      points: [row.p1, row.p2, row.p3],
      ...accents[key],
    };
  });

  return (
    <section className="relative isolate overflow-hidden bg-bg-light py-3xl md:py-4xl">
      <SectionAura tone="light" />
      <Container>
        <Reveal className="text-center">
          <Badge variant="violet">{t.badge}</Badge>
          <h2 className="mx-auto mt-4 max-w-xl">
            {t.titleA}
            <span className="text-primary">{t.titleB}</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary-light md:text-[16px]">
            {t.subtitle}
          </p>
        </Reveal>

        <FeatureCarousel slides={slides} />
      </Container>
    </section>
  );
}
