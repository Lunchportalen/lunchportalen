import type { CeoDealSlice, CeoPipelineSlice } from "@/lib/ceo/engine";

export type CeoOpportunity = {
  type: string;
  message: string;
  /** Lavere tall = høyere prioritet */
  priority: number;
  revenueImpactKr?: number;
};

export function findOpportunities(pipeline: CeoPipelineSlice): CeoOpportunity[] {
  const opportunities: CeoOpportunity[] = [];
  const dealsList: CeoDealSlice[] = Array.isArray(pipeline.dealsList) ? pipeline.dealsList : [];

  if (pipeline.deals <= 0 || dealsList.length === 0) {
    return opportunities;
  }

  const strongDeals = dealsList.filter((d) => (d.prediction?.winProbability ?? 0) > 70);
  if (strongDeals.length > 0) {
    const revenueImpactKr = strongDeals.reduce(
      (s, d) => s + (typeof d.value === "number" && Number.isFinite(d.value) ? d.value : 0),
      0,
    );
    opportunities.push({
      type: "close_deals",
      message: `${strongDeals.length} deals kan lukkes nå`,
      priority: 1,
      revenueImpactKr,
    });
  }

  const staleDeals = dealsList.filter((d) => (typeof d.age_days === "number" ? d.age_days : 0) > 14);
  if (staleDeals.length > 0) {
    const revenueImpactKr = staleDeals.reduce(
      (s, d) => s + (typeof d.value === "number" && Number.isFinite(d.value) ? d.value : 0),
      0,
    );
    opportunities.push({
      type: "revive_deals",
      message: `${staleDeals.length} deals må følges opp`,
      priority: 2,
      revenueImpactKr,
    });
  }

  return opportunities;
}
