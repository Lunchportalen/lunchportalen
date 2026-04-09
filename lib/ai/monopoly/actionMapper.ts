import type { MonopolyStrategyPillar } from "@/lib/ai/monopoly/strategyEngine";
import type { OrgAction } from "@/lib/ai/org/orgCoordinator";

export function mapMonopolyActions(strategy: MonopolyStrategyPillar[]): OrgAction[] {
  const out: OrgAction[] = [];
  for (const s of strategy) {
    switch (s) {
      case "CONTENT_EXPANSION":
        out.push({ type: "variant" });
        break;
      case "SEO_DOMINATION":
        out.push({ type: "optimize" });
        break;
      case "CATEGORY_CREATION":
        out.push({ type: "experiment" });
        break;
      case "RETENTION_SYSTEM":
        out.push({ type: "optimize" });
        break;
      case "POSITIONING_REINFORCEMENT":
        out.push({ type: "variant" });
        break;
      default:
        break;
    }
  }
  return dedupeOrgActionsByType(out);
}

/** First occurrence wins per type — avoids duplicate optimize/variant from multiple pillars. */
function dedupeOrgActionsByType(actions: OrgAction[]): OrgAction[] {
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.type)) return false;
    seen.add(a.type);
    return true;
  });
}
