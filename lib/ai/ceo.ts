import "server-only";

import { enforceAIPolicy } from "@/lib/ai/governor";
import { runAI } from "@/lib/ai/run";
import type { SystemSettings } from "@/lib/system/settings";

/** Deterministic strategic rules (additive). */
export { aiCeoDecision, type StrategicCeoDecision, type StrategicCeoMetrics } from "@/lib/ai/strategicCeoDecision";
export { executeCeoActions } from "@/lib/ai/ceoExecutor";

/**
 * Strategisk CEO-LLM — krever autonomy_master + gyldig AI-policy (ingen auto-pengehandling).
 */
export async function runCEO(metrics: unknown, settings: SystemSettings | null): Promise<unknown> {
  if (!settings?.toggles?.autonomy_master_enabled) {
    console.log("[CEO_DECISION]", { skipped: "CEO_DISABLED" });
    return { skipped: "CEO_DISABLED" as const };
  }

  try {
    enforceAIPolicy(settings, { type: "growth" });
  } catch (e) {
    console.log("[CEO_DECISION]", { skipped: "AI_POLICY", e });
    return { skipped: "AI_POLICY" as const, detail: e };
  }

  const prompt = `You are CEO.

Metrics:
${JSON.stringify(metrics)}

Decide:
- focus
- risk
- action

Respond with concise bullet points. Do not claim revenue was booked.`;

  const decision = await runAI(prompt, "growth");

  console.log("[CEO_DECISION]", decision);
  console.log("[BUSINESS_SYSTEM]", { metrics, decision });

  return decision;
}
