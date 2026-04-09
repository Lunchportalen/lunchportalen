import "server-only";

import { runAI } from "@/lib/ai/run";

import type { ExitKpi } from "@/lib/exit/kpi";

/**
 * Narrative exit strategy draft — not legal/financial advice.
 */
export async function buildExitStrategy(metrics: ExitKpi): Promise<string> {
  const prompt = `Build a concise M&A exit strategy outline (Norwegian, professional) based on these KPI proxies (estimates only):
${JSON.stringify(metrics)}

Do not invent contracts or revenue guarantees.`;

  return runAI(prompt, "growth");
}
