import "server-only";

const AUTO_TYPES = new Set(["analyze", "log", "score"]);

function normType(action: unknown): string {
  if (action && typeof action === "object" && !Array.isArray(action)) {
    const o = action as Record<string, unknown>;
    const t = o.type;
    if (typeof t === "string") return t.trim().toLowerCase();
  }
  return "";
}

/**
 * Policy for execution queue: only whitelisted types may auto-run when AI_AUTO_MODE is on.
 */
export function getPolicy(action: unknown): "auto" | "approval_required" {
  const t = normType(action);
  if (!t) return "approval_required";
  return AUTO_TYPES.has(t) ? "auto" : "approval_required";
}
