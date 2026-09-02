"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function LessonTabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-border-dark">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "relative shrink-0 px-4 py-3 text-[14px] font-medium transition-colors",
              active === tab.id ? "text-primary" : "text-text-muted-dark hover:text-text-primary-dark"
            )}
          >
            {tab.label}
            {active === tab.id && (
              <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {tabs.map((tab) => (
          <div key={tab.id} className={active === tab.id ? "block" : "hidden"}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
