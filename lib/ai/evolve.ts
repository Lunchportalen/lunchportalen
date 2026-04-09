import "server-only";

import { runAI } from "@/lib/ai/run";
import type { PromptKey } from "@/lib/ai/prompts";

const EVOLVE_PROMPT_KEY: PromptKey = "growth";

/**
 * Produces an alternative prompt text via LLM. Does not write config — caller must approve and apply manually.
 */
export async function evolvePrompt(current: string, context: string): Promise<string> {
  const input = `
Improve this AI prompt for higher conversion and clarity.

CURRENT PROMPT:
${current}

CONTEXT:
${context}

OUTPUT:
Return ONLY improved prompt.
`.trim();

  const improved = await runAI(input, EVOLVE_PROMPT_KEY);

  if (typeof improved !== "string" || !improved.trim()) {
    throw {
      code: "AI_EVOLUTION_FAILED",
      message: "No improved prompt",
      source: "ai_evolve",
      severity: "high" as const,
    };
  }

  return improved.trim();
}
