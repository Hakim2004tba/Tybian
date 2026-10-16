"use client";

import { useState } from "react";
import { Menu, Search, Bell } from "lucide-react";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export function AdminTopbar({
  name,
  email,
}: {
  name: string;
  email: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = name.trim().slice(0, 2) || "أد";

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border-light bg-surface-light px-md py-[18px] lg:px-xl">
        <button
          aria-label="فتح قائمة الإدارة"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-text-primary-light lg:hidden"
        >
          <Menu size={22} />
        </button>

        <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-md border border-border-light bg-bg-light px-3.5 py-2.5 text-[14px] text-text-muted-light lg:flex">
          <Search size={16} />
          بحث سريع عن طالب، دورة، أو طلب...
        </div>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />

          <button
            aria-label="الإشعارات"
            className="hidden h-9 w-9 items-center justify-center rounded-md text-text-secondary-light transition-colors hover:bg-primary/10 hover:text-primary lg:flex"
          >
            <Bell size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-hover text-[12.5px] font-semibold text-[#241705]">
              {initials}
            </div>
            <div className="hidden sm:block">
              <div className="text-[14px] font-semibold">{name}</div>
              <div className="text-[12px] text-text-muted-light">{email ?? "Admin"}</div>
            </div>
          </div>
        </div>
      </div>

      <AdminMobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
