import Link from "next/link";
import { CheckCircle2, PlayCircle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import type { CoursePricing, StudentAccessState } from "@/lib/data/course-details";

const planLabel: Record<string, string> = {
  three_months: "اشتراك 3 أشهر",
  lifetime: "اشتراك مدى الحياة",
};

const currency = new Intl.NumberFormat("en-US");

/**
 * The three CTA states this renders map directly to the requirement:
 *  - hasLifetimeAccess → no purchase option shown at all, ever (the
 *    explicit "لا تعرض زر شراء للطالب الذي يملك lifetime access" rule).
 *  - hasAccess (any active enrollment, incl. 3-month) → "Continue
 *    Learning" only — an enrolled student never sees a buy button for a
 *    course they already have.
 *  - otherwise → pricing cards with "اشترك الآن" per plan.
 */
export function PricingPanel({
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
  if (access.hasLifetimeAccess) {
    return (
      <Card className="relative overflow-hidden border-gold/40">
        <div className="glow-gold" style={{ height: 140 }} />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15">
            <Sparkles size={20} className="text-gold" />
          </div>
          <Badge variant="gold" className="mt-4">
            لديك وصول مدى الحياة
          </Badge>
          <p className="mt-3 text-[14px] text-text-secondary-light">
            يمكنك مشاهدة كل محتوى هذه الدورة في أي وقت.
          </p>
          {firstLessonId && (
            <Link href={`/courses/${courseSlug}/learn?lesson=${firstLessonId}`} className="mt-5 block">
              <Button className="w-full justify-center">
                <PlayCircle size={16} />
                متابعة التعلم
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
            مُسجَّل في هذه الدورة
          </Badge>
          <p className="mt-3 text-[14px] text-text-secondary-light">
            خطتك الحالية: {planLabel[access.planType ?? ""] ?? access.planType}
          </p>
          {firstLessonId && (
            <Link href={`/courses/${courseSlug}/learn?lesson=${firstLessonId}`} className="mt-5 block">
              <Button className="w-full justify-center">
                <PlayCircle size={16} />
                متابعة التعلم
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
        <p className="text-[14px] text-text-muted-light">التسعير غير متاح حالياً لهذه الدورة.</p>
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
                {isLifetime && <Badge variant="gold">الأفضل قيمة</Badge>}
                <h4 className="mt-2 text-[15px] font-semibold">{planLabel[plan.planType]}</h4>
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
                    اشترك الآن
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
