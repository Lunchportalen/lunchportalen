/**
 * Menneskelesbare innkjøpsforslag — ingen auto-bestilling.
 */

import type { ProcurementLine } from "@/lib/ai/procurementEngine";

export type PurchasePlannerOutput = {
  /** Korte linjer egnet for kjøkken / innkjøp. */
  summaryLines: string[];
  transparencyNote: string;
};

function fmtKg(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
}

export function buildPurchaseSuggestions(lines: ProcurementLine[]): PurchasePlannerOutput {
  if (lines.length === 0) {
    return {
      summaryLines: ["Ingen innkjøpsforslag — mangler porsjonsfordeling eller data."],
      transparencyNote: "Basert på historiske bestillinger og statisk meny→ingrediens-mapping.",
    };
  }

  const summaryLines = lines.map(
    (l) =>
      `Kjøp ${fmtKg(l.totalWithBuffer)} kg ${l.ingredient} (nett ${fmtKg(l.requiredAmount)} kg + buffer ${fmtKg(l.safetyBuffer)} kg).`,
  );

  const joined = summaryLines.length
    ? `Forslag: ${summaryLines.map((s) => s.replace(/^Kjøp /, "").replace(/\.$/, "")).join(", ")}.`
    : "";

  return {
    summaryLines: joined ? [joined, ...summaryLines.slice(0, 8)] : summaryLines,
    transparencyNote: "Basert på historiske bestillinger og statisk meny→ingrediens-mapping.",
  };
}
