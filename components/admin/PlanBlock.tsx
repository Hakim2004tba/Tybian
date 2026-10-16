"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { describeDuration } from "@/lib/plans/duration";

/** The lengths that get a button. Anything else is typed in. */
const PRESETS = [30, 60, 90, 180, 365] as const;

/**
 * One sellable plan: a price, and either a number of days or "forever".
 *
 * Shared by courses and packs. They are the same decision — how much,
 * for how long — and when this lived only in the course form the packs
 * side grew a different, weaker version of it: one price, one duration,
 * no choice for the student.
 *
 * Neither slot is "the lifetime one". Lifetime is a checkbox on either,
 * not a fixed second option; the database column is called `lifetime`
 * because it is a slot name, not a promise.
 */
export function PlanBlock({
  title,
  priceName,
  daysName,
  lifetimeName,
  defaultPrice,
  defaultDays,
}: {
  title: string;
  priceName: string;
  daysName: string;
  lifetimeName: string;
  defaultPrice: number | null;
  defaultDays: number | null;
}) {
  const [lifetime, setLifetime] = useState(defaultDays === null);
  const [days, setDays] = useState<number>(defaultDays ?? 90);

  return (
    <div>
      <h4 className="mb-3 text-[14px] font-semibold text-text-primary-light">{title}</h4>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id={priceName}
          name={priceName}
          type="number"
          min={0}
          step="0.01"
          label="السعر (دج)"
          defaultValue={defaultPrice ?? undefined}
          required
        />

        <div>
          <span className="block text-[13.5px] font-semibold">المدّة</span>
          <label className="mt-2.5 flex items-center gap-2 text-[13px] text-text-secondary-light">
            <input
              type="checkbox"
              name={lifetimeName}
              checked={lifetime}
              onChange={(e) => setLifetime(e.target.checked)}
            />
            مدى الحياة (بلا انتهاء)
          </label>
        </div>
      </div>

      {!lifetime && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDays(preset)}
                className={
                  "rounded-full border px-3 py-1.5 text-[12.5px] transition " +
                  (days === preset
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border-light text-text-secondary-light hover:border-primary/40")
                }
              >
                {describeDuration(preset, "ar")}
              </button>
            ))}

            <input
              name={daysName}
              type="number"
              min={1}
              max={3650}
              required
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-24 rounded-sm border border-border-light bg-surface-light px-3 py-1.5 text-[13.5px] outline-none focus:border-primary"
            />
            <span className="text-[12.5px] text-text-muted-light">يوماً</span>
          </div>
        </div>
      )}

      <p className="mt-2 text-[12.5px] text-primary">
        سيظهر للطالب:{" "}
        <span className="font-semibold">
          {describeDuration(lifetime ? null : days || 1, "ar")}
        </span>
      </p>
    </div>
  );
}
