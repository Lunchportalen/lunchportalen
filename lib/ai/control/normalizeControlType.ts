/**
 * Single normalization for governance / ethics / risk across org actions, roadmap steps, and CEO strings.
 */

export function normalizeControlType(action: unknown): string {
  if (typeof action === "string") {
    const s = action.trim();
    if (s === "OPTIMIZE_PAGE") return "optimize";
    if (s === "RUN_EXPERIMENT") return "experiment";
    return s;
  }
  if (action != null && typeof action === "object") {
    const o = action as Record<string, unknown>;
    if (typeof o.type === "string" && o.type.trim()) return o.type.trim();
    if (typeof o.action === "string" && o.action.trim()) return o.action.trim();
  }
  return "";
}
