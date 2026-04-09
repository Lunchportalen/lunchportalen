import "server-only";

import { isAIEnabled } from "@/lib/ai/runner";
import { runAI } from "@/lib/ai/run";
import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";

function safeStr(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function buildPrompt(deal: EnrichedPipelineDeal): string {
  return `
Du er en erfaren B2B rådgiver.

Skriv en kort, profesjonell oppfølging til en potensiell kunde.

Kontekst:
- Produkt: Lunchportalen (B2B lunsjplattform)
- Fokus: kontroll, redusert matsvinn, mindre administrasjon

Deal:
- Firma: ${deal.company_name ?? "ukjent"}
- Stage: ${deal.stage}
- Neste steg: ${deal.nextAction}

Regler:
- Ingen emojis
- Kort (maks 5 linjer)
- Konkret verdi
- Ikke pushy

Returner kun tekst.
`.trim();
}

/**
 * Deterministisk fallback når AI er av eller feiler (samme tone, ingen nettverkskall).
 */
export function buildDeterministicSalesMessage(deal: EnrichedPipelineDeal): string {
  const company = safeStr(deal.company_name) || "deres bedrift";
  const next = safeStr(deal.nextAction) || "oppfølging";
  return [
    `Hei — vi tar kontakt fra Lunchportalen.`,
    ``,
    `Vi hjelper bedrifter med kontroll på lunsj, mindre administrasjon og mer forutsigbarhet. ${next} er et naturlig neste steg for ${company}.`,
    ``,
    `Ønsker du en kort samtale når det passer?`,
  ].join("\n");
}

/**
 * LLM kun for tekst — beslutninger (hvem som velges) ligger i selection.
 */
export async function generateSalesMessage(deal: EnrichedPipelineDeal): Promise<string> {
  if (!isAIEnabled()) {
    console.log("[SALES_MESSAGE]", { mode: "deterministic", reason: "ai_disabled" });
    return buildDeterministicSalesMessage(deal);
  }

  const prompt = buildPrompt(deal);
  try {
    const text = await runAI(prompt, "growth");
    const out = typeof text === "string" ? text.trim() : "";
    if (!out) return buildDeterministicSalesMessage(deal);
    return out;
  } catch (e) {
    void e;
    console.error("[SALES_MESSAGE]", { mode: "deterministic", reason: "ai_error" });
    return buildDeterministicSalesMessage(deal);
  }
}
