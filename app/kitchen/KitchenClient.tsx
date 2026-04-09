// STATUS: KEEP — legacy entry; kanonisk kjøkkenflate er /kitchen (KitchenRuntimeClient).

"use client";

import React, { useMemo, useState } from "react";

import KitchenProductionPanel from "./KitchenProductionPanel";
import { osloTodayISODate } from "@/lib/date/oslo";

/**
 * Eldre fullbreddet kjøkkenvisning uten PageSection.
 * Beholdes for eventuelle interne lenker; ikke dupliser i nye flater.
 */
export default function KitchenClient() {
  const todayISO = useMemo(() => osloTodayISODate(), []);
  const [dateISO, setDateISO] = useState(todayISO);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="text-3xl font-semibold text-slate-900">Kjøkken – dagens bestillinger</h1>
      <div className="mt-6">
        <KitchenProductionPanel dateISO={dateISO} onDateISOChange={setDateISO} />
      </div>
    </main>
  );
}
