"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CollapsibleModule({
  title,
  countLabel,
  defaultOpen,
  children,
}: {
  title: string;
  countLabel: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border-dark">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-[12.5px] font-semibold text-text-muted-dark transition-colors hover:text-text-primary-dark"
      >
        <span className="truncate">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="num text-[11px] font-normal text-text-muted-dark">{countLabel}</span>
          <ChevronDown size={14} className={cn("transition-transform duration-200", open && "rotate-180")} />
        </span>
      </button>
      <div className={cn("overflow-hidden transition-[max-height] duration-300 ease-in-out", open ? "max-h-[2000px]" : "max-h-0")}>
        <div className="flex flex-col gap-0.5 px-4 pb-3">{children}</div>
      </div>
    </div>
  );
}
