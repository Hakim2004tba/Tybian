"use client";

import { useState, useActionState } from "react";
import { Pencil } from "lucide-react";
import { updateAcademicYearNamesAction, type ActionState } from "@/lib/admin/actions/listings";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function AcademicYearRow({
  year,
  courseCount,
}: {
  year: { id: string; year_number: number; name_ar: string; name_en: string | null; name_fr: string | null };
  courseCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const boundAction = updateAcademicYearNamesAction.bind(null, year.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, { error: null });

  if (editing) {
    return (
      <Card className="border-primary/30">
        <form action={formAction}>
          {state.error && <p className="mb-2 text-[12.5px] text-error">{state.error}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Input id={`ar-${year.id}`} name="name_ar" label="بالعربية" defaultValue={year.name_ar} required />
            <Input id={`en-${year.id}`} name="name_en" label="بالإنجليزية" defaultValue={year.name_en ?? ""} />
            <Input id={`fr-${year.id}`} name="name_fr" label="بالفرنسية" defaultValue={year.name_fr ?? ""} />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-white">
              حفظ
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md px-4 py-2 text-[13px] text-text-muted-light">
              إلغاء
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="num text-[13px] font-bold text-primary">{year.year_number}</span>
        <div>
          <div className="font-medium">{year.name_ar}</div>
          <div className="text-[12px] text-text-muted-light">{year.name_en} · {year.name_fr}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="muted">
          <span className="num">{courseCount}</span> دورة
        </Badge>
        <button onClick={() => setEditing(true)} className="text-text-muted-light hover:text-primary">
          <Pencil size={15} />
        </button>
      </div>
    </Card>
  );
}
