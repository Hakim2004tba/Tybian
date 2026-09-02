"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { checkPaymentStatusAction, type CheckStatusState } from "@/lib/actions/checkout-actions";
import { Button } from "@/components/ui/Button";

export function CheckStatusForm({ orderId }: { orderId: string }) {
  const boundAction = checkPaymentStatusAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState<CheckStatusState, FormData>(boundAction, {
    error: null,
  });

  return (
    <form action={formAction} className="mt-3">
      {state.error && (
        <p className="mb-2 text-[12.5px] text-text-muted-light">{state.error}</p>
      )}
      {state.enrolled && (
        <p className="mb-2 text-[12.5px] text-success">تم تفعيل الاشتراك بنجاح 🎉</p>
      )}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        <RefreshCw size={13} />
        {pending ? "جارٍ التحقق..." : "تحقق من حالة الدفع"}
      </Button>
    </form>
  );
}
