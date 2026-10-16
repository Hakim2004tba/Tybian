import { notFound, redirect } from "next/navigation";
import { CreditCard, Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { queryOne } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { getPackById } from "@/lib/data/packs";
import { getDictionary } from "@/lib/i18n/locale";
import { PayNowForm } from "@/components/checkout/PayNowForm";
import { CheckStatusForm } from "@/components/checkout/CheckStatusForm";

export const dynamic = "force-dynamic";

export default async function PackCheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { dict } = await getDictionary();
  const t = dict.checkout;

  const user = await requireAuth(`/checkout/pack/${orderId}`);

  /*
    `user_id = ?` is the ownership check. Without it, anyone holding an
    order id could open somebody else's checkout and read its amount.
  */
  const order = await queryOne<{
    id: string; pack_id: string | null; amount: string; currency: string; status: string;
  }>(
    `SELECT id, pack_id, amount, currency, status
       FROM orders WHERE id = ? AND user_id = ? LIMIT 1`,
    [orderId, user.id]
  );

  if (!order || !order.pack_id) notFound();
  if (order.status === "paid") redirect("/dashboard/courses");

  const pack = await getPackById(order.pack_id);
  if (!pack) notFound();

  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-bg-light p-8">
      <Card className="w-full max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CreditCard size={22} className="text-primary" />
        </div>

        <div className="mt-4 text-center">
          <Badge variant="violet">{t.title}</Badge>
          <h1 className="mt-2 flex items-center justify-center gap-2 text-xl">
            <Layers size={18} className="text-primary" />
            {pack.title}
          </h1>
          <p className="num mt-1 text-[14px] text-text-secondary-light">
            {pack.courses.length} {dict.packs.coursesIn}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border-light pt-4">
          <span className="text-[14px] text-text-secondary-light">{t.total}</span>
          <span className="num text-[20px] font-bold text-text-primary-light">
            {Number(order.amount).toLocaleString("en-US")} {order.currency}
          </span>
        </div>

        <div className="mt-4">
          {/* The same payment components the course checkout uses. What
              they call `courseSlug` is only the path the provider sends
              the student back to, so a pack passes its own — landing on
              /checkout/pack/<id>/return. */}
          <PayNowForm orderId={order.id} courseSlug={`pack/${order.id}`} />
        </div>

        <div className="mt-3">
          <CheckStatusForm orderId={order.id} />
        </div>

        <p className="mt-3 text-center text-[12px] leading-relaxed text-text-muted-light">
          {t.note}
        </p>
      </Card>
    </div>
  );
}
