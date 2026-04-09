import "server-only";

import { classifyAction } from "@/lib/ai/actionClassifier";
import { auditLog } from "@/lib/core/audit";

export type ExecutionResult = { status: "executed" };

const EXECUTION_BLOCKED = {
  code: "EXECUTION_BLOCKED",
  message: "Manual approval required",
  source: "execution",
  severity: "high" as const,
};

function safeMeta(action: unknown): Record<string, unknown> {
  if (action && typeof action === "object" && !Array.isArray(action)) {
    const o = action as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).slice(0, 24)) {
      const v = o[k];
      if (typeof v === "string") out[k] = v.slice(0, 500);
      else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
      else if (typeof v === "object") out[k] = "[object]";
    }
    return out;
  }
  return { raw: String(action).slice(0, 200) };
}

/**
 * Low-risk actions only: logs audit trail. High-impact paths throw fail-closed (no silent skip).
 */
export async function execute(action: unknown): Promise<ExecutionResult> {
  const mode = classifyAction(action);
  if (mode === "requires_approval") {
    throw EXECUTION_BLOCKED;
  }

  const meta = safeMeta(action);
  const t =
    action && typeof action === "object" && !Array.isArray(action)
      ? String((action as Record<string, unknown>).type ?? (action as Record<string, unknown>).action ?? "unknown").slice(
          0,
          120,
        )
      : "unknown";

  await auditLog({
    action: "auto_executed",
    entity: t,
    metadata: meta,
  });

  return { status: "executed" };
}
