/**
 * Hard profit-guard: blokker skalering når dokumentert omsetning < spend.
 */

import type { RevenueEvent } from "@/lib/revenue/unified";

export type ProfitGuardResult = "block_scaling" | "ok";

export function profitGuard(campaign: { spend: number }, events: RevenueEvent[]): ProfitGuardResult {
  const spend = typeof campaign.spend === "number" && Number.isFinite(campaign.spend) ? Math.max(0, campaign.spend) : 0;
  const revenue = events.reduce((s, e) => s + (Number.isFinite(e.amount) ? Math.max(0, e.amount) : 0), 0);
  if (spend <= 0) return "ok";
  if (revenue < spend) return "block_scaling";
  return "ok";
}
