import { normalizeControlType } from "@/lib/ai/control/normalizeControlType";

export type ControlRiskLevel = "low" | "medium" | "high";

export function assessRisk(action: unknown): ControlRiskLevel {
  const t = normalizeControlType(action);
  if (t === "experiment" || t === "variant" || t === "create_variant" || t === "stability_check") {
    return "low";
  }
  if (t === "optimize") return "medium";
  return "high";
}
