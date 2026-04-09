import type { SaasState } from "@/lib/ai/saasStateEngine";

export type SaasIntelligence = {
  activationRate: number;
  revenuePerUser: number;
  growthHealth: number;
  systemLoad: number;
};

export function analyzeSaas(state: SaasState): SaasIntelligence {
  const users = Math.max(state.users, 1);
  const pages = Math.max(state.pages, 1);
  return {
    activationRate: state.activeUsers / users,
    revenuePerUser: state.revenue / users,
    growthHealth: state.growthRate * (1 - state.churn),
    systemLoad: state.traffic / pages,
  };
}
