import { notFound, redirect } from "next/navigation";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireAuth } from "@/lib/auth/session";
import { getCourseBySlug } from "@/lib/data/course-details";
import { getOrCreatePendingOrder, type PlanType } from "@/lib/actions/checkout";
import { PayNowForm } from "@/components/checkout/PayNowForm";
import { CheckStatusForm } from "@/components/checkout/CheckStatusForm";

const planLabel: Record<string, string> = {
  three_months: "اشتراك 3 أشهر",
  lifetime: "اشتراك مدى الحياة",
};

const currency = new Intl.NumberFormat("en-US");

/**
 * Course → Pricing → Checkout → Payment → server-side verification →
 * Enrollment → Access.
 *
 * This page only ever DISPLAYS an order; it never grants access itself.
 * The order is created here (getOrCreatePendingOrder), but enrollment
 * only ever happens in completeOrderFromVerification — called from the
 * payment webhook (primary path) or the manual "تحقق من حالة الدفع"
 * fallback below — both server-side, both gated on the payment
 * provider's own verify() response, never on anything this page's
 * frontend believes happened.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { slug } = await params;
  const { plan } = await searchParams;

  await requireAuth(`/checkout/${slug}`);

  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const planType: PlanType = plan === "lifetime" ? "lifetime" : "three_months";
  const result = await getOrCreatePendingOrder(course.id, planType);

  if (result.kind === "already_enrolled") {
    redirect(`/courses/${slug}`);
  }

  if (result.kind === "error") {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-bg-light p-8">
        <Card className="w-full max-w-md text-center">
          <p className="text-[14px] text-error">{result.message}</p>
        </Card>
      </div>
    );
  }

  const { order } = result;

  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-bg-light p-8">
      <Card className="w-full max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CreditCard size={22} className="text-primary" />
        </div>

        <div className="mt-4 text-center">
          <Badge variant="violet">إتمام الاشتراك</Badge>
          <h1 className="mt-2 text-xl">{course.title}</h1>
          <p className="mt-1 text-[14px] text-text-secondary-light">{planLabel[order.planType]}</p>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-md border border-border-light bg-bg-light px-4 py-3">
          <span className="text-[14px] text-text-secondary-light">المبلغ الإجمالي</span>
          <span className="num text-[18px] font-bold">
            {currency.format(order.amount)} {order.currency}
          </span>
        </div>

        <div className="mt-5">
          <PayNowForm orderId={order.id} courseSlug={slug} />
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-[11.5px] text-text-muted-light">
          <ShieldCheck size={13} />
          يُفعَّل وصولك فقط بعد تأكيد الدفع من مزوّد الدفع مباشرة على الخادم.
        </div>

        <div className="mt-4 border-t border-border-light pt-3">
          <CheckStatusForm orderId={order.id} />
        </div>
      </Card>
    </div>
  );
}
