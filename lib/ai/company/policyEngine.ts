/**
 * Production policy gate — default DENY, strict allowlist, fail-closed.
 */

import {
  CompanyDecisionPolicyInputSchema,
  resolveAllowedCompanyAction,
  type AllowedCompanyAction,
} from "./actionTypes";
import type {
  CompanyBatchCooldownResult,
  CompanyDecision,
  CompanyPolicyContext,
  CompanyPolicyResult,
  CompanyRiskLevel,
} from "./types";

/** User rule: max structured actions per control cycle. */
export const MAX_ACTIONS_PER_RUN = 2;
export const COMPANY_MAX_DECISIONS_PER_RUN = MAX_ACTIONS_PER_RUN;

/** Batch overlap cooldown (same decision ids). */
const AUTOPILOT_BATCH_COOLDOWN_MS = 300_000;

/** Per policy target — middle of 5–15 minutes. */
export const POLICY_TARGET_COOLDOWN_MS = 600_000;

function baseMeta(
  decision: CompanyDecision,
  aa: AllowedCompanyAction | null,
): Pick<CompanyPolicyResult, "riskLevel" | "allowedAction"> {
  return { riskLevel: decision.risk, allowedAction: aa };
}

function deny(
  decision: CompanyDecision,
  aa: AllowedCompanyAction | null,
  reason: string,
): CompanyPolicyResult {
  return { allowed: false, reason, ...baseMeta(decision, aa) };
}

function allow(
  decision: CompanyDecision,
  aa: AllowedCompanyAction,
  reason: string,
  override?: boolean,
): CompanyPolicyResult {
  return { allowed: true, reason, ...baseMeta(decision, aa), override };
}

/** Infer spacing direction for conflict detection (same-cycle flip guard). */
export function inferSpacingIntentForDecision(d: CompanyDecision): "wide" | "tight" | null {
  const a = d.action.toLowerCase();
  if (a.includes("relax") && a.includes("tight")) return "wide";
  if (a.includes("widen") || a.includes("wide")) return "wide";
  if (a.includes("tighten")) return "tight";
  if (d.id.includes("tight") && a.includes("relax")) return "wide";
  if (d.id.includes("spacing") && a.includes("widen")) return "wide";
  return null;
}

/**
 * When both widening and tightening are proposed for design.update in one cycle → deny those rows (unpredictable UX).
 */
export function detectSpacingConflictDeniedIds(decisions: readonly CompanyDecision[]): Set<string> {
  const deny = new Set<string>();
  const spacingRows = decisions.filter((d) => {
    const aa = resolveAllowedCompanyAction(d);
    return aa === "design.update" && d.channel === "design_optimizer" && inferSpacingIntentForDecision(d) != null;
  });
  const intents = new Set(spacingRows.map((d) => inferSpacingIntentForDecision(d)!));
  if (!intents.has("wide") || !intents.has("tight")) return deny;
  for (const d of spacingRows) deny.add(d.id);
  return deny;
}

export function policyCooldownTargetKey(decision: CompanyDecision, aa: AllowedCompanyAction): string | null {
  if (aa === "design.update" && decision.channel === "design_optimizer") {
    const a = decision.action.toLowerCase();
    if (a.includes("cta") || a.includes("hover") || a.includes("visibility")) return "card.cta.hover";
    return "spacing.section";
  }
  if (aa === "design.scale") return "design.scale.global";
  if (aa === "revenue.optimize") return "revenue.optimize.run";
  if (aa === "content.suggest") return "content.suggest.run";
  if (aa === "gtm.suggest") return "gtm.suggest.run";
  return null;
}

function assertTargetCooldown(
  decision: CompanyDecision,
  aa: AllowedCompanyAction | null,
  ctx: CompanyPolicyContext,
): CompanyPolicyResult | null {
  if (!aa) return null;
  const key = policyCooldownTargetKey(decision, aa);
  if (!key || !ctx.targetCooldownLastAt) return null;
  const last = ctx.targetCooldownLastAt[key];
  if (typeof last !== "number" || !Number.isFinite(last)) return null;
  const elapsed = Date.now() - last;
  if (elapsed >= POLICY_TARGET_COOLDOWN_MS) return null;
  return deny(decision, aa, `target_cooldown_active_${key}_${Math.ceil((POLICY_TARGET_COOLDOWN_MS - elapsed) / 1000)}s`);
}

/**
 * Default DENY. Unknown allowlisted action → `unknown_action`.
 * Human override: `ctx.forceOverride` → allow (logged by caller).
 */
export function evaluateCompanyDecision(decision: CompanyDecision, ctx: CompanyPolicyContext): CompanyPolicyResult {
  const parsed = CompanyDecisionPolicyInputSchema.safeParse(decision);
  if (!parsed.success) {
    return {
      allowed: false,
      reason: "invalid_decision_payload",
      riskLevel: decision.risk ?? "high",
      allowedAction: resolveAllowedCompanyAction(decision),
    };
  }

  const aa = resolveAllowedCompanyAction(decision);
  if (!aa) {
    return deny(decision, null, "unknown_action");
  }

  if (ctx.forceOverride === true) {
    return allow(decision, aa, "human_override", true);
  }

  const cooldownDeny = assertTargetCooldown(decision, aa, ctx);
  if (cooldownDeny) return cooldownDeny;

  if (ctx.mode === "manual") {
    return deny(decision, aa, "manual_mode_suggestions_only");
  }

  if (ctx.negativeImpactObserved === true) {
    return deny(decision, aa, "rollback_negative_impact_observed");
  }

  if (ctx.mode === "auto" && ctx.hasAnomalies === true) {
    return deny(decision, aa, "anomaly_disables_auto");
  }

  if (decision.confidence < 0.55) {
    return deny(decision, aa, "confidence_below_0_55");
  }

  if (decision.channel === "system_ops") {
    return deny(decision, aa, "system_ops_requires_manual");
  }

  if (ctx.mode === "auto") {
    if (decision.risk === "high") {
      return deny(decision, aa, "auto_denies_high_risk");
    }
    if (decision.risk === "medium") {
      return deny(decision, aa, "auto_denies_medium_risk");
    }
    if (decision.channel === "cms_editor") {
      return deny(decision, aa, "auto_never_direct_cms_mutations");
    }
    if (aa === "revenue.optimize" || aa === "content.suggest" || aa === "gtm.suggest") {
      return deny(decision, aa, "auto_only_low_risk_design_tokens");
    }
    if (aa === "design.scale") {
      return deny(decision, aa, "auto_denies_design_scale_pending_governance");
    }
    if (aa === "design.update" && decision.channel === "design_optimizer" && decision.risk === "low") {
      return allow(decision, aa, "auto_safe_design_update_low_risk");
    }
    return deny(decision, aa, "unknown_action");
  }

  if (ctx.mode === "assisted") {
    if (decision.risk === "high") {
      return deny(decision, aa, "assisted_high_risk_requires_override");
    }
    if (decision.risk === "medium") {
      const approved = ctx.explicitApproveIds?.includes(decision.id) === true;
      if (!approved) {
        return deny(decision, aa, "assisted_medium_requires_explicit_approval");
      }
      if (aa === "design.update" && decision.channel === "design_optimizer") {
        return allow(decision, aa, "assisted_approved_design_update");
      }
      if (aa === "revenue.optimize" && decision.channel === "revenue_insights") {
        return allow(decision, aa, "assisted_approved_revenue_optimize");
      }
      if (aa === "content.suggest" && decision.channel === "cms_editor") {
        return allow(decision, aa, "assisted_approved_content_suggest");
      }
      return deny(decision, aa, "unknown_action");
    }
    if (decision.risk === "low") {
      if (aa === "design.update" && decision.channel === "design_optimizer") {
        return allow(decision, aa, "assisted_low_risk_design_update");
      }
      if (aa === "revenue.optimize" || aa === "content.suggest") {
        const approved = ctx.explicitApproveIds?.includes(decision.id) === true;
        if (!approved) {
          return deny(decision, aa, "assisted_low_non_design_requires_explicit_approval");
        }
        return allow(decision, aa, "assisted_approved_low_risk_non_design");
      }
      return deny(decision, aa, "unknown_action");
    }
  }

  return deny(decision, aa, "unknown_action");
}

/** Cooldown when re-firing overlapping decision ids. */
export function assertCompanyBatchCooldown(
  newDecisionIds: string[],
  last: { at: number; decisionIds: string[] } | null | undefined,
  cooldownMs: number = AUTOPILOT_BATCH_COOLDOWN_MS,
): CompanyBatchCooldownResult {
  if (!last || last.decisionIds.length === 0 || newDecisionIds.length === 0) {
    return { allowed: true, reason: "cooldown_skip" };
  }
  const overlap = newDecisionIds.some((id) => last.decisionIds.includes(id));
  if (!overlap) return { allowed: true, reason: "cooldown_no_overlap" };
  const elapsed = Date.now() - last.at;
  if (elapsed >= cooldownMs) return { allowed: true, reason: "cooldown_elapsed" };
  return {
    allowed: false,
    reason: `cooldown_active_${Math.ceil((cooldownMs - elapsed) / 1000)}s`,
  };
}

export function capCompanyDecisions<T extends { id: string }>(items: T[], max: number = MAX_ACTIONS_PER_RUN): T[] {
  return items.slice(0, max);
}

/** Narrow auto-execution to conservative design-token intents only. */
export function isAutoSafeDecision(decision: CompanyDecision): boolean {
  const aa = resolveAllowedCompanyAction(decision);
  if (aa !== "design.update") return false;
  if (decision.risk !== "low" || decision.channel !== "design_optimizer") return false;
  const a = decision.action.toLowerCase();
  return a.includes("spacing") || a.includes("vertical") || a.includes("cta") || a.includes("hover");
}
