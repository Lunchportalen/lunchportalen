import "server-only";

import { broadcastDecision } from "@/lib/ai/global";

export async function runGlobalAI(action: unknown): Promise<{ ok: true } | { ok: false; code: string }> {
  console.log("[GLOBAL_AI]", action);
  if (String(process.env.CHAOS_MODE ?? "").trim().toLowerCase() === "true") {
    console.warn("[CHAOS_ACTIVE]");
  }
  try {
    await broadcastDecision(action);
    return { ok: true };
  } catch (e) {
    console.error("[GLOBAL_AI_FAIL]", e);
    return { ok: false, code: "GLOBAL_AI_FAILED" };
  }
}
