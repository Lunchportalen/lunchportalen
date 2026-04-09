export type AutonomyMetrics = {
  conversionRate: number;
  orders: number;
  users?: number;
  timestamp?: number;
};

export type AutonomyRecommendationAction = {
  type: "pricing_adjustment" | "activate_ads";
  change?: string;
  reason: string;
};
