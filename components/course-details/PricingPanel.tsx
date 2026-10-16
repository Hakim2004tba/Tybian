import Link from "next/link";
import { CheckCircle2, PlayCircle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import type { CoursePricing, StudentAccessState } from "@/lib/data/course-details";
import { getDictionary } from "@/lib/i18n/locale";
import { describeDuration } from "@/lib/plans/duration";

/* Keys into dict.courseDetails.pricing, not words: this map sits at
   module level where the dictionary is out of scope.

   Used only where a LENGTH is not available — the enrollment the
   student already holds records which slot it was bought in, not how
   long that slot was when they bought it. The plan CARDS below name
   the real duration instead, because that is the thing being sold and
   an admin can change it. */
const planLabel: Record<string, "threeMonths" | "lifetime"> = {
  three_months: "threeMonths",
  lifetime: "lifetime",
};

const currency = new Intl.NumberFormat("en-US");

/**
 * The three CTA states this renders map directly to the requirement:
 *  - hasLifetimeAccess → no purchase option shown at all, ever (the
 *    explicit "لا تعرض زر شراء للطالب الذي يملك lifetime access" rule).
 *  - hasAccess (any active enrollment, incl. 3-month) → "Continue
 *    Learning" only — an enrolled student never sees a buy button for a
 *    course they already have.
 *  - otherwise → pricing cards with a subscribe button per plan.
 */
export async function PricingPanel({
  courseSlug,
  firstLessonId,
  pricing,
  access,
}: {
  courseSlug: string;
  firstLessonId: string | null;
  pricing: CoursePricing;
  access: StudentAccessState;
}) {
  const { dict, locale } = await getDictionary();
  const t = dict.courseDetails;
  if (access.hasLifetimeAccess) {
    return (
      <Card className="relative overflow-hidden border-gold/40">
        <div className="glow-gold" style={{ height: 140 }} />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15">
            <Sparkles size={20} className="text-gold" />
          </div>
          <Badge variant="gold" className="mt-4">
            {t.pricing.lifetimeAccess}
          </Badge>
          <p className="mt-3 text-[14px] text-text-secondary-light">
            {t.pricing.watchAnytime}
          </p>
          {firstLessonId && (
            <Link href={`/courses/${courseSlug}/learn?lesson=${firstLessonId}`} className="mt-5 block">
              <Button className="w-full justify-center">
                <PlayCircle size={16} />
                {t.pricing.continueLearning}
              </Button>
            </Link>
          )}
        </div>
      </Card>
    );
  }

  if (access.hasAccess) {
    return (
      <Card className="relative overflow-hidden border-success/30">
        <div className="glow-violet" style={{ height: 140, opacity: 0.35 }} />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 size={20} className="text-success" />
          </div>
          <Badge variant="success" className="mt-4">
            {t.pricing.enrolled}
          </Badge>
          <p className="mt-3 text-[14px] text-text-secondary-light">
            {t.pricing.currentPlan} {t.pricing[planLabel[access.planType ?? ""]] ?? access.planType}
          </p>
          {firstLessonId && (
            <Link href={`/courses/${courseSlug}/learn?lesson=${firstLessonId}`} className="mt-5 block">
              <Button className="w-full justify-center">
                <PlayCircle size={16} />
                {t.pricing.continueLearning}
              </Button>
            </Link>
          )}
        </div>
      </Card>
    );
  }

  if (!pricing.length) {
    return (
      <Card>
        <p className="text-[14px] text-text-muted-light">{t.pricing.unavailable}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {pricing.map((plan, i) => {
        const isLifetime = plan.planType === "lifetime";
        return (
          <Reveal key={plan.planType} delay={i * 80} variant="scale">
            <Card
              className={
                isLifetime
                  ? "relative overflow-hidden border-gold/40 transition-shadow hover:shadow-[0_12px_36px_-12px_rgba(200,164,80,0.35)]"
                  : "transition-shadow hover:shadow-lg"
              }
            >
              {isLifetime && <div className="glow-gold" style={{ height: 120 }} />}
              <div className="relative">
                {isLifetime && <Badge variant="gold">{t.pricing.bestValue}</Badge>}
                {/*
                  The duration as the admin set it — "6 أشهر", "سنة
                  كاملة" — not the fixed "3 أشهر" the dictionary used to
                  hold. A price that says one length and a plan that
                  grants another is the kind of mismatch a student
                  notices on the day their access ends.
                */}
                <h4 className="mt-2 text-[15px] font-semibold">
                  {t.pricing.subscription} {describeDuration(plan.durationDays, locale)}
                </h4>
                <div className="num mt-2 text-[26px] font-bold">
                  {currency.format(plan.price)} <span className="text-[14px] font-normal">{plan.currency}</span>
                </div>
                <Link
                  href={
                    access.isAuthenticated
                      ? `/checkout/${courseSlug}?plan=${plan.planType}`
                      : `/login?redirect=${encodeURIComponent(`/courses/${courseSlug}`)}`
                  }
                  className="mt-4 block"
                >
                  <Button variant={isLifetime ? "gold" : "primary"} className="w-full justify-center">
                    {t.pricing.subscribeNow}
                  </Button>
                </Link>
              </div>
            </Card>
          </Reveal>
        );
      })}
    </div>
  );
}
