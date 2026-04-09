export type ProfitMappedKind = "optimize" | "variant" | "experiment";

export type ProfitMappedAction = { type: ProfitMappedKind };

export function mapProfitActions(strategy: string[]): ProfitMappedAction[] {
  const out: ProfitMappedAction[] = [];
  for (const s of strategy) {
    switch (s) {
      case "OPTIMIZE_COST":
        out.push({ type: "optimize" });
        break;
      case "IMPROVE_RETENTION":
        out.push({ type: "optimize" });
        break;
      case "SCALE_HIGH_ROI":
        out.push({ type: "variant" });
        break;
      case "EXPAND_MARKETING":
        out.push({ type: "experiment" });
        break;
      default:
        break;
    }
  }
  return out;
}
