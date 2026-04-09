import "server-only";

import { logAutopilot } from "@/lib/autopilot/log";

import type { StrategicCeoDecision } from "@/lib/ai/strategicCeoDecision";

async function triggerExperiment(kind: string, rid: string): Promise<void> {
  await logAutopilot({ kind: "ceo_trigger_experiment", rid, payload: { kind, executed: false, note: "Awaiting governance" } });
}

async function triggerContentExpansion(rid: string): Promise<void> {
  await logAutopilot({ kind: "ceo_trigger_content", rid, payload: { executed: false, note: "Awaiting governance" } });
}

/**
 * Executes **logged intents only** — no CMS mutation, no auto-publish.
 */
export async function executeCeoActions(actions: StrategicCeoDecision[], rid: string): Promise<void> {
  for (const action of actions) {
    if (action.action === "increase_conversion_focus") {
      await triggerExperiment("cta_improvement", rid);
    } else if (action.action === "increase_traffic") {
      await triggerContentExpansion(rid);
    }
  }
}
