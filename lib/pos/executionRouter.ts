import "server-only";

import { runAutomation } from "@/lib/ai/automationEngine";
import type { DecisionType } from "@/lib/ai/decisionEngine";
import { evaluatePolicy } from "@/lib/ai/policyEngine";

import type { PosRoutedDecision } from "@/lib/pos/decisionRouter";
import { getCmsDesignTokens } from "@/lib/ai/designTokens";
import { designTokensPromptFragment, getProductSurfaceConfig, type ProductSurface } from "@/lib/pos/surfaceRegistry";

export type PosExecutionKind =
  | "generate_variant_preview"
  | "editor_suggestion_only"
  | "recommendation_record"
  | "blocked_by_policy"
  | "no_side_effect";

export type PosExecutionIntent = {
  surface: ProductSurface;
  kind: PosExecutionKind;
  policy_allowed: boolean;
  requires_approval: boolean;
  policy_explain: string;
  automation_preview: string;
  /** Safe hints for CMS AI / page builder prompts — no persistence. */
  design_system_prompt_fragment: string;
  /** Human-readable next step; never a direct DB write instruction. */
  next_step: string;
};

function verbToDecisionType(verb: PosRoutedDecision["action"]): DecisionType {
  if (verb === "observe_platform_health") return "no_action";
  return verb;
}

/**
 * Maps routed decisions to safe execution intents: policy + automation preview only.
 * No CMS persistence, no variant DB writes — align with {@link evaluatePolicy} / {@link runAutomation}.
 */
export function routeExecution(decisions: PosRoutedDecision[]): PosExecutionIntent[] {
  const dsFragment = designTokensPromptFragment();

  return decisions.map((d) => {
    const synthetic = { ...d.base_decision, decisionType: verbToDecisionType(d.action) };
    const policy = evaluatePolicy(synthetic);
    const auto = runAutomation(synthetic, { mode: "preview" });
    const cfg = getProductSurfaceConfig(d.surface);

    let kind: PosExecutionKind = "no_side_effect";
    if (!policy.allowed) {
      kind = "blocked_by_policy";
    } else if (policy.requiresApproval) {
      kind = cfg.ai.structured_generate ? "generate_variant_preview" : "recommendation_record";
      if (cfg.surface === "backoffice_editor" && synthetic.decisionType !== "no_action") {
        kind = "editor_suggestion_only";
      }
    }

    const surfaceLead =
      d.surface === "kitchen"
        ? "Kjøkkenflate: "
        : d.surface === "driver"
          ? "Sjåførflate: "
          : d.surface === "onboarding"
            ? "Onboarding: "
            : d.surface === "superadmin_dashboard"
              ? "Dashbord: "
              : d.surface === "public_demo"
                ? "Offentlig demo (CTA/variant): "
                : "";

    const next_step =
      kind === "blocked_by_policy"
        ? "Stoppet av policy — ingen automatisk utførelse."
        : kind === "editor_suggestion_only"
          ? `${surfaceLead}Åpne innhold i CMS-redaktør; bruk AI-forslag og bekreft manuelt før publisering.`
          : kind === "generate_variant_preview"
            ? `${surfaceLead}Generer variant eller blokkutkast i redaktør (forhåndsvisning) — ikke publiser uten godkjenning.`
            : kind === "recommendation_record"
              ? `${surfaceLead}Opprett anbefaling i dashbord / manuell saksbehandling — ingen auto-skriv til database.`
              : `${surfaceLead}Fortsett måling; ingen material handling.`;

    return {
      surface: d.surface,
      kind,
      policy_allowed: policy.allowed,
      requires_approval: policy.requiresApproval,
      policy_explain: policy.explain,
      automation_preview: auto.actionPreview,
      design_system_prompt_fragment: dsFragment,
      next_step,
    };
  });
}

/**
 * DS bridge: canonical tokens for any POS-driven generator (same as CMS AI).
 */
export function getPosDesignSystemSnapshot() {
  return { tokens: getCmsDesignTokens(), prompt_fragment: designTokensPromptFragment() };
}
