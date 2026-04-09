import "server-only";

import { publishEvent } from "@/lib/eventBus/redisPubSub";

export async function broadcastDecision(action: unknown): Promise<void> {
  console.log("[DURABLE_EVENT]", { kind: "ai_decision", action });
  if (String(process.env.CHAOS_MODE ?? "").trim().toLowerCase() === "true") {
    console.warn("[CHAOS_ACTIVE]");
  }
  try {
    const r = await publishEvent("ai_decision", action);
    if (!r.ok) {
      console.error("[AI_BROADCAST_REDIS]", r);
    }
  } catch (e) {
    console.error("[AI_BROADCAST_FAIL]", e);
  }
}
