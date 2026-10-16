import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { SectionAura } from "@/components/home/SectionAura";
import { IntroVideo } from "@/components/home/IntroVideo";
import { queryOne } from "@/lib/db";
import { parseVimeoSource } from "@/lib/video/extract-vimeo-event";
import { columnExists } from "@/lib/db/tables";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * "See how it works" — the platform explaining itself.
 *
 * Renders NOTHING when no video is set, rather than a placeholder: an
 * empty frame on a homepage is worse than one section fewer, and the
 * owner adds the link from the admin settings when they have it.
 */
export async function IntroSection() {
  if (!(await columnExists("platform_settings", "intro_video"))) return null;

  const row = await queryOne<{ intro_video: string | null }>(
    `SELECT intro_video FROM platform_settings WHERE id = 1 LIMIT 1`
  );
  const source = parseVimeoSource(row?.intro_video ?? null);
  if (!source) return null;

  const { dict } = await getDictionary();
  const t = dict.home.intro;

  return (
    <section className="relative isolate overflow-hidden bg-bg-dark py-3xl md:py-4xl">
      <SectionAura tone="dark" />
      <Container>
        <Reveal className="text-center">
          <Badge variant="violet">{t.badge}</Badge>
          <h2 className="mx-auto mt-4 max-w-xl text-text-primary-dark">{t.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary-dark md:text-[16px]">
            {t.body}
          </p>
        </Reveal>

        <Reveal delay={120} className="mx-auto mt-8 max-w-3xl md:mt-10">
          <IntroVideo videoId={source.id} hash={source.hash} />
        </Reveal>
      </Container>
    </section>
  );
}
