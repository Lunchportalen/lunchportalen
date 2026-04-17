"use client";

import type { AgreementPayload, WeekdayKey } from "@/lib/onboarding/types";
import { PLAN_PRICES_EX_VAT, WEEKDAY_LABELS } from "@/lib/onboarding/types";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

type Props = {
  payload: AgreementPayload;
  confirmed: boolean;
  onConfirmedChange: (v: boolean) => void;
  error?: string | null;
  menuTitles?: Record<string, string> | null;
  cmsPrices?: { basis: number; luxus: number } | null;
};

function mealLabel(key: string, menuTitles: Record<string, string> | null | undefined) {
  const nk = normalizeMealTypeKey(key);
  const t = nk ? menuTitles?.[nk]?.trim() : "";
  if (t) return t;
  return nk || String(key ?? "").trim();
}

export default function SummaryStep({
  payload,
  confirmed,
  onConfirmedChange,
  error,
  menuTitles,
  cmsPrices,
}: Props) {
  const price =
    payload.plan === "basis"
      ? (cmsPrices?.basis ?? PLAN_PRICES_EX_VAT.basis)
      : (cmsPrices?.luxus ?? PLAN_PRICES_EX_VAT.luxus);

  const dayLine = (d: WeekdayKey) => WEEKDAY_LABELS[d];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--lp-muted))]">Les gjennom før du bekrefter. Ansatte velger ikke måltid — dette er avtalen.</p>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] p-5 text-sm">
        <div className="grid gap-3">
          <div className="flex flex-wrap justify-between gap-2 border-b border-[rgb(var(--lp-border))] pb-3">
            <span className="text-[rgb(var(--lp-muted))]">Plan</span>
            <span className="font-semibold capitalize text-[rgb(var(--lp-fg))]">{payload.plan}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-b border-[rgb(var(--lp-border))] pb-3">
            <span className="text-[rgb(var(--lp-muted))]">Pris per kuvert</span>
            <span className="font-semibold text-[rgb(var(--lp-fg))]">{price} kr eks. mva</span>
          </div>
          <div className="border-b border-[rgb(var(--lp-border))] pb-3">
            <div className="text-[rgb(var(--lp-muted))]">Leveringsdager</div>
            <div className="mt-1 font-medium text-[rgb(var(--lp-fg))]">
              {payload.delivery_days.map(dayLine).join(", ")}
            </div>
          </div>
          <div className="border-b border-[rgb(var(--lp-border))] pb-3">
            <div className="text-[rgb(var(--lp-muted))]">Meny</div>
            {payload.plan === "basis" ? (
              <div className="mt-1 font-medium text-[rgb(var(--lp-fg))]">
                Samme meny hver dag: {mealLabel(payload.fixed_meal_type, menuTitles)}
              </div>
            ) : (
              <ul className="mt-2 space-y-1">
                {payload.delivery_days.map((d) => (
                  <li key={d} className="flex flex-wrap justify-between gap-2">
                    <span className="text-[rgb(var(--lp-muted))]">{WEEKDAY_LABELS[d]}</span>
                    <span className="font-medium text-[rgb(var(--lp-fg))]">
                      {mealLabel(payload.menu_per_day[d], menuTitles)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Lokasjoner</div>
            <ul className="mt-2 space-y-3">
              {payload.locations.map((loc, i) => (
                <li key={i} className="rounded-xl bg-white/80 p-3 ring-1 ring-[rgb(var(--lp-border))]">
                  <div className="font-semibold text-[rgb(var(--lp-fg))]">{loc.name}</div>
                  <div className="mt-1 text-[rgb(var(--lp-muted))]">{loc.address}</div>
                  {loc.instructions ? <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">{loc.instructions}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <span className="text-sm text-[rgb(var(--lp-fg))]">Jeg bekrefter at dette er korrekt avtale</span>
      </label>
    </div>
  );
}
