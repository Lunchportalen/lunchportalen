export function buildProfitStrategy(leaks: string[], ops: string[]): string[] {
  const strategy: string[] = [];
  if (leaks.includes("LOW_MARGIN")) {
    strategy.push("OPTIMIZE_COST");
  }
  if (leaks.includes("HIGH_CHURN")) {
    strategy.push("IMPROVE_RETENTION");
  }
  if (ops.includes("SCALE_WINNERS")) {
    strategy.push("SCALE_HIGH_ROI");
  }
  if (ops.includes("INCREASE_ACQUISITION")) {
    strategy.push("EXPAND_MARKETING");
  }
  if (ops.includes("EXPAND_CUSTOMER_BASE")) {
    strategy.push("EXPAND_MARKETING");
  }
  return strategy;
}
