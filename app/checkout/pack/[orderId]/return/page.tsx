import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { requireAuth } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { checkPaymentStatusAction } from "@/lib/actions/checkout-actions";
import { getDictionary } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * Where the payment provider sends the student back after a pack.
 *
 * It asks the server to VERIFY with the provider rather than believing
 * the redirect: arriving at this URL proves only that a browser
 * followed a link. Access is granted by the verification (and by the
 * webhook, whichever lands first), never by the student being here.
 */
export default async function PackReturnPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { dict } = await getDictionary();
  const user = await requireAuth(`/checkout/pack/${orderId}/return`);

  const order = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM orders WHERE id = ? AND user_id = ? LIMIT 1`,
    [orderId, user.id]
  );
  if (!order) redirect("/dashboard/courses");

  /* Ask the provider. Its answer, not the redirect, decides. */
  const result = await checkPaymentStatusAction(orderId, { error: null }, new FormData());
  const settled = order.status === "paid" || result.enrolled === true;

  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-bg-light p-8">
      <Card className="w-full max-w-md text-center">
        {settled ? (
          <>
            <CheckCircle2 size={34} className="mx-auto text-success" strokeWidth={1.5} />
            <h1 className="mt-3 text-[19px] font-bold text-text-primary-light">
              {dict.checkout.title}
            </h1>
            <p className="mt-2 text-[14px] text-text-secondary-light">{dict.packs.lifetimeNote}</p>
            <Link
              href="/dashboard/courses"
              className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              {dict.dash.courses.myCourses}
            </Link>
          </>
        ) : (
          <>
            <Clock size={34} className="mx-auto text-text-muted-light" strokeWidth={1.5} />
            <p className="mt-3 text-[14px] text-text-secondary-light">{dict.checkout.note}</p>
            <Link
              href={`/checkout/pack/${orderId}`}
              className="mt-5 inline-block rounded-full border border-primary px-5 py-2.5 text-[14px] font-semibold text-primary"
            >
              {dict.checkout.checkStatus}
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
