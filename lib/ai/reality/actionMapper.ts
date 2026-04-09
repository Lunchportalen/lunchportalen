import type { OrgAction } from "@/lib/ai/org/orgCoordinator";

/**
 * Maps perception strategy tokens → safe automation types (draft variant, optimize cron, experiment).
 * Does not create fake social proof — only triggers tooling for human-authored, truthful content.
 */
export function mapRealityActions(strategy: string[]): OrgAction[] {
  const out: OrgAction[] = [];
  for (const s of strategy) {
    switch (s) {
      case "IMPROVE_MESSAGING":
      case "INCREASE_CONSISTENCY":
      case "REDUCE_FRICTION":
      case "CLEAR_VALUE_PROPOSITION":
      case "SIMPLIFY_DECISION_PATH":
      case "SIMPLIFY_COPY":
      case "REDUCE_DECISION_POINTS":
        out.push({ type: "optimize" });
        break;
      case "ADD_TRUST_SIGNALS":
      case "SOCIAL_PROOF":
      case "ADD_TESTIMONIALS":
      case "ADD_CASE_STUDIES":
        out.push({ type: "variant" });
        break;
      case "STRENGTHEN_POSITIONING":
      case "CATEGORY_AUTHORITY":
        out.push({ type: "experiment" });
        break;
      default:
        break;
    }
  }
  return dedupeOrgActionsByType(out);
}

function dedupeOrgActionsByType(actions: OrgAction[]): OrgAction[] {
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.type)) return false;
    seen.add(a.type);
    return true;
  });
}
