import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getDictionary } from "@/lib/i18n/locale";

export async function WhatYouWillLearn({ outcomes }: { outcomes: string[] }) {
  const { dict } = await getDictionary();
  const t = dict.courseDetails;
  if (!outcomes.length) return null;

  return (
    <Card>
      <h3 className="mb-4 text-[17px]">{t.whatYouLearn}</h3>
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
