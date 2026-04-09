/**
 * Controlled autonomy cycle — settings-gated, does not execute side effects.
 * Complements {@link ./engine} (runAutonomousBusiness) without replacing it.
 */

import "server-only";

import { generateRecommendations } from "@/lib/autonomy/recommendations";
import type { AutonomyMetrics, AutonomyRecommendationAction } from "@/lib/autonomy/recommendationsTypes";
import type { SystemSettings } from "@/lib/system/settings";

export type { AutonomyMetrics } from "@/lib/autonomy/recommendationsTypes";

export type AutonomyCycleContext = {
  settings: SystemSettings | null;
  metrics: AutonomyMetrics;
};

export type AutonomyCycleResult =
  | { skipped: "AUTONOMY_DISABLED"; recommendations: AutonomyRecommendationAction[] }
  | { recommendations: AutonomyRecommendationAction[] };

export async function runAutonomyCycle(ctx: AutonomyCycleContext): Promise<AutonomyCycleResult> {
  const { settings, metrics } = ctx;

  if (!settings?.toggles?.autonomy_master_enabled) {
    return { skipped: "AUTONOMY_DISABLED", recommendations: [] };
  }

  return {
    recommendations: generateRecommendations(metrics),
  };
}
