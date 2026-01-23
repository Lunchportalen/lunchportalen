"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateNO } from "@/lib/date/format-no";

type Dish = {
  _id: string;
  title: string;
  description?: string | null;
  allergens?: string[] | null;
  tags?: string[] | null;
};

type WeekDay = {
  date: string; // ISO
  level: "BASIS" | "LUXUS";
  dishes: Dish[];
};

type WeekPlan = {
  _id: string;
  weekStart: string; // ISO
  publishedAt?: string | null;
  lockedAt?: string | null;
  days: WeekDay[];
};

function dayNameNO(isoDate: string) {
  // isoDate = YYYY-MM-DD
  const d = new Date(isoDate + "T00:00:00");
  const weekday = new Intl.DateTimeFormat("nb-NO", { weekday: "long" }).format(d);
  // Kapitaliser første bokstav
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

export default function WeekMenuReadOnly() {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/weekplan/next", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;

        if (!res.ok || !json?.ok) {
          setError(json?.message ?? "Kunne ikke hente ukeplan.");
          setPlan(null);
          return;
        }

        setPlan(json.plan ?? null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Ukjent feil ved henting av ukeplan.");
        setPlan(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const days = useMemo(() => {
    if (!plan?.days?.length) return [];
    // Sorter trygt på dato (ISO sorterer leksikografisk riktig)
    return [...plan.days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [plan]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
        Laster ukeplan…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-red-200">
        <div className="font-medium">Det oppstod en feil</div>
        <div className="text-sm opacity-80">{error}</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
        Ingen publisert ukeplan tilgjengelig ennå.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm opacity-70">Ukeplan</div>
            <div className="text-lg font-semibold">Uke fra {formatDateNO(plan.weekStart)}</div>
          </div>
          <div className="text-xs opacity-70">
            {plan.lockedAt ? "Låst" : "Åpen"}
          </div>
        </div>
      </div>

      {days.map((d) => (
        <div
          key={d.date}
          className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">
              {dayNameNO(d.date)} {formatDateNO(d.date)}
            </div>
            <div
              className={[
                "inline-flex items-center rounded-full px-3 py-1 text-xs ring-1",
                d.level === "LUXUS"
                  ? "bg-black text-white ring-black"
                  : "bg-white/60 ring-[rgb(var(--lp-border))]",
              ].join(" ")}
            >
              {d.level === "LUXUS" ? "Luxus" : "Basis"}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {d.dishes.map((dish) => (
              <div key={dish._id} className="rounded-xl bg-white/60 p-3 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="font-medium">{dish.title}</div>
                {dish.description ? (
                  <div className="text-sm opacity-80">{dish.description}</div>
                ) : null}

                {(dish.allergens?.length ?? 0) > 0 ? (
                  <div className="mt-2 text-xs opacity-70">
                    Allergener: {dish.allergens!.join(", ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
