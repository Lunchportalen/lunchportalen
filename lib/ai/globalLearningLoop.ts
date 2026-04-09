/**
 * Læring — KUN innenfor én tenant (companyId). Ingen kryss-selskapsaggregering i denne modulen.
 */

import type { DishChoiceSignal } from "@/lib/ai/demandInsights";

export type TenantLearningSummary = {
  scope: "tenant";
  companyId: string;
  hints: string[];
  transparency: string[];
};

export function summarizeTenantLearningPatterns(opts: {
  companyId: string;
  dishSignals: DishChoiceSignal[];
  historyDepthDays: number;
}): TenantLearningSummary {
  const hints: string[] = [];
  const high = opts.dishSignals.filter((d) => d.signal === "high").slice(0, 3);
  const low = opts.dishSignals.filter((d) => d.signal === "low").slice(0, 2);

  for (const h of high) {
    hints.push(`Sterk preferanse for «${h.choiceKey}» — vurder å beholde på rotasjon (innenfor samme selskap).`);
  }
  for (const l of low) {
    hints.push(`Lav etterspørsel på «${l.choiceKey}» — vurder å variere eller markedsføre (innenfor samme selskap).`);
  }

  if (hints.length === 0) {
    hints.push("Begrenset signalhistorikk — fortsett datainnsamling før globale justeringer.");
  }

  return {
    scope: "tenant",
    companyId: opts.companyId,
    hints,
    transparency: [
      `Mønstre er begrenset til tenant ${opts.companyId} og siste ~${opts.historyDepthDays} dager med data.`,
      "Ingen deling av mønstre på tvers av selskaper i denne V1-implementasjonen (enterprise isolasjon).",
    ],
  };
}
