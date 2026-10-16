import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * The platform mockup supplied by the team, shown as-is.
 *
 * The file lives at public/showcase/platform-mockup.png. Replacing the
 * picture is the whole update — nothing here needs touching.
 *
 * The section renders NOTHING until that file exists. A missing image
 * in a `<Image src="/...">` is not a build error — Next resolves public
 * paths at request time — so without this check the homepage would ship
 * with a broken picture box where the mockup should be, and nobody
 * would find out until a visitor scrolled past it.
 *
 * `priority` is deliberately off: this sits well below the fold, and
 * preloading it would spend a phone's first bytes on an image the
 * visitor has not scrolled to.
 */
const MOCKUP = "/showcase/platform-mockup.png";
export async function PlatformMockup() {
  if (!existsSync(join(process.cwd(), "public", MOCKUP))) return null;

  const { dict } = await getDictionary();
  const t = dict.home.mockup;

  return (
    <section className="overflow-hidden bg-bg-light py-3xl md:py-4xl">
      <Container>
        <Reveal className="text-center">
          <Badge variant="violet">{t.badge}</Badge>
          <h2 className="mx-auto mt-4 max-w-xl">{t.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary-light md:text-[16px]">
            {t.subtitle}
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mx-auto mt-8 max-w-[1100px] md:mt-12">
            <Image
              src={MOCKUP}
              alt={t.imageAlt}
              /* The file's real pixel size. Next reserves space from these
                 numbers, so a guess here shows as a jump when the image
                 finishes loading. */
              width={1536}
              height={1024}
              sizes="(max-width: 1100px) 100vw, 1100px"
              loading="lazy"
              className="h-auto w-full"
            />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
