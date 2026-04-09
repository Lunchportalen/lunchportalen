import "server-only";

import { getAIConfig } from "@/lib/ai/config";
import { evolvePrompt } from "@/lib/ai/evolve";
import { getPromptPerformance } from "@/lib/ai/performance";
import { readPromptRegistry } from "@/lib/ai/prompts";

export type PromptOptimizationSuggestion = {
  key: string;
  type: "prompt_upgrade";
  current: string;
  proposed: string;
  reason: string;
  conversionRate: number;
  runs: number;
};

/** Cap LLM calls per request (deterministic order; no auto-apply). */
const MAX_SUGGESTIONS_PER_RUN = 3;

const LOW_CR = 0.03;

/**
 * Read-only suggestions: compares registry prompts to telemetry and may call `evolvePrompt` (LLM) for text proposals only.
 * Never updates `ai_config` or deploys.
 */
export async function generateOptimizations(): Promise<PromptOptimizationSuggestion[]> {
  const perf = await getPromptPerformance();
  const config = await getAIConfig();
  const registry = readPromptRegistry(config);

  const keys = Object.keys(registry).sort();
  const suggestions: PromptOptimizationSuggestion[] = [];

  for (const key of keys) {
    if (suggestions.length >= MAX_SUGGESTIONS_PER_RUN) break;

    const current = registry[key];
    if (typeof current !== "string" || !current.trim()) continue;

    const data = perf[key];
    if (!data || data.runs === 0) continue;

    const conversionRate = data.conversions / data.runs;
    if (conversionRate >= LOW_CR) continue;

    try {
      const proposed = await evolvePrompt(current, `Low performance: conversionRate=${conversionRate.toFixed(4)}, runs=${data.runs}`);
      suggestions.push({
        key,
        type: "prompt_upgrade",
        current,
        proposed,
        reason: "Low conversion",
        conversionRate,
        runs: data.runs,
      });
    } catch {
      /* fail-closed: skip suggestion if evolution fails */
    }
  }

  return suggestions;
}
