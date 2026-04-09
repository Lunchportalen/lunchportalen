/**
 * STEP 9 — Experiment mode: deterministic A/B assignment (no PII; stable per session key).
 */

export type RevenueExperimentVariant = "A" | "B";

export type RevenueExperimentDefinition = {
  id: string;
  name: string;
  /** What differs between arms */
  dimension: "spacing.section" | "cta_copy" | "layout.container";
  control: string;
  treatment: string;
};

/** Stable hash 0..1 from string */
function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

export function assignRevenueExperimentVariant(
  experimentId: string,
  sessionKey: string,
  split: number = 0.5,
): RevenueExperimentVariant {
  const u = hashUnit(`${experimentId}:${sessionKey}`);
  return u < split ? "A" : "B";
}

export function resolveExperimentValue(
  def: RevenueExperimentDefinition,
  variant: RevenueExperimentVariant,
): string {
  return variant === "A" ? def.control : def.treatment;
}
