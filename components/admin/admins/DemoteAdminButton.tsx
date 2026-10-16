"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { demoteAdminAction } from "@/lib/admin/actions/admins";

/**
 * Removes a platform administrator.
 *
 * Shown to the owner only — but the action re-checks that on the
 * server, because a hidden button is a UI decision and not a
 * permission.
 */
export function DemoteAdminButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`إزالة صلاحية الإدارة عن ${name}؟ سيعود حساباً عاديّاً.`)) return;
        start(async () => {
          const result = await demoteAdminAction(userId);
          if (result.error) window.alert(result.error);
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border-light px-2.5 py-1.5 text-[12.5px] text-error transition hover:border-error/40 hover:bg-error/10 disabled:opacity-40"
    >
      <ShieldOff size={13} />
      إزالة
    </button>
  );
}
