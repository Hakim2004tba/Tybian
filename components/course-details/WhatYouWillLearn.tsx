import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function WhatYouWillLearn({ outcomes }: { outcomes: string[] }) {
  if (!outcomes.length) return null;

  return (
    <Card>
      <h3 className="mb-4 text-[17px]">ما ستتعلمه</h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {outcomes.map((outcome) => (
          <li key={outcome} className="flex items-start gap-2.5 text-[14px] text-text-secondary-light">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" />
            {outcome}
          </li>
        ))}
      </ul>
    </Card>
  );
}
