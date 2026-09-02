"use client";

import { useActionState } from "react";
import { CreditCard, AlertCircle } from "lucide-react";
import { payNowAction, type PayNowState } from "@/lib/actions/checkout-actions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function PayNowForm({ orderId, courseSlug }: { orderId: string; courseSlug: string }) {
  const boundAction = payNowAction.bind(null, orderId, courseSlug);
  const [state, formAction, pending] = useActionState<PayNowState, FormData>(boundAction, {
    error: null,
  });

  if (state.notConfigured) {
    return (
      <div className="rounded-md border border-dashed border-border-light p-4 text-center">
        <AlertCircle size={20} className="mx-auto text-text-muted-light" />
        <Badge variant="violet" className="mx-auto mt-2 w-fit">
          الدفع الإلكتروني قيد الإنشاء
        </Badge>
        <p className="mt-2 text-[13px] text-text-muted-light">
          طلبك محفوظ بنجاح. تكامل الدفع سيُفعَّل قريباً.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.error && (
        <div className="mb-3 rounded-sm border border-error/30 bg-error/10 px-3 py-2 text-[13px] text-error">
          {state.error}
        </div>
      )}
      <Button type="submit" variant="gold" className="w-full justify-center" disabled={pending}>
        <CreditCard size={16} />
        {pending ? "جارٍ التحويل..." : "الدفع الآن"}
      </Button>
    </form>
  );
}
