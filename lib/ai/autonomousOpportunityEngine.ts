import type { SaasIntelligence } from "@/lib/ai/saasIntelligenceEngine";
import type { SaasState } from "@/lib/ai/saasStateEngine";

export function detectSaasOpportunities(state: SaasState, intel: SaasIntelligence): string[] {
  const ops: string[] = [];
  if (intel.activationRate < 0.3) ops.push("IMPROVE_ONBOARDING");
  if (state.conversion < 0.02) ops.push("OPTIMIZE_FUNNEL");
  if (state.pages < 10) ops.push("CREATE_NEW_PAGES");
  if (state.experiments === 0) ops.push("START_EXPERIMENT");
  if (state.churn > 0.05) ops.push("RETENTION_ACTION");
  return ops;
}
