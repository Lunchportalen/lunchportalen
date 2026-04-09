import "server-only";

import { detectAnomaly, type LogLike } from "@/lib/self-healing/detector";
import { attemptRepair } from "@/lib/self-healing/repair";
import { opsLog } from "@/lib/ops/log";

/**
 * Audit-only self-healing pass: classify → propose repair → log (no automatic mutation).
 */
export async function runSelfHealing(logs: LogLike[], rid: string): Promise<void> {
  const issues = detectAnomaly(logs);
  for (const issue of issues) {
    const fix = attemptRepair({ type: String((issue as { type?: unknown }).type ?? "unknown"), ...issue });
    opsLog("self_healing_proposal", { rid, issue, fix });
  }
}
