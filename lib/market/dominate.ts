import "server-only";

import { runAI } from "@/lib/ai/run";

/**
 * Markedsstrategi via LLM — krever eksplisitt godkjenning i runGlobalControl.
 */
export async function generateDominationStrategy(signals: unknown): Promise<unknown> {
  const prompt = `Dominate market given signals: ${JSON.stringify(signals)}`;
  return runAI(prompt, "growth");
}
