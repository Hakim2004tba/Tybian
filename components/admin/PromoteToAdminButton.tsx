"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { promoteToAdminAction } from "@/lib/admin/actions/users";

/**
 * Reusable across every "manage a person" surface (student list, student
 * detail, teacher list) — one action, one confirmation flow, so a
 * platform-wide "make anyone admin" capability doesn't get
 * reimplemented three slightly-different ways.
 */
export function PromoteToAdminButton({
  userId,
  userName,
  redirectOnSuccessTo,
}: {
  userId: string;
  userName: string;
  /** If provided, navigates here after a successful promotion instead of
   *  refreshing in place — needed on pages (like a student's own detail
   *  page) whose data query would stop matching once the role changes,
   *  which would otherwise 404 on refresh. */
  redirectOnSuccessTo?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (
      !window.confirm(
        `تحويل "${userName}" إلى مشرف (Admin)؟ سيحصل على وصول كامل لكل بيانات المنصة وإدارتها. هذا إجراء حساس.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await promoteToAdminAction(userId);
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      if (redirectOnSuccessTo) router.push(redirectOnSuccessTo);
      else router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[12px] font-medium text-text-muted-light transition-colors hover:bg-gold/15 hover:text-gold disabled:opacity-50"
      title="ترقية إلى مشرف"
    >
      <ShieldCheck size={13} />
      ترقية لمشرف
    </button>
  );
}
