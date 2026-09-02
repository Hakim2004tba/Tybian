"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { adminNav } from "@/config/admin-navigation";
import { Logo } from "@/components/layout/Logo";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

/**
 * Mirrors MobileNav.tsx (public site) exactly in mechanics — right-edge
 * drawer, backdrop, same transition durations, and the same
 * createPortal(..., document.body) treatment — so this never falls
 * victim to the same "trapped inside a blurred/filtered ancestor"
 * containing-block bug even if AdminTopbar (which currently has no
 * backdrop-filter) ever gains one. See MobileNav.tsx for the full
 * writeup of that bug.
 */
export function AdminMobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[82%] max-w-[300px] flex-col gap-6 bg-bg-dark p-lg transition-transform duration-200 ease-out lg:hidden",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="قائمة الإدارة"
      >
        <div className="flex items-center justify-between">
          <div>
            <Logo tone="dark" />
            <Badge variant="gold" className="mt-2">
              لوحة الإدارة
            </Badge>
          </div>
          <button onClick={onClose} aria-label="إغلاق القائمة" className="text-text-secondary-dark">
            <X size={22} />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 overflow-y-auto">
          {adminNav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3.5 py-3 text-[14.5px] transition-colors",
                  active
                    ? "bg-primary/[0.14] font-medium text-white"
                    : "text-text-secondary-dark hover:bg-primary/[0.08] hover:text-text-primary-dark"
                )}
              >
                <Icon size={18} strokeWidth={1.6} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>,
    document.body
  );
}
