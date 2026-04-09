import type { LeadSegment } from "@/lib/sales/pipeline";

export type FollowUpDraft = {
  subject: string;
  message: string;
};

/**
 * Deterministic follow-up copy (no LLM — safe for enterprise tone).
 */
export function generateFollowUp(lead: { segment?: LeadSegment; company?: string | null }): FollowUpDraft {
  const seg = lead.segment ?? "smb";
  const company = typeof lead.company === "string" && lead.company.trim() ? lead.company.trim() : "deres organisasjon";

  const tier =
    seg === "enterprise"
      ? "Vi bygger styringslag for store volum og flere lokasjoner."
      : seg === "mid_market"
        ? "Vi kobler drift, bestilling og innsikt i ett rolig grensesnitt."
        : "Vi reduserer administrasjon og gir forutsigbare lunsjkostnader.";

  return {
    subject: "Lunchportalen — rolig kontroll på lunsj og kost",
    message: `Hei — ${tier} Dette passer godt for ${company}. Skal vi ta en kort gjennomgang?`,
  };
}

function safeAgeDays(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/**
 * Enkel, deterministisk «trenger oppfølging»-sjekk (pipeline-trinn + alder).
 */
export function needsFollowUp(deal: { age_days?: unknown; stage?: unknown }): boolean {
  const age = safeAgeDays(deal.age_days ?? 0);
  const stage = typeof deal.stage === "string" && deal.stage.length > 0 ? deal.stage : "lead";

  if (stage === "proposal" && age > 3) return true;
  if (stage === "negotiation" && age > 2) return true;

  return false;
}

