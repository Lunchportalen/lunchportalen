import { normalizeControlType } from "@/lib/ai/control/normalizeControlType";

const ALLOWED = new Set([
  "experiment",
  "variant",
  "optimize",
  "stability_check",
  "create_variant",
]);

export function validateAction(action: unknown): boolean {
  const t = normalizeControlType(action);
  if (!t) return false;
  if (t === "INCREASE_PRICE" || t === "DECREASE_PRICE") return false;
  if (t === "pricing_review") return false;
  return ALLOWED.has(t);
}
