"use client";

import { useTransition } from "react";
import { Power } from "lucide-react";
import { toggleCouponAction } from "@/lib/admin/actions/promo";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function ToggleCoupon({ couponId, isActive }: { couponId: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  const { t } = useI18n();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void toggleCouponAction(couponId))}
      className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary disabled:opacity-50"
    >
      <Power size={13} />
      {isActive ? t.admin.promo.disable : t.admin.promo.enable}
    </button>
  );
}
