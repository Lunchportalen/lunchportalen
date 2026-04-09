import type { OrgAction } from "@/lib/ai/org/orgCoordinator";

export function decideMarketActions(expansion: string[]): OrgAction[] {
  const out: OrgAction[] = [];
  for (const e of expansion) {
    switch (e) {
      case "CREATE_LANDING_PAGES":
        out.push({ type: "variant" });
        break;
      case "INCREASE_ACQUISITION":
        out.push({ type: "experiment" });
        break;
      default:
        break;
    }
  }
  return out;
}
