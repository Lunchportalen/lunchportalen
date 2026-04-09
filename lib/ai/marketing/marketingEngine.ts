// STATUS: KEEP

/**
 * AI MARKETING ENGINE
 * Genererer: annonser, e-poster, sosiale innlegg.
 * Samler generateCampaign, optimizeAdCopy, generateEmailSequence, generateSocialPosts.
 * Kun generering/spec; ingen publisering eller mutasjon.
 */

import { generateCampaign } from "@/lib/ai/engines/capabilities/generateCampaign";
import type {
  GenerateCampaignInput,
  GenerateCampaignOutput,
  CampaignPhase,
  CampaignKpi,
} from "@/lib/ai/engines/capabilities/generateCampaign";
import { optimizeAdCopy } from "@/lib/ai/engines/capabilities/optimizeAdCopy";
import type {
  OptimizeAdCopyInput,
  OptimizeAdCopyOutput,
  CharacterCount,
} from "@/lib/ai/engines/capabilities/optimizeAdCopy";
import { generateEmailSequence } from "@/lib/ai/engines/capabilities/generateEmailSequence";
import type {
  GenerateEmailSequenceInput,
  GenerateEmailSequenceOutput,
  EmailInSequence,
} from "@/lib/ai/engines/capabilities/generateEmailSequence";
import { generateSocialPosts } from "@/lib/ai/engines/capabilities/generateSocialPosts";
import type {
  GenerateSocialPostsInput,
  GenerateSocialPostsOutput,
} from "@/lib/ai/engines/capabilities/generateSocialPosts";

export type { CampaignPhase, CampaignKpi, CharacterCount, EmailInSequence };

/** Genererer kampanjespesifikasjon (faser, kanaler, KPIs, creative hints); kan inkludere annonser. */
export function generateCampaignSpec(input: GenerateCampaignInput): GenerateCampaignOutput {
  return generateCampaign(input);
}

/** Genererer/optimaliserer annonsekopi: headline, body, CTA med varianter og plattformgrenser (google, meta, linkedin). */
export function generateAdCopy(input: OptimizeAdCopyInput): OptimizeAdCopyOutput {
  return optimizeAdCopy(input);
}

/** Genererer e-postsekvens: emne, forhåndstekst, body-oppsummering, CTA, forsinkelse per e-post. */
export function generateEmailSequenceSpec(input: GenerateEmailSequenceInput): GenerateEmailSequenceOutput {
  return generateEmailSequence(input);
}

/** Genererer sosiale innlegg per plattform (LinkedIn, Facebook, Twitter, Instagram): copy, tegnbegrensning, hashtags. */
export function generateSocialPostsSpec(input: GenerateSocialPostsInput): GenerateSocialPostsOutput {
  return generateSocialPosts(input);
}

/** Type for dispatch. */
export type MarketingEngineKind = "campaign" | "ads" | "emails" | "social";

export type MarketingEngineInput =
  | { kind: "campaign"; input: GenerateCampaignInput }
  | { kind: "ads"; input: OptimizeAdCopyInput }
  | { kind: "emails"; input: GenerateEmailSequenceInput }
  | { kind: "social"; input: GenerateSocialPostsInput };

export type MarketingEngineResult =
  | { kind: "campaign"; data: GenerateCampaignOutput }
  | { kind: "ads"; data: OptimizeAdCopyOutput }
  | { kind: "emails"; data: GenerateEmailSequenceOutput }
  | { kind: "social"; data: GenerateSocialPostsOutput };

/**
 * Samlet dispatch: kampanje, annonser, e-poster, sosiale innlegg.
 */
export function runMarketingEngine(req: MarketingEngineInput): MarketingEngineResult {
  switch (req.kind) {
    case "campaign":
      return { kind: "campaign", data: generateCampaignSpec(req.input) };
    case "ads":
      return { kind: "ads", data: generateAdCopy(req.input) };
    case "emails":
      return { kind: "emails", data: generateEmailSequenceSpec(req.input) };
    case "social":
      return { kind: "social", data: generateSocialPostsSpec(req.input) };
    default:
      throw new Error(`Unknown marketing engine kind: ${(req as MarketingEngineInput).kind}`);
  }
}
