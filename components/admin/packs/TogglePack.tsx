"use client";

import { useTransition } from "react";
import { Power } from "lucide-react";
import { togglePackAction } from "@/lib/admin/actions/packs";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function TogglePack({ packId, isActive }: { packId: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  const { t } = useI18n();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void togglePackAction(packId))}
      className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary disabled:opacity-50"
    >
      <Power size={13} />
      {isActive ? t.admin.packs.disable : t.admin.packs.enable}
    </button>
  );
}
