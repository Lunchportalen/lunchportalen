import "server-only";

import { runAI } from "@/lib/ai/run";

/**
 * Strategi via LLM — kun når approved=true (ingen auto-kjøring).
 */
export async function generateStrategy(
  intent: { goal?: string },
  opts?: { approved?: boolean },
): Promise<unknown> {
  if (opts?.approved !== true) {
    console.log("[AI_SYSTEM]", { phase: "strategy", skipped: "REQUIRES_APPROVAL", intent });
    return { status: "requires_approval" as const, intent };
  }

  const prompt = `Generate a business strategy.\n\nGoal: ${String(intent.goal ?? "unknown")}`;
  return runAI(prompt, "growth");
}
