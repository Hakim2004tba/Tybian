"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSubjectAction } from "@/lib/admin/actions/qcm-import";

/** Open to students, or back to "coming soon". */
export function SubjectToggle({ subjectId, isActive }: { subjectId: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await toggleSubjectAction(subjectId);
          router.refresh();
        })
      }
      className={
        "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 " +
        (isActive
          ? "bg-success/10 text-success hover:bg-success/20"
          : "bg-gold/15 text-[#8A5A18] hover:bg-gold/25")
      }
    >
      {isActive ? "مفتوحة للطلبة" : "قريباً"}
    </button>
  );
}
