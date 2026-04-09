"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import KitchenProductionPanel from "./KitchenProductionPanel";
import KitchenView from "./KitchenView";
import { osloTodayISODate } from "@/lib/date/oslo";

type Tab = "production" | "aggregate";

const tabBtn =
  "min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--lp-accent))]";

function KitchenRuntimeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") === "aggregate" ? "aggregate" : "production") as Tab;

  const [dateISO, setDateISO] = useState(() => osloTodayISODate());

  const setTab = useCallback(
    (next: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "production") params.delete("tab");
      else params.set("tab", "aggregate");
      const q = params.toString();
      router.replace(q ? `/kitchen?${q}` : "/kitchen", { scroll: false });
    },
    [router, searchParams],
  );

  const tabLabel = useMemo(
    () => ({
      production: "Produksjonsliste",
      aggregate: "Aggregert rapport",
    }),
    [],
  );

  return (
    <div className="w-full space-y-6">
      <nav aria-label="Kjøkkenvisning" className="flex flex-wrap justify-center gap-2 print:hidden md:justify-start">
        <button
          type="button"
          onClick={() => setTab("production")}
          className={`${tabBtn} ${
            tab === "production"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-[rgb(var(--lp-border))] bg-white text-slate-900 hover:border-[rgb(var(--lp-accent))]"
          }`}
        >
          {tabLabel.production}
        </button>
        <button
          type="button"
          onClick={() => setTab("aggregate")}
          className={`${tabBtn} ${
            tab === "aggregate"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-[rgb(var(--lp-border))] bg-white text-slate-900 hover:border-[rgb(var(--lp-accent))]"
          }`}
        >
          {tabLabel.aggregate}
        </button>
      </nav>

      {tab === "production" ? (
        <KitchenProductionPanel dateISO={dateISO} onDateISOChange={setDateISO} />
      ) : (
        <KitchenView syncDateISO={dateISO} onSyncDateISOChange={setDateISO} />
      )}
    </div>
  );
}

export default function KitchenRuntimeClient() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-6 text-center text-sm text-slate-600 shadow-[var(--lp-shadow-soft)]">
          Laster kjøkken…
        </div>
      }
    >
      <KitchenRuntimeInner />
    </Suspense>
  );
}
