import "server-only";

const LOW_RISK = new Set(["log", "analyze", "recommend"]);

function normType(action: unknown): string {
  if (action && typeof action === "object" && !Array.isArray(action)) {
    const o = action as Record<string, unknown>;
    const t = o.type ?? o.action;
    if (typeof t === "string") return t.trim().toLowerCase();
  }
  return "";
}

/**
 * Deterministic risk gate: only whitelisted types may auto-run.
 */
export function classifyAction(action: unknown): "auto" | "requires_approval" {
  const t = normType(action);
  if (!t) return "requires_approval";
  return LOW_RISK.has(t) ? "auto" : "requires_approval";
}
