import "server-only";

import { auditLog } from "@/lib/core/audit";
import { trace } from "@/lib/core/trace";
import { addAction } from "@/lib/execution/queue";
import { opsLog } from "@/lib/ops/log";
import { getRecommendations } from "@/lib/ai/recommendations";

/**
 * Autonomy cycle: log recommendations og legg dem i execution-kø (pending) — ingen kjøring uten godkjenning.
 */
export async function runAutonomyCycle() {
  trace("AUTONOMY_CYCLE", { phase: "start" });
  const recs = await getRecommendations();

  for (const r of recs) {
    await auditLog({
      action: "ai_recommendation",
      entity: r.action,
      metadata: {
        title: r.title,
        priority: r.priority,
        decisionType: r.decisionType,
        reason: r.reason,
      },
    });

    const enq = addAction({
      id: crypto.randomUUID(),
      type: r.action,
      payload: r,
      status: "pending",
    });

    if (enq.ok === false) {
      opsLog("execution_enqueue_failed", { reason: enq.reason, action: r.action });
      await auditLog({
        action: "execution_enqueue_failed",
        entity: "execution",
        metadata: { reason: enq.reason, decisionType: r.decisionType, action: r.action },
      });
    }
  }

  return recs;
}
