/**
 * STEP 1 — Deterministic multi-role “advisory” decisions from a numeric snapshot (no LLM).
 * Confidence is heuristic, bounded; reasons cite metrics.
 */

import type { AllowedCompanyAction } from "./actionTypes";
import type { CompanyDecision, CompanyDecisionType, CompanyRiskLevel, CompanySnapshot } from "./types";

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function makeDecision(
  id: string,
  type: CompanyDecisionType,
  action: string,
  confidence: number,
  reason: string,
  risk: CompanyRiskLevel,
  channel: CompanyDecision["channel"],
  allowedAction?: AllowedCompanyAction,
): CompanyDecision {
  return {
    id,
    type,
    action,
    confidence: clamp01(confidence),
    reason,
    risk,
    channel,
    ...(allowedAction ? { allowedAction } : {}),
  };
}

export function proposeCompanyDecisions(snapshot: CompanySnapshot): CompanyDecision[] {
  const out: CompanyDecision[] = [];
  const ctr = snapshot.revenue.ctr;
  const pv = snapshot.revenue.pageViews24h;
  const drafts = snapshot.content.draftPages;
  const health = snapshot.systemHealth.status;
  const weak = snapshot.design.weakPointsCount;
  const spacing = snapshot.design.globalSpacingSection;

  if (ctr != null && pv >= 40 && ctr < 0.012) {
    out.push(
      makeDecision(
        "growth_cta_visibility",
        "growth",
        "increase CTA visibility",
        0.82,
        `CTR ${(ctr * 100).toFixed(2)}% under 1.2% med ${pv} visninger (24h).`,
        "medium",
        "revenue_insights",
        "revenue.optimize",
      ),
    );
  }

  if (weak >= 2 && ctr != null && ctr < 0.02) {
    out.push(
      makeDecision(
        "product_spacing_readability",
        "product",
        "widen vertical rhythm (spacing.section)",
        0.74,
        `${weak} design-svakheter observert samtidig med CTR ${(ctr * 100).toFixed(2)}%.`,
        "low",
        "design_optimizer",
        "design.update",
      ),
    );
  } else if (spacing === "tight" && pv >= 30) {
    out.push(
      makeDecision(
        "product_relax_tight_spacing",
        "product",
        "relax tight global spacing",
        0.68,
        "Global spacing er «tight» med meningsfull trafikk — kan begrense lesbarhet.",
        "low",
        "design_optimizer",
        "design.update",
      ),
    );
  }

  if (drafts >= 8) {
    out.push(
      makeDecision(
        "ops_review_draft_backlog",
        "operations",
        "review draft backlog",
        0.61,
        `${drafts} utkastssider — risiko for inkonsistent publisert opplevelse.`,
        "medium",
        "cms_editor",
        "content.suggest",
      ),
    );
  }

  if (health !== "ok") {
    out.push(
      makeDecision(
        "ceo_stabilize_platform",
        "ceo",
        "prioritize platform stability before growth experiments",
        0.88,
        `System health ${health}${snapshot.systemHealth.detail ? `: ${snapshot.systemHealth.detail}` : ""}.`,
        "high",
        "system_ops",
      ),
    );
  }

  if (snapshot.content.contentHealthHint != null && snapshot.content.contentHealthHint < 0.65 && pv >= 50) {
    out.push(
      makeDecision(
        "ceo_content_health_review",
        "ceo",
        "content health review",
        0.7,
        `Innholdshelse-indikator ${(snapshot.content.contentHealthHint * 100).toFixed(0)}/100 ved ${pv} visninger.`,
        "medium",
        "cms_editor",
        "content.suggest",
      ),
    );
  }

  return out;
}
