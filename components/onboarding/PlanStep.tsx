"use client";

import type { PlanKey } from "@/lib/onboarding/types";
import { PLAN_PRICES_EX_VAT } from "@/lib/onboarding/types";

type Props = {
  selected: PlanKey | null;
  onSelect: (plan: PlanKey) => void;
  error?: string | null;
  /** Når satt (fra CMS productPlan), overstyrer statiske priser */
  cmsPrices?: { basis: number; luxus: number } | null;
};

export default function PlanStep({ selected, onSelect, error, cmsPrices }: Props) {
  const basisPrice = cmsPrices?.basis ?? PLAN_PRICES_EX_VAT.basis;
  const luxusPrice = cmsPrices?.luxus ?? PLAN_PRICES_EX_VAT.luxus;

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] px-4 py-3 text-sm text-[rgb(var(--lp-muted))]">
        Ansatte velger ikke måltid. Avtalen du setter her styrer hva som gjelder for leveringsdagene.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("basis")}
          className={[
            "rounded-2xl border p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 min-h-[44px]",
            selected === "basis"
              ? "border-[rgb(var(--lp-ring))] bg-white shadow-[0_0_0_1px_rgb(var(--lp-ring))]"
              : "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] hover:bg-white",
          ].join(" ")}
        >
          <div className="text-lg font-semibold text-[rgb(var(--lp-fg))]">Basis</div>
          <div className="mt-1 text-2xl font-semibold text-[rgb(var(--lp-fg))]">
            {basisPrice} kr <span className="text-sm font-normal text-[rgb(var(--lp-muted))]">eks. mva</span>
          </div>
          <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Én meny for hele uken — samme rett alle leveringsdager.</p>
          <ul className="mt-3 list-inside list-disc text-sm text-[rgb(var(--lp-muted))]">
            <li>Kun én måltype</li>
            <li>Ingen daglig variasjon</li>
          </ul>
        </button>

        <button
          type="button"
          onClick={() => onSelect("luxus")}
          className={[
            "rounded-2xl border p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 min-h-[44px]",
            selected === "luxus"
              ? "border-[rgb(var(--lp-ring))] bg-white shadow-[0_0_0_1px_rgb(var(--lp-ring))]"
              : "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] hover:bg-white",
          ].join(" ")}
        >
          <div className="text-lg font-semibold text-[rgb(var(--lp-fg))]">Luxus</div>
          <div className="mt-1 text-2xl font-semibold text-[rgb(var(--lp-fg))]">
            {luxusPrice} kr <span className="text-sm font-normal text-[rgb(var(--lp-muted))]">eks. mva</span>
          </div>
          <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Ulike måltider per leveringsdag — innenfor godkjente menyer.</p>
          <ul className="mt-3 list-inside list-disc text-sm text-[rgb(var(--lp-muted))]">
            <li>Meny per dag (alle dager må fylles ut)</li>
            <li>Variasjon tillatt</li>
          </ul>
        </button>
      </div>
    </div>
  );
}
