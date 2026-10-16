"use client";

import { savePackWeightsAction } from "@/lib/admin/actions/packs";
import { AuthForm } from "@/components/auth/AuthForm";
import { SubmitButton } from "@/components/auth/SubmitButton";

/**
 * What each course in this pack is worth, relative to the others.
 *
 * The share each one would get is shown live, because a weight on its
 * own means nothing — "3" is only meaningful next to the others, and
 * the number the admin actually cares about is the percentage.
 */
export function PackWeightsForm({
  packId,
  items,
}: {
  packId: string;
  items: { courseId: string; title: string; weight: number | null; price: number }[];
}) {
  const action = savePackWeightsAction.bind(null, packId);

  /* Falls back to the price exactly as the split does, so the preview
     matches what would actually be paid out. */
  const effective = items.map((i) => (i.weight ?? i.price) || 0);
  const total = effective.reduce((a, b) => a + b, 0);

  return (
    <AuthForm action={action}>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={item.courseId} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="courseId" value={item.courseId} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary-light">
              {item.title}
            </span>
            <input
              name="weight"
              type="number"
              min={0}
              max={9999}
              step="0.5"
              defaultValue={item.weight ?? ""}
              placeholder={String(item.price)}
              className="num w-20 rounded-lg border border-border-light bg-surface-light px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
            />
            <span className="num w-12 shrink-0 text-end text-[12px] text-text-muted-light">
              {total > 0 ? Math.round((effective[i] / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted-light">
        اتركه فارغاً ليُحسب من سعر الدورة. النسبة على اليسار هي حصّة الدورة من دخل
        هذه الباقة.
      </p>

      <SubmitButton variant="gold" className="mt-3 w-fit">حفظ الأوزان</SubmitButton>
    </AuthForm>
  );
}
