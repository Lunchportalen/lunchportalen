export type ScaleChannelRow = {
  id: string;
  budget: number;
  cac: number;
  ltv: number | null;
};

/**
 * Deterministisk skaleringsjustering — ingen ekte pengeflyt herfra.
 * Overspend-beskyttelse: `LP_SCALE_MAX_CHANNEL_BUDGET_NOK` (valgfri).
 */
export function optimizeBudget(channels: ScaleChannelRow[]): ScaleChannelRow[] {
  const max = Number(String(process.env.LP_SCALE_MAX_CHANNEL_BUDGET_NOK ?? "").trim());
  const cap = Number.isFinite(max) && max > 0 ? max : null;

  return channels.map((c) => {
    const ltv = c.ltv;
    let nextBudget = c.budget;
    if (ltv != null && ltv > 0 && c.cac < ltv * 0.3) {
      nextBudget *= 1.2;
    }
    if (ltv != null && ltv > 0 && c.cac > ltv) {
      nextBudget *= 0.5;
    }
    if (cap != null) {
      nextBudget = Math.min(nextBudget, cap);
    }
    return { ...c, budget: Math.round(nextBudget * 100) / 100 };
  });
}
