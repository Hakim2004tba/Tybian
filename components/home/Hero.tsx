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
    <section className="relative overflow-hidden bg-bg-dark pb-4xl pt-3xl md:pt-4xl">
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
        className="pointer-events-none absolute -top-40 right-0 h-[700px] w-[700px] rounded-full bg-primary/20 blur-3xl animate-pulse-slow"
        aria-hidden="true"
      />

      <Container className="relative grid items-center gap-16 lg:grid-cols-[1fr_1.05fr]">
        {/* Left — the floating logo, no card/frame */}
        <Reveal delay={100} variant="scale" className="relative flex items-center justify-center py-10 lg:py-0">
          <div className="relative flex w-full max-w-md items-center justify-center">
            {/* Concentric rings behind the logo */}
            <div className="pointer-events-none absolute h-[340px] w-[340px] rounded-full border border-primary/15" aria-hidden="true" />
            <div className="pointer-events-none absolute h-[260px] w-[260px] rounded-full border border-primary/20" aria-hidden="true" />
            <div className="pointer-events-none absolute h-[180px] w-[180px] rounded-full border border-primary/25" aria-hidden="true" />
            {/* Radial glow centered on the logo */}
            <div
              className="pointer-events-none absolute h-[360px] w-[360px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(139,92,246,0.30) 0%, transparent 70%)" }}
              aria-hidden="true"
            />
            {/* ECG line integrated behind the logo */}
            <svg
              viewBox="0 0 400 60"
              className="pointer-events-none absolute w-[85%] opacity-40"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                points="0,30 140,30 165,10 185,50 205,30 400,30"
                fill="none"
                stroke="#A78BFA"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <Image
              src="/logo.png"
              alt="تبيان TIBYAN"
              width={800}
              height={420}
              priority
              className="relative w-[75%] max-w-[360px] drop-shadow-[0_0_40px_rgba(139,92,246,0.35)]"
            />
          </div>
        </Reveal>

        {/* Right — messaging */}
        <Reveal>
          <Badge variant="violet">
            {locale === "ar" ? "منصة تعليم طبي متكاملة" : "A complete medical education platform"}
          </Badge>

          <h1 className="mt-6 text-[34px] leading-[1.25] font-bold text-text-primary-dark sm:text-[42px] md:text-[52px] md:leading-[1.2]">
            {dict.hero.title}
          </h1>

          <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-text-secondary-dark md:text-[17px]">
            {dict.hero.subtitle}
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="/courses">
              <Button variant="primary" className="shadow-[0_8px_24px_rgba(108,76,241,0.35)]">
                {dict.hero.secondaryCta}
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" className="border-border-dark text-text-primary-dark">
                {dict.hero.cta}
              </Button>
            </Link>
          </div>

          <div className="mt-11 flex flex-wrap gap-x-9 gap-y-5 border-t border-border-dark pt-8">
            {features.map((f) => (
              <div key={f.title} className="flex items-center gap-3">
                <f.icon size={20} className="shrink-0 text-primary" strokeWidth={1.75} />
                <div>
                  <div className="text-[13.5px] font-semibold text-text-primary-dark">{f.title}</div>
                  <div className="text-[12px] text-text-muted-dark">{f.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>

      {/* Wide statistics panel */}
      <Container className="relative mt-16 md:mt-20">
        <Reveal delay={160}>
          <div className="grid grid-cols-2 divide-y divide-primary/15 rounded-2xl border border-primary/15 bg-white/[0.02] backdrop-blur-sm sm:grid-cols-4 sm:divide-y-0 sm:divide-x sm:divide-x-reverse">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-3 px-6 py-6">
                <s.icon size={22} className="shrink-0 text-primary" strokeWidth={1.75} />
                <div>
                  <div className="num text-[24px] font-bold text-text-primary-dark">{s.value}</div>
                  <div className="text-[12.5px] text-text-muted-dark">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
