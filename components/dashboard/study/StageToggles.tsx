"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleStudyStageAction } from "@/lib/actions/study-progress";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/study/tracking";
import { cn } from "@/lib/utils";

/**
 * The seven marks a student keeps per lesson — three couches, three QCM
 * attempts, one revision — laid out as the columns of the paper grid
 * this replaces.
 *
 * Students write here and nowhere else: there is no control to rename,
 * reorder or remove a lesson, and no RLS policy would allow it anyway
 * (migration 0035).
 *
 * useOptimistic flips a box immediately. A seven-box row that waits for
 * a server round-trip per click feels broken, and the value reverts on
 * its own if the write fails.
 */
export function StageToggles({
  itemId,
  progress,
  revalidatePath,
}: {
  itemId: string;
  progress: Record<Stage, boolean>;
  revalidatePath?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    progress,
    (state, update: { stage: Stage; value: boolean }) => ({ ...state, [update.stage]: update.value })
  );
  const [, startTransition] = useTransition();

  return (
    <>
      {STAGES.map((stage) => {
        const on = optimistic[stage];
        return (
          <td key={stage} className="border-s border-academy-lavender px-1 py-2 text-center align-middle">
            <button
              type="button"
              title={STAGE_LABELS[stage]}
              aria-label={STAGE_LABELS[stage]}
              aria-pressed={on}
              onClick={() =>
                startTransition(async () => {
                  setOptimistic({ stage, value: !on });
                  await toggleStudyStageAction(itemId, stage, !on, revalidatePath);
                })
              }
              className={cn(
                "mx-auto flex h-6 w-6 items-center justify-center rounded-[6px] border transition-colors",
                on
                  ? "border-primary bg-primary text-white"
                  : "border-academy-lavender-deep bg-white text-transparent hover:border-primary"
              )}
            >
              <Check size={13} strokeWidth={3} />
            </button>
          </td>
        );
      })}
    </>
  );
}
