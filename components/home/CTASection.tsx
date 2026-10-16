import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { getDictionary } from "@/lib/i18n/locale";

/**
 * Uses the standard violet glow — matches the rest of the page's single
 * accent color rather than introducing gold this low on the homepage,
 * where it isn't paired with any commerce-specific pricing context
 * (see DESIGN_DECISIONS.md D-002: gold stays reserved for lifetime
 * plan/premium moments specifically).
 */
export async function CTASection() {
  const { dict } = await getDictionary();
  const t = dict.home.cta;

  return (
    <section className="relative overflow-hidden bg-bg-dark py-4xl">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl animate-pulse-slow"
        aria-hidden="true"
      />
      <Container className="relative text-center">
        <Reveal>
          <h2 className="mx-auto max-w-xl text-text-primary-dark">{t.title}</h2>
          <p className="mx-auto mt-4 max-w-md text-text-secondary-dark">{t.body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/register">
              <Button variant="primary">{t.primary}</Button>
            </Link>
            <Link href="/courses">
              <Button variant="outline" className="border-border-dark text-text-primary-dark">
                {t.secondary}
              </Button>
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
