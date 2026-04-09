/**
 * Deterministisk CEO-innsikt fra eksisterende pipeline-/vekstsignal (ingen LLM).
 * Alle beslutninger er forklarbare og reversible (ingen sideeffekter her).
 */

export type CeoInsightSeverity = "high" | "medium" | "low";

export type CeoInsight = {
  type: string;
  message: string;
  severity: CeoInsightSeverity;
  /** Estimert eksponering i kr (sum av relevante deal-verdier), 0 hvis ukjent. */
  revenueImpactKr?: number;
};

/** Minimal deal-slice for analyse (matcher enrichPipelineDeal + prediction). */
export type CeoDealSlice = {
  id?: string;
  value?: number;
  age_days?: number;
  prediction?: { risk: string; winProbability: number };
};

export type CeoPipelineSlice = {
  deals: number;
  totalValue: number;
  weightedValue: number;
  dealsList: CeoDealSlice[];
};

export type CeoSocialSlice = {
  posts?: unknown[];
};

export type CeoRevenueSlice = {
  revenue?: number;
  forecast?: number;
};

export type AnalyzeBusinessInput = {
  pipeline: CeoPipelineSlice;
  social: CeoSocialSlice;
  revenue: CeoRevenueSlice;
  /** Når social ikke er lastet, skal vi ikke anta «ingen aktivitet». */
  flags?: { socialLoaded?: boolean };
};

export function analyzeBusiness(input: AnalyzeBusinessInput): CeoInsight[] {
  const insights: CeoInsight[] = [];

  const pipeline = input.pipeline ?? {
    deals: 0,
    totalValue: 0,
    weightedValue: 0,
    dealsList: [],
  };
  const dealsList = Array.isArray(pipeline.dealsList) ? pipeline.dealsList : [];
  const social = input.social ?? {};
  const posts = Array.isArray(social.posts) ? social.posts : [];
  const socialLoaded = input.flags?.socialLoaded === true;

  if (pipeline.deals > 0) {
    const highRiskDeals = dealsList.filter((d) => d.prediction?.risk === "high");
    if (highRiskDeals.length > 0) {
      const revenueImpactKr = highRiskDeals.reduce(
        (s, d) => s + (typeof d.value === "number" && Number.isFinite(d.value) ? d.value : 0),
        0,
      );
      insights.push({
        type: "risk",
        message: `${highRiskDeals.length} deal${highRiskDeals.length === 1 ? "" : "s"} er i risiko`,
        severity: "high",
        revenueImpactKr,
      });
    }

    const totalValue = pipeline.totalValue;
    const weightedValue = pipeline.weightedValue;
    if (totalValue > 0 && weightedValue < totalValue * 0.5) {
      insights.push({
        type: "forecast",
        message: "Lav konverteringsgrad i pipeline (vektet vs. brutto)",
        severity: "medium",
        revenueImpactKr: Math.max(0, totalValue - weightedValue),
      });
    }
  }

  if (socialLoaded && posts.length === 0) {
    insights.push({
      type: "growth",
      message: "Ingen aktivitet på sosiale medier (ingen innlegg i sporet)",
      severity: "medium",
    });
  }

  return insights;
}
