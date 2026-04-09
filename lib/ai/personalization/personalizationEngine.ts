// STATUS: KEEP

/**
 * AI PERSONALIZATION ENGINE
 * Tilpasser: sider, CTA, innhold — basert på bruker.
 * Samler adaptNavigationToUser, personalizeCTA, generatePersonalizedContent, adaptLayoutInRealtime.
 * Kun tilpasning/valg; ingen mutasjon av brukerdata eller publisering.
 */

import { adaptNavigationToUser } from "@/lib/ai/engines/capabilities/adaptNavigationToUser";
import type {
  AdaptNavigationToUserInput,
  AdaptNavigationToUserOutput,
  NavItemInput,
  NavItemOutput,
  UserNavContext,
} from "@/lib/ai/engines/capabilities/adaptNavigationToUser";
import { personalizeCTA } from "@/lib/ai/engines/capabilities/personalizeCTA";
import type {
  PersonalizeCTAInput,
  PersonalizeCTAOutput,
  CTASlot,
  UserCTAContext,
  PersonalizedCTA,
} from "@/lib/ai/engines/capabilities/personalizeCTA";
import { generatePersonalizedContent } from "@/lib/ai/engines/capabilities/generatePersonalizedContent";
import type {
  GeneratePersonalizedContentInput,
  GeneratePersonalizedContentOutput,
  UserContext,
  ContentSlot,
  SelectedVariant,
} from "@/lib/ai/engines/capabilities/generatePersonalizedContent";
import { adaptLayoutInRealtime } from "@/lib/ai/engines/capabilities/adaptLayoutInRealtime";
import type {
  AdaptLayoutInRealtimeInput,
  AdaptLayoutInRealtimeOutput,
  ViewportInput,
  LayoutBlockInput,
  LayoutAdaptation,
} from "@/lib/ai/engines/capabilities/adaptLayoutInRealtime";

export type { NavItemInput, NavItemOutput, UserNavContext, CTASlot, UserCTAContext, PersonalizedCTA, UserContext, ContentSlot, SelectedVariant, ViewportInput, LayoutBlockInput, LayoutAdaptation };

/** Tilpasser sider (navigasjon): filtrerer og sorterer menypunkter etter rolle/segment, fremhever nylig brukte. */
export function personalizePageNavigation(input: AdaptNavigationToUserInput): AdaptNavigationToUserOutput {
  return adaptNavigationToUser(input);
}

/** Tilpasser CTA: velger variant (label, style, href) per slot ut fra brukerens segment/rolle. */
export function personalizeCTAs(input: PersonalizeCTAInput): PersonalizeCTAOutput {
  return personalizeCTA(input);
}

/** Tilpasser innhold: velger variant per slot (headline, body, cta) ut fra brukerens segment. */
export function personalizeContent(input: GeneratePersonalizedContentInput): GeneratePersonalizedContentOutput {
  return generatePersonalizedContent(input);
}

/** Tilpasser layout til viewport/enhet: show/hide/stack/reorder blokker (mobil/tablet/desktop). */
export function adaptLayoutForUser(input: AdaptLayoutInRealtimeInput): AdaptLayoutInRealtimeOutput {
  return adaptLayoutInRealtime(input);
}

/** Type for dispatch. */
export type PersonalizationEngineKind = "pages" | "cta" | "content" | "layout";

export type PersonalizationEngineInput =
  | { kind: "pages"; input: AdaptNavigationToUserInput }
  | { kind: "cta"; input: PersonalizeCTAInput }
  | { kind: "content"; input: GeneratePersonalizedContentInput }
  | { kind: "layout"; input: AdaptLayoutInRealtimeInput };

export type PersonalizationEngineResult =
  | { kind: "pages"; data: AdaptNavigationToUserOutput }
  | { kind: "cta"; data: PersonalizeCTAOutput }
  | { kind: "content"; data: GeneratePersonalizedContentOutput }
  | { kind: "layout"; data: AdaptLayoutInRealtimeOutput };

/**
 * Samlet dispatch: sider (navigasjon), CTA, innhold, layout — basert på bruker.
 */
export function runPersonalizationEngine(req: PersonalizationEngineInput): PersonalizationEngineResult {
  switch (req.kind) {
    case "pages":
      return { kind: "pages", data: personalizePageNavigation(req.input) };
    case "cta":
      return { kind: "cta", data: personalizeCTAs(req.input) };
    case "content":
      return { kind: "content", data: personalizeContent(req.input) };
    case "layout":
      return { kind: "layout", data: adaptLayoutForUser(req.input) };
    default:
      throw new Error(`Unknown personalization engine kind: ${(req as PersonalizationEngineInput).kind}`);
  }
}
