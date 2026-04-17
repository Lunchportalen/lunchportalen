"use client";

// STATUS: KEEP — henter neste uke via GET /api/week (menuContent), ikke Sanity weekPlan.

import { useEffect, useMemo, useState } from "react";
import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";
import { unwrapJsonOkData } from "@/lib/http/unwrapClientJson";

type DayRow = {
  date: string;
  weekday: string;
  tier: "BASIS" | "LUXUS";
  title: string | null;
  description: string | null;
  allergens: string[];
  isPublished: boolean;
};

export default function WeekMenuReadOnly() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DayRow[]>([]);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/week?weekOffset=1", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;

        if (!res.ok || json?.ok === false) {
          setError(json?.message ?? "Kunne ikke hente ukemeny.");
          setDays([]);
          setWeekStart(null);
          return;
        }

        const raw = unwrapJsonOkData<{
          days?: unknown[];
          range?: { from?: string };
          locked?: boolean;
        }>(json) ?? json;

        if (raw?.locked === true) {
          setError("Neste uke er ikke tilgjengelig før torsdag kl. 08:00.");
          setDays([]);
          setWeekStart(null);
          return;
        }

        const list = Array.isArray(raw?.days) ? raw.days : [];
        const mapped: DayRow[] = list.map((d: any) => ({
          date: String(d?.date ?? "").slice(0, 10),
          weekday: String(d?.weekday ?? ""),
          tier: d?.tier === "LUXUS" ? "LUXUS" : "BASIS",
          title: d?.title != null ? String(d.title).trim() : null,
          description: d?.description != null ? String(d.description) : null,
          allergens: Array.isArray(d?.allergens) ? (d.allergens as unknown[]).map((x) => String(x)) : [],
          isPublished: Boolean(d?.isPublished),
        }));

        setDays(mapped.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
        setWeekStart(raw?.range?.from ? String(raw.range.from).slice(0, 10) : mapped[0]?.date ?? null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Ukjent feil ved henting av ukemeny.");
        setDays([]);
        setWeekStart(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const sortedDays = useMemo(() => days, [days]);

  function dayNameNO(isoDate: string) {
    const weekday = formatWeekdayNO(isoDate);
    return weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : "";
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
        Laster ukemeny…
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

  if (!sortedDays.length) {
    return (
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
        Ingen menylinjer for neste uke ennå.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm opacity-70">Neste uke (menuContent)</div>
            <div className="text-lg font-semibold">Uke fra {weekStart ? formatDateNO(weekStart) : "—"}</div>
          </div>
        </div>
      </div>

      {sortedDays.map((d) => (
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
                d.tier === "LUXUS"
                  ? "bg-black text-white ring-black"
                  : "bg-white/60 ring-[rgb(var(--lp-border))]",
              ].join(" ")}
            >
              {d.tier === "LUXUS" ? "Luxus" : "Basis"}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="rounded-xl bg-white/60 p-3 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="font-medium">{d.title || "Meny"}</div>
              {d.description ? <div className="text-sm opacity-80">{d.description}</div> : null}
              {!d.isPublished ? <div className="mt-1 text-xs text-amber-800">Ikke publisert for kunder</div> : null}
              {d.allergens.length > 0 ? (
                <div className="mt-2 text-xs opacity-70">Allergener: {d.allergens.join(", ")}</div>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
