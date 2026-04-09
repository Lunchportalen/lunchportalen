/**
 * Klar-til-lukking: eksisterende prediksjon + aktivitet (ingen robocall / auto-send).
 */
import { resolvePipelineStage } from "@/lib/pipeline/dealNormalize";
import type { LeadLike } from "@/lib/pipeline/prioritize";
import { readSignalsFromMeta } from "@/lib/pipeline/prioritize";

export function findReadyToClose<T extends LeadLike>(leads: T[]): T[] {
  const list = Array.isArray(leads) ? leads : [];
  return list.filter((l) => {
    const meta =
      l.meta && typeof l.meta === "object" && !Array.isArray(l.meta) ? (l.meta as Record<string, unknown>) : {};
    const prob =
      typeof meta.predicted_probability === "number" && Number.isFinite(meta.predicted_probability)
        ? meta.predicted_probability
        : 0;
    const stage = resolvePipelineStage(l as Record<string, unknown>);
    const sig = readSignalsFromMeta(meta);
    const recent = sig.days_since_last_activity < 3;
    return prob > 70 && stage !== "won" && stage !== "lost" && recent;
  });
}
