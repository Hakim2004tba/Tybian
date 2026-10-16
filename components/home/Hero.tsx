import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Clock, Award, Star, Users, GraduationCap, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/ui/Reveal";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type { HomepageStats } from "@/lib/data/homepage";

/**
 * Hero is the one screen-defining glow moment on the homepage (see
 * DESIGN_SYSTEM.md §8 — max one glow focal point per screen). The left
 * side is the real TIBYAN wordmark floating on its own — deliberately
 * NOT wrapped in a card/frame/background box — with a static CSS glow
 * + concentric rings + a plain SVG ECG line behind it (no
 * canvas/animation cost, matches §15 Performance rules).
 */
export function Hero({ locale, dict, stats: realStats }: { locale: Locale; dict: Dictionary; stats: HomepageStats }) {
  const features = [
    {
      icon: ShieldCheck,
      title: locale === "ar" ? "محتوى موثوق" : "Trusted content",
      subtitle: locale === "ar" ? "من أساتذة ومتخصصين" : "By professors & specialists",
    },
    {
      icon: Clock,
      title: locale === "ar" ? "تعلم في أي وقت" : "Learn anytime",
      subtitle: locale === "ar" ? "وفق جدولك الخاص" : "At your own pace",
    },
    {
      icon: Award,
      title: locale === "ar" ? "شهادات معتمدة" : "Certified credentials",
      subtitle: locale === "ar" ? "تعزز مسارك المهني" : "Boost your career path",
    },
  ];

  const numberFormatter = new Intl.NumberFormat("en-US");
  const stats = [
    {
      icon: Users,
      value: `${numberFormatter.format(realStats.studentCount)}${realStats.studentCount > 0 ? "+" : ""}`,
      label: locale === "ar" ? "طالب طب مسجّل" : "registered students",
    },
    {
      icon: BookOpen,
      value: numberFormatter.format(realStats.courseCount),
      label: locale === "ar" ? "دورة ومحاضرة" : "courses & lectures",
    },
    {
      icon: Star,
      value: realStats.avgRating > 0 ? realStats.avgRating.toFixed(1) : "—",
      label: locale === "ar" ? "تقييم الطلبة" : "student rating",
    },
    {
      icon: GraduationCap,
      value: `${numberFormatter.format(realStats.totalHours)}${realStats.totalHours > 0 ? "+" : ""}`,
      label: locale === "ar" ? "ساعة تعليمية" : "teaching hours",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-bg-dark pb-lg pt-[88px] md:pb-xl md:pt-[104px]">
      {/* Subtle dot-grid texture across the whole hero — low opacity, static, no cost */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(rgba(139,92,246,0.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />
      <div
        /*
          Centred with a negative margin, not `-translate-x-1/2`: the
          `pulse-slow` animation sets `transform: scale()` on this same
          element, and an animated transform replaces the utility's one
          outright rather than composing with it — the translate was
          silently doing nothing and the glow sat half a width off.
        */
        className="pointer-events-none absolute -top-40 left-1/2 -ml-[260px] h-[520px] w-[520px] rounded-full bg-primary/20 blur-3xl animate-pulse-slow lg:left-auto lg:right-0 lg:ml-0 lg:h-[700px] lg:w-[700px]"
        aria-hidden="true"
      />

      <Container className="relative grid items-center gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        {/* Left — the anatomical figure as the hero's single glow focal
            point (DESIGN_SYSTEM.md §8). Rings + radial glow sit behind it
            and the bottom is masked so it fades into the section rather
            than being cut by a hard edge.

            HIDDEN BELOW lg. On a phone the figure is taller than the
            viewport, so it pushed the headline and the buttons entirely
            below the fold — the visitor's first screen was an image with
            no words on it. The desktop composition depends on it; the
            mobile one does not. */}
        <Reveal
          delay={100}
          variant="scale"
          className="relative hidden items-end justify-center self-end lg:col-start-2 lg:row-start-1 lg:flex"
        >
          <div className="relative flex w-full max-w-xl items-end justify-center">
            {/* Concentric rings, centered on the figure's upper body */}
            <div className="pointer-events-none absolute left-1/2 top-[22%] h-[520px] w-[520px] -translate-x-1/2 rounded-full border border-primary/10" aria-hidden="true" />
            <div className="pointer-events-none absolute left-1/2 top-[22%] h-[400px] w-[400px] -translate-x-1/2 rounded-full border border-primary/15" aria-hidden="true" />
            <div className="pointer-events-none absolute left-1/2 top-[22%] h-[280px] w-[280px] -translate-x-1/2 rounded-full border border-primary/20" aria-hidden="true" />
            {/* Radial glow behind the figure */}
            <div
              className="pointer-events-none absolute left-1/2 top-[18%] h-[560px] w-[560px] -translate-x-1/2 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(139,92,246,0.38) 0%, rgba(139,92,246,0.12) 45%, transparent 72%)" }}
              aria-hidden="true"
            />

            <Image
              src="/hero/anatomy.webp"
              alt=""
              width={840}
              height={1260}
              /* Not `priority`: it is display:none below lg, so preloading
                 it would spend a phone's first bytes on something invisible. */
              loading="lazy"
              aria-hidden="true"
              className="relative w-full max-w-[380px] sm:max-w-[440px] lg:max-w-[460px]"
              style={{
                maskImage: "linear-gradient(to bottom, #000 82%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, #000 82%, transparent 100%)",
              }}
            />
          </div>
        </Reveal>

        {/*
          Right — messaging (column 1 is the right-hand column in RTL).

          Centred below lg. The anatomical figure is hidden on a phone,
          so this column is the entire hero there: left against the
          reading edge it sat in a narrow ragged strip with the whole
          left half of the screen empty, which read as a broken layout
          rather than a deliberate one. With the figure present from lg
          up, the same text belongs back on its edge.
        */}
        {/*
          STAGGERED, not all at once. One Reveal wrapped the whole
          column, so the badge, the headline, the sentence and the
          buttons appeared together as a single block — which is what
          made a phone screen full of text land all at once. They now
          arrive in reading order, about a tenth of a second apart:
          enough to lead the eye down, not enough to wait for.
        */}
        <div className="text-center lg:col-start-1 lg:row-start-1 lg:text-start">
          <Reveal>
          <Badge variant="violet">
            {locale === "ar" ? "منصة تعليم طبي متكاملة" : "A complete medical education platform"}
          </Badge>
          </Reveal>

          <Reveal delay={90}>
          <h1 className="mt-4 text-[30px] leading-[1.3] font-bold text-text-primary-dark sm:text-[42px] md:text-[52px] md:leading-[1.15] lg:text-[58px]">
            {dict.hero.title}
          </h1>
          </Reveal>

          <Reveal delay={180}>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-text-secondary-dark md:mt-5 md:text-[17px] lg:mx-0">
            {dict.hero.subtitle}
          </p>
          </Reveal>

          <Reveal delay={270}>
          <div className="mt-7 flex flex-wrap justify-center gap-3 md:mt-9 md:gap-4 lg:justify-start">
            <Link href="/courses" className="flex-1 sm:flex-none">
              <Button variant="primary" className="w-full justify-center shadow-[0_8px_24px_rgba(108,76,241,0.35)] sm:w-auto">
                {dict.hero.secondaryCta}
              </Button>
            </Link>
            <Link href="/register" className="flex-1 sm:flex-none">
              <Button variant="outline" className="w-full justify-center border-border-dark text-text-primary-dark sm:w-auto">
                {dict.hero.cta}
              </Button>
            </Link>
          </div>
          </Reveal>

          {/*
            THE THREE PROMISES ARE DESKTOP-ONLY NOW.

            On a phone they were the crowding: three more headings and
            three more subtitles directly under the buttons, in a
            two-column grid whose third item spanned both and sat
            centred on its own. They are also the weakest copy on the
            page — "trusted content", "learn anytime" — and the
            sections below say the same thing with evidence. The first
            screen is better as a headline, a sentence and two buttons.
          */}
          <div className="mt-7 hidden grid-cols-2 gap-x-5 gap-y-4 border-t border-border-dark pt-6 md:mt-11 md:flex md:flex-wrap md:gap-x-9 md:gap-y-5 md:pt-8">
            {features.map((f) => (
              <div
                  key={f.title}
                  className="flex items-center justify-center gap-3 last:col-span-2 md:last:col-span-1 lg:justify-start"
                >
                <f.icon size={18} className="shrink-0 text-primary md:size-5" strokeWidth={1.75} />
                <div>
                  <div className="text-[12.5px] font-semibold leading-tight text-text-primary-dark md:text-[13.5px]">{f.title}</div>
                  <div className="text-[11px] leading-tight text-text-muted-dark md:text-[12px]">{f.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>

      {/* Wide statistics panel */}
      <Container className="relative mt-8 md:mt-xl">
        <Reveal delay={160}>
          <div className="grid grid-cols-2 divide-y divide-primary/15 rounded-2xl border border-primary/15 bg-white/[0.02] backdrop-blur-sm sm:grid-cols-4 sm:divide-y-0 sm:divide-x sm:divide-x-reverse">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center justify-center gap-2.5 px-4 py-4 sm:justify-start md:gap-3 md:px-6 md:py-6">
                <s.icon size={19} className="shrink-0 text-primary md:size-[22px]" strokeWidth={1.75} />
                <div>
                  <div className="num text-[20px] font-bold text-text-primary-dark md:text-[24px]">{s.value}</div>
                  <div className="text-[11.5px] leading-tight text-text-muted-dark md:text-[12.5px]">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
