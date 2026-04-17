"use client";

import type { PlanKey, WeekdayKey } from "@/lib/onboarding/types";
import { WEEKDAY_LABELS } from "@/lib/onboarding/types";

export type OnboardingMealOption = { key: string; label: string };

type Props = {
  plan: PlanKey;
  deliveryDays: WeekdayKey[];
  basisOptions: OnboardingMealOption[];
  luxusOptions: OnboardingMealOption[];
  fixedMeal: string | null;
  onFixedMeal: (v: string) => void;
  menuPerDay: Partial<Record<WeekdayKey, string>>;
  onMenuDay: (day: WeekdayKey, mealKey: string) => void;
  error?: string | null;
};

export default function MenuStep({
  plan,
  deliveryDays,
  basisOptions,
  luxusOptions,
  fixedMeal,
  onFixedMeal,
  menuPerDay,
  onMenuDay,
  error,
}: Props) {
  if (plan === "basis") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          Denne menyen gjelder <span className="font-semibold">alle valgte leveringsdager</span>.
        </div>
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
            {error}
          </div>
        ) : null}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-[rgb(var(--lp-fg))]">Velg én meny</legend>
          <div className="space-y-2">
            {basisOptions.map((opt) => (
              <label
                key={opt.key}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] px-4 py-3 has-[:checked]:border-[rgb(var(--lp-ring))] has-[:checked]:bg-white"
              >
                <input
                  type="radio"
                  name="basis-meal"
                  value={opt.key}
                  checked={fixedMeal === opt.key}
                  onChange={() => onFixedMeal(opt.key)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-[rgb(var(--lp-fg))]">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--lp-muted))]">Hvert valgt leveringsdag må ha ett måltid. Kun godkjente typer.</p>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}
      <div className="space-y-4">
        {deliveryDays.map((day) => (
          <div key={day} className="space-y-1">
            <label htmlFor={`meal-${day}`} className="block text-sm font-medium text-[rgb(var(--lp-fg))]">
              {WEEKDAY_LABELS[day]}
            </label>
            <select
              id={`meal-${day}`}
              value={menuPerDay[day] ?? ""}
              onChange={(e) => onMenuDay(day, e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm text-[rgb(var(--lp-fg))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <option value="">Velg måltid</option>
              {luxusOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
