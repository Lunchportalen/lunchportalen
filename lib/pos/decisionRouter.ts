import "server-only";

import type { DecisionResult, DecisionType } from "@/lib/ai/decisionEngine";
import { makeDecision } from "@/lib/ai/decisionEngine";

import type { PosUnifiedSignals } from "@/lib/pos/signalCollector";
import { getProductSurfaceConfig, PRODUCT_SURFACES, type ProductSurface } from "@/lib/pos/surfaceRegistry";

export type PosRoutedDecision = {
  surface: ProductSurface;
  /** Stable verb for execution layer (maps from {@link DecisionType} + surface). */
  action: PosActionVerb;
  confidence: number;
  reason: string;
  /** Underlying explainable decision (shared engine). */
  base_decision: DecisionResult;
};

export type PosActionVerb =
  | "increase_cta_visibility"
  | "create_seo_page"
  | "pause_underperforming_variant"
  | "refresh_content"
  | "funnel_optimize"
  | "no_action"
  | "observe_platform_health";

/**
 * Surface relevance 0–1: how strongly the global decision applies to this surface.
 */
function surfaceRelevance(surface: ProductSurface, decisionType: DecisionType): number {
  const cfg = getProductSurfaceConfig(surface);
  switch (decisionType) {
    case "increase_cta_visibility":
      return cfg.growth.primary_goal === "conversion" ? 1 : cfg.growth.primary_goal === "completion" ? 0.55 : 0.25;
    case "funnel_optimize":
      return cfg.growth.primary_goal === "completion" ? 1 : 0.45;
    case "create_seo_page":
      return cfg.cms.reads_cms_pages ? 0.85 : 0.2;
    case "refresh_content":
      return cfg.cms.reads_cms_pages || cfg.ai.analysis_and_suggest ? 0.9 : 0.15;
    case "pause_underperforming_variant":
      return cfg.growth.experiments ? 0.95 : 0.1;
    case "no_action":
      return 0.35;
    default:
      return 0.2;
  }
}

function decisionTypeToVerb(t: DecisionType): PosActionVerb {
  if (t === "no_action") return "observe_platform_health";
  return t;
}

function surfacePosFocus(surface: ProductSurface): string {
  switch (surface) {
    case "public_demo":
      return " Fokus: CTA-variant og tydelig konverteringssti.";
    case "onboarding":
      return " Fokus: enklere veiledningstekst (forhåndsvisning).";
    case "superadmin_dashboard":
      return " Fokus: dashbord-layout og KPI-lesbarhet.";
    case "kitchen":
      return " Fokus: produksjons-UI med færre distraksjoner.";
    case "driver":
      return " Fokus: kortere instruksjoner per stopp.";
    case "week":
    case "employee":
      return " Fokus: ukevisning som er lett å skanne.";
    default:
      return "";
  }
}

function localizeReason(surface: ProductSurface, base: DecisionResult): string {
  const cfg = getProductSurfaceConfig(surface);
  const goal = cfg.growth.primary_goal;
  const prefix =
    goal === "conversion"
      ? "[Konvertering] "
      : goal === "completion"
        ? "[Fullføring] "
        : goal === "engagement"
          ? "[Engasjement] "
          : goal === "operations"
            ? "[Drift] "
            : "[Observabilitet] ";
  return `${prefix}${base.reason} (flate: ${cfg.label})${surfacePosFocus(surface)}`;
}

/**
 * One explainable global decision from {@link makeDecision}, then per-surface routing with confidence weighting.
 */
export function routeDecisions(
  signals: PosUnifiedSignals,
  surfaces?: ProductSurface[],
): PosRoutedDecision[] {
  const base = makeDecision(signals.decision_input);
  const list: ProductSurface[] = surfaces && surfaces.length > 0 ? surfaces : [...PRODUCT_SURFACES];

  return list.map((surface) => {
    const rel = surfaceRelevance(surface, base.decisionType);
    const confidence = Math.max(0, Math.min(1, base.confidence * rel));
    return {
      surface,
      action: decisionTypeToVerb(base.decisionType),
      confidence,
      reason: localizeReason(surface, base),
      base_decision: base,
    };
  });
}
