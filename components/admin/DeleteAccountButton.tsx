"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteUserAccountAction } from "@/lib/admin/actions/users";
import { Button } from "@/components/ui/Button";

/**
 * Deleting a user account from the admin panel.
 *
 * Three confirmations, because the two levels are genuinely different
 * decisions and the second one is irreversible:
 *   1. do you want to delete this account at all
 *   2. here is how many active enrolments it holds — still yes?
 *   3. soft delete (revoke access, keep the record) or permanent
 *      removal (cascades every row they own)
 *
 * The default is the soft path: OK keeps the record, Cancel escalates
 * to permanent — so a hurried click lands on the recoverable outcome.
 */
export function DeleteAccountButton({
  userId,
  userName,
  redirectTo = "/admin/students",
}: {
  userId: string;
  userName: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm(`حذف حساب "${userName}"؟`)) return;

    startTransition(async () => {
      const first = await deleteUserAccountAction(userId);

      if (first?.error) {
        window.alert(first.error);
        return;
      }

      if (first?.requiresConfirmation) {
        const n = first.activeEnrollments;
        const proceed = window.confirm(
          n > 0
            ? `هذا الحساب يملك ${n} ${n === 1 ? "تسجيلاً فعّالاً" : "تسجيلات فعّالة"}.\\n\\n` +
                "المتابعة ستُلغي وصوله إلى كل دوراته. هل تريد المتابعة؟"
            : "سيُحذف الحساب ويفقد صاحبه الوصول. هل تريد المتابعة؟"
        );
        if (!proceed) return;

        const hard = !window.confirm(
          "اختر نوع الحذف:\\n\\n" +
            "«موافق» = حذف قابل للتراجع — يُلغى الوصول ويبقى السجل (يُنصح به).\\n" +
            "«إلغاء» = حذف نهائي — يُمحى الحساب وكل بياناته ولا يمكن استرجاعه."
        );

        if (hard) {
          const sure = window.confirm(
            `تأكيد أخير: سيُحذف حساب "${userName}" وكل بياناته نهائياً.\\n\\nهذا الإجراء لا يمكن التراجع عنه.`
          );
          if (!sure) return;
        }

        const result = await deleteUserAccountAction(userId, { force: true, hardDelete: hard });
        if (result?.error) {
          window.alert(result.error);
          return;
        }
      }

      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={run} className="border-error/40 text-error">
      <Trash2 size={15} />
      {pending ? "جارٍ الحذف..." : "حذف الحساب"}
    </Button>
  );
}
