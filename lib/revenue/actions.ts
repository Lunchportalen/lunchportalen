/**
 * Forslag — ingen auto-utførelse; menneske må godkjenne i SoMe-motor.
 * Ekskluderer manuell/deterministisk innhold fra «scale/fix»-anbefalinger (trygg default).
 */
import type { RevenuePostModel } from "@/lib/revenue/model";

export type RevenueActionType = "scale_content" | "fix_content" | "observe";

export type RevenueAction = {
  type: RevenueActionType;
  postId: string;
  message: string;
  /** Forklarbar begrunnelse */
  reason: string;
};

function isEligibleForAutopilotSuggestion(p: RevenuePostModel): boolean {
  const s = p.contentSource;
  return s === "ai" || s === null;
}

export function generateRevenueActions(winners: RevenuePostModel[], losers: RevenuePostModel[]): RevenueAction[] {
  const actions: RevenueAction[] = [];

  for (const w of winners.slice(0, 3)) {
    if (!isEligibleForAutopilotSuggestion(w)) {
      actions.push({
        type: "observe",
        postId: w.postId,
        message: "Høy omsetning — innhold ikke fra AI; ingen automatisk skaleringsforslag.",
        reason: `Kilde=${w.contentSource ?? "ukjent"}`,
      });
      continue;
    }
    actions.push({
      type: "scale_content",
      postId: w.postId,
      message: "Repliser mønster fra høyytelses-innhold (manuell gjennomgang).",
      reason: `Attribuert omsetning ${w.revenue.toFixed(0)} · ${w.orders} ordre`,
    });
  }

  for (const l of losers.slice(0, 3)) {
    if (!isEligibleForAutopilotSuggestion(l)) {
      actions.push({
        type: "observe",
        postId: l.postId,
        message: "Lead uten ordre — innhold ikke fra AI; ingen automatisk justeringsforslag.",
        reason: `Kilde=${l.contentSource ?? "ukjent"}`,
      });
      continue;
    }
    actions.push({
      type: "fix_content",
      postId: l.postId,
      message: "Vurder budskap/målgruppe (manuell redigering i SoMe-verktøy).",
      reason: `${l.leads} leads, 0 ordre`,
    });
  }

  return actions;
}
