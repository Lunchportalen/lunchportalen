"use client";

import type { WeekdayKey } from "@/lib/onboarding/types";
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "@/lib/onboarding/types";

type Props = {
  selected: WeekdayKey[];
  onChange: (days: WeekdayKey[]) => void;
  error?: string | null;
};

function toggleDay(current: WeekdayKey[], day: WeekdayKey): WeekdayKey[] {
  const set = new Set(current);
  if (set.has(day)) set.delete(day);
  else set.add(day);
  return WEEKDAY_ORDER.filter((d) => set.has(d));
}

export default function DaysStep({ selected, onChange, error }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--lp-muted))]">Velg minst én dag (maks fem). Kun mandag–fredag.</p>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_ORDER.map((day) => {
          const on = selected.includes(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onChange(toggleDay(selected, day))}
              className={[
                "min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                on
                  ? "border-[rgb(var(--lp-ring))] bg-white text-[rgb(var(--lp-fg))] shadow-[0_0_0_1px_rgb(var(--lp-ring))]"
                  : "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] text-[rgb(var(--lp-muted))] hover:bg-white",
              ].join(" ")}
            >
              {WEEKDAY_LABELS[day]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
