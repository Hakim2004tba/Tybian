"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNav } from "@/config/admin-navigation";
import { Logo } from "@/components/layout/Logo";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

/**
 * Same visual language as the rest of the app: dark sidebar (bg-bg-dark),
 * violet active-state pill with inner accent bar, docked on the right
 * edge for RTL — no new colors, radii, or shadows introduced here.
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[272px] flex-none flex-col gap-xl border-s border-border-dark bg-bg-dark px-md py-lg text-text-secondary-dark lg:flex">
      <div className="px-2">
        <Logo tone="dark" />
        <Badge variant="gold" className="mt-3">
          لوحة الإدارة
        </Badge>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {adminNav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3.5 py-[11px] text-[14.5px] transition-colors",
                active
                  ? "bg-primary/[0.14] font-medium text-white"
                  : "text-text-secondary-dark hover:bg-primary/[0.08] hover:text-text-primary-dark"
              )}
            >
              {active && (
                <span className="absolute inset-y-2 end-0 w-[3px] rounded-full bg-primary" />
              )}
              <Icon size={18} strokeWidth={1.6} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
