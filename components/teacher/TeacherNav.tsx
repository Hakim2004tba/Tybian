"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { teacherNav } from "@/config/teacher-navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export function TeacherNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border-light pb-px">
      {teacherNav.map((item) => {
        /*
          Exact match for the root, prefix for the rest — otherwise
          "/teacher" would light up on every page under it.
        */
        const active =
          item.href === "/teacher" ? pathname === "/teacher" : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex shrink-0 items-center gap-2 px-3.5 py-3 text-[13.5px] font-medium transition-colors",
              active ? "text-primary" : "text-text-muted-light hover:text-text-primary-light"
            )}
          >
            <Icon size={15} strokeWidth={1.75} />
            {t.teacher.nav[item.key]}
            {active && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}
