import "server-only";

import type { ExperimentEventType, TrackEventInput } from "@/lib/experiments/types";
import { onEvent } from "@/lib/pos/eventHandler";
import { supabaseAdmin } from "@/lib/supabase/admin";

const EVENTS: ExperimentEventType[] = ["view", "impression", "click", "conversion"];

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Persist one experiment event (append-only). No CMS mutation.
 */
export async function trackEvent(input: TrackEventInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const experimentId = String(input.experimentId ?? "").trim();
  const variantId = String(input.variantId ?? "").trim();
  const eventType = input.eventType;

  if (!experimentId || !variantId || !EVENTS.includes(eventType)) {
    return { ok: false, error: "Invalid payload" };
  }

  let userUuid: string | null = null;
  if (input.userId != null && String(input.userId).trim()) {
    const u = String(input.userId).trim();
    if (!isUuid(u)) return { ok: false, error: "userId must be a UUID when provided" };
    userUuid = u;
  }

  const supabase = supabaseAdmin();

  try {
    const { error } = await supabase.from("experiment_events").insert({
      experiment_id: experimentId,
      variant_id: variantId,
      user_id: userUuid,
      event_type: eventType,
    });
    if (error) return { ok: false, error: error.message || "Insert failed" };
    try {
      onEvent({
        type: "variant_performance_updated",
        experiment_id: experimentId,
        variant_id: variantId,
        experiment_event_type: eventType,
      });
    } catch {
      /* POS må ikke bryte sporingskjeden */
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Insert failed";
    return { ok: false, error: msg };
  }
}
