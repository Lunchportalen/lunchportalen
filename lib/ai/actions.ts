import "server-only";

import { requireApproval } from "@/lib/ai/approval";

function actionTypeFromUnknown(action: unknown): string {
  if (action && typeof action === "object" && "type" in action) {
    const t = (action as { type?: unknown }).type;
    return typeof t === "string" && t.trim() ? t.trim() : "unknown";
  }
  if (typeof action === "string" && action.trim()) return action.trim();
  return "unknown";
}

/**
 * Controlled autonomy: no automatic side effects. All impact actions require out-of-band approval.
 */
export async function executeAction(action: unknown): Promise<never> {
  requireApproval(actionTypeFromUnknown(action));
}
