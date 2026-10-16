"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreatePackOrder } from "@/lib/actions/pack-checkout";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { describeDuration } from "@/lib/plans/duration";
import type { PackPlan } from "@/lib/data/packs";

/**
 * Creates the pack order, then hands off to the shared payment screen.
 *
 * The order is made on the server and only its id travels back — the
 * amount is never carried through the browser, so a tampered response
 * cannot become a cheaper payment. The plan travels as a SLOT NAME for
 * the same reason: the server looks up what that slot costs.
 *
 * With one plan there is nothing to choose and it is a single button,
 * as before. With two, the student picks the length first — which is
 * the whole point of packs having durations at all.
 */
export function BuyPackButton({
  packId,
  plans = [],
  currency,
}: {
  packId: string;
  plans?: PackPlan[];
  currency: string;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<PackPlan["planType"]>(
    plans[0]?.planType ?? "lifetime"
  );
  const [promo, setPromo] = useState("");

  const money = new Intl.NumberFormat("en-US");

  async function buy() {
    setPending(true);
    setError(null);
    const result = await getOrCreatePackOrder(packId, chosen, promo || undefined);
    setPending(false);

    if (result.kind === "order") router.push(`/checkout/pack/${result.orderId}`);
    else if (result.kind === "already_owned") setError(t.packs.ownAll);
    else setError(result.message);
  }

  return (
    <div>
      {plans.length > 1 && (
        <div className="mb-3 flex flex-col gap-2">
          {plans.map((plan) => {
            const active = plan.planType === chosen;
            return (
              <button
                key={plan.planType}
                type="button"
                onClick={() => setChosen(plan.planType)}
                aria-pressed={active}
                className={
                  "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-start transition " +
                  (active
                    ? "border-primary bg-primary/[0.07] shadow-[0_0_0_3px_rgba(108,76,241,0.10)]"
                    : "border-border-light hover:border-primary/40")
                }
              >
                <span className={"text-[13.5px] " + (active ? "font-semibold text-primary" : "text-text-secondary-light")}>
                  {describeDuration(plan.durationDays, locale)}
                </span>
                <span className="num text-[13.5px] font-bold text-text-primary-light">
                  {money.format(plan.price)}{" "}
                  <span className="text-[11.5px] font-normal text-text-muted-light">{currency}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* The code is optional and stays out of the way — a prominent
          empty discount box makes every buyer feel they are missing
          one. */}
      <input
        value={promo}
        onChange={(e) => setPromo(e.target.value)}
        placeholder={t.checkout.promoPlaceholder}
        className="mb-2 w-full rounded-xl border border-border-light bg-surface-light px-3 py-2 text-[13px] uppercase outline-none focus:border-primary"
      />

      <button
        type="button"
        onClick={() => void buy()}
        disabled={pending}
        className="w-full rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {t.packs.buy}
      </button>
      {error && <p className="mt-2 text-[12.5px] text-error">{error}</p>}
    </div>
  );
}
