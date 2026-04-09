/**
 * STEP 3 — Scale decision engine: proven patterns → concrete system-level actions (no block mutation).
 */

import "server-only";

import type { DetectedPatternRow } from "./patterns";

export const SCALE_DECISION_THRESHOLD = 0.75;

export type ScaleActionKind = "design" | "gtm" | "content";

export type ScaleAction = {
  id: string;
  type: ScaleActionKind;
  target: string;
  value: string;
  confidence: number;
  patternType: DetectedPatternRow["type"];
  expectedImpact: string;
};

function slug(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

/**
 * Create scale actions for patterns that pass confidence threshold (deterministic mapping).
 */
export function buildScaleActionsFromPatterns(patterns: readonly DetectedPatternRow[]): ScaleAction[] {
  const out: ScaleAction[] = [];
  for (const p of patterns) {
    if (p.confidence <= SCALE_DECISION_THRESHOLD) continue;
    if (p.value === "insufficient_data" || !p.value.trim()) continue;

    switch (p.type) {
      case "cta": {
        const v = p.value.replace(/^cta_block:/, "").trim() || p.value;
        out.push({
          id: `scale_gtm_defaultCTA_${slug(v)}`,
          type: "gtm",
          target: "defaultCTA",
          value: v.length > 120 ? `${v.slice(0, 117)}…` : v,
          confidence: p.confidence,
          patternType: "cta",
          expectedImpact: "Mer konsistent outbound / demo-CTA i tråd med målt CTR-mønster (globale maler, ikke blokk-mutasjon).",
        });
        out.push({
          id: `scale_content_primaryCtaHint_${slug(v)}`,
          type: "content",
          target: "primaryCtaHint",
          value: v.length > 120 ? `${v.slice(0, 117)}…` : v,
          confidence: p.confidence,
          patternType: "cta",
          expectedImpact: "CMS-standardtekster og bygghjelp prioriterer samme CTA-språk som vinner i måling.",
        });
        break;
      }
      case "spacing": {
        if (p.value === "insufficient_data" || !String(p.value).trim()) break;
        const token =
          p.value === "wide" ? "wide"
          : p.value === "compact" ? "tight"
          : "normal";
        out.push({
          id: `scale_design_spacing_section_${token}`,
          type: "design",
          target: "spacing.section",
          value: token,
          confidence: p.confidence,
          patternType: "spacing",
          expectedImpact: "Global seksjons-spacing justeres for skannbarhet og konvertering (kun DesignSettings).",
        });
        break;
      }
      case "channel": {
        const ch = p.value.toLowerCase();
        if (ch !== "linkedin" && ch !== "email") break;
        out.push({
          id: `scale_gtm_preferredChannel_${ch}`,
          type: "gtm",
          target: "preferredChannel",
          value: ch,
          confidence: p.confidence,
          patternType: "channel",
          expectedImpact: `Utreach prioriterer ${ch} der policy tillater — basert på høyeste målte kanalrate.`,
        });
        break;
      }
      case "industry": {
        out.push({
          id: `scale_content_industryFocus_${slug(p.value)}`,
          type: "content",
          target: "industryFocus",
          value: p.value,
          confidence: p.confidence,
          patternType: "industry",
          expectedImpact: "Innholdsstandarder og pitch vektet mot bransje med best målt respons / nærhet til avslutning.",
        });
        break;
      }
      default:
        break;
    }
  }
  return out;
}
