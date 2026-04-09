/**
 * Autonomy layer outcome logging (append-only via `ai_autonomy_log`).
 */
import "server-only";

import { trackAIEvent } from "@/lib/ai/tracking";

export { trackAutonomyOutcome as trackOutcome, type AutonomyOutcomePayload } from "./autonomy/autonomyAttribution";

/** Revenue / conversion signal for prompt learning (best-effort; never throws). */
export async function trackConversion(data: {
  source: "ai";
  key: string;
  revenue?: number;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    await trackAIEvent({
      type: "ai_conversion",
      key: data.key,
      metadata: {
        revenue: typeof data.revenue === "number" && Number.isFinite(data.revenue) ? data.revenue : 0,
        context: data.context && typeof data.context === "object" && !Array.isArray(data.context) ? data.context : {},
        attribution_source: data.source,
      },
    });
  } catch {
    /* fail-safe */
  }
}
