// STATUS: KEEP

// DUPLICATE — review

/**
 * AI GROWTH ENGINE
 * Identifiserer: vekstmuligheter, nye sider, nye kampanjer.
 * Samler discoverKeywordGaps, evolveSiteStructure, generateCampaign.
 * Kun oppdagelse/spec; ingen mutasjon eller publisering.
 */

import { discoverKeywordGaps } from "@/lib/ai/engines/capabilities/discoverKeywordGaps";
import type {
  DiscoverKeywordGapsInput,
  DiscoverKeywordGapsOutput,
  KeywordOpportunity,
} from "@/lib/ai/engines/capabilities/discoverKeywordGaps";
import { evolveSiteStructure } from "@/lib/ai/engines/capabilities/evolveSiteStructure";
import type {
  EvolveSiteStructureInput,
  EvolveSiteStructureOutput,
  StructureEvolution,
} from "@/lib/ai/engines/capabilities/evolveSiteStructure";
import { generateCampaign } from "@/lib/ai/engines/capabilities/generateCampaign";
import type {
  GenerateCampaignInput,
  GenerateCampaignOutput,
  CampaignPhase,
  CampaignKpi,
} from "@/lib/ai/engines/capabilities/generateCampaign";

export type { KeywordOpportunity, StructureEvolution, CampaignPhase, CampaignKpi };

/** Oppdager søkeord- og innholdsvekstmuligheter (keyword gaps). */
export function identifyGrowthOpportunities(
  input: DiscoverKeywordGapsInput = {}
): DiscoverKeywordGapsOutput {
  return discoverKeywordGaps(input);
}

/** Foreslår nye sider og strukturendringer (evolusjon av sidestruktur). */
export function suggestNewPages(input: EvolveSiteStructureInput = {}): EvolveSiteStructureOutput {
  return evolveSiteStructure(input);
}

/** Foreslår kampanjespesifikasjon (faser, kanaler, KPIs, creative hints). */
export function suggestNewCampaigns(input: GenerateCampaignInput): GenerateCampaignOutput {
  return generateCampaign(input);
}

/** Type for dispatch. */
export type GrowthEngineKind = "opportunities" | "new_pages" | "new_campaigns";

export type GrowthEngineInput =
  | { kind: "opportunities"; input?: DiscoverKeywordGapsInput }
  | { kind: "new_pages"; input?: EvolveSiteStructureInput }
  | { kind: "new_campaigns"; input: GenerateCampaignInput };

export type GrowthEngineResult =
  | { kind: "opportunities"; data: DiscoverKeywordGapsOutput }
  | { kind: "new_pages"; data: EvolveSiteStructureOutput }
  | { kind: "new_campaigns"; data: GenerateCampaignOutput };

/**
 * Samlet dispatch: vekstmuligheter, nye sider, nye kampanjer.
 */
export function runGrowthEngine(req: GrowthEngineInput): GrowthEngineResult {
  switch (req.kind) {
    case "opportunities":
      return { kind: "opportunities", data: identifyGrowthOpportunities(req.input) };
    case "new_pages":
      return { kind: "new_pages", data: suggestNewPages(req.input) };
    case "new_campaigns":
      return { kind: "new_campaigns", data: suggestNewCampaigns(req.input) };
    default:
      throw new Error(`Unknown growth engine kind: ${(req as GrowthEngineInput).kind}`);
  }
}
