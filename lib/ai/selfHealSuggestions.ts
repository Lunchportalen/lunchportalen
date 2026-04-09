/**
 * Selvhelbredelse — kun forslag. Ingen auto-utførelse uten eksplisitt menneskelig godkjenning.
 */

import type { AnomalyAlert } from "@/lib/ai/anomalyEngine";

export type RemediationSuggestion = {
  id: string;
  category: "supplier" | "production" | "delivery";
  summary: string;
  requiresApproval: true;
  reversible: true;
};

export function suggestRemediations(anomalies: AnomalyAlert[]): RemediationSuggestion[] {
  const out: RemediationSuggestion[] = [];
  let n = 0;
  const handledCodes = new Set<string>();

  const add = (category: RemediationSuggestion["category"], summary: string, codeKey: string) => {
    if (handledCodes.has(codeKey)) return;
    handledCodes.add(codeKey);
    n += 1;
    out.push({
      id: `rem-${String(n).padStart(3, "0")}`,
      category,
      summary,
      requiresApproval: true,
      reversible: true,
    });
  };

  for (const a of anomalies) {
    if (a.code === "ORDER_DROP")
      add("production", "Vurder å redusere produksjonsvolum og innkjøp neste dag — bekreft mot faktisk belegg.", "ORDER_DROP");
    if (a.code === "WASTE_PATTERN")
      add("production", "Stram porsjonsplan og kommuniser cut-off — ingen automatisk endring av meny.", "WASTE_PATTERN");
    if (a.code === "CITY_OVERCAP")
      add("delivery", "Omfordel volum til annet kjøkken eller utvid vindu — krever operativt vedtak.", "CITY_OVERCAP");
    if (a.code === "DELIVERY_FRICTION")
      add("delivery", "Gjennomgå rute og kontaktpunkter; vurder tidligere ankomst (manuelt).", "DELIVERY_FRICTION");
    if (a.code === "FORECAST_DRIFT")
      add(
        "supplier",
        "Øk sikkerhetslager på toppringredienser etter godkjenning — sammenlign leverandører før bestilling.",
        "FORECAST_DRIFT",
      );
  }

  if (out.length === 0) {
    add("production", "Ingen anomalier trigget — vedlikehold observasjon og ukentlig kalibrering.", "NONE");
  }

  return out.slice(0, 10);
}
