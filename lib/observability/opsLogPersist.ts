import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Best-effort async persist of ops events. Disabled unless AI_OBSERVABILITY_PERSIST=true (avoids DB saturation).
 * Non-blocking: scheduled via queueMicrotask; errors swallowed.
 */
export function queueObservabilityPersist(type: "metric" | "event" | "decision" | "trace", payload: Record<string, unknown>): void {
  if (safeTrim(process.env.AI_OBSERVABILITY_PERSIST) !== "true") return;
  queueMicrotask(() => {
    void persistObservabilityRow(type, payload).catch(() => {
      /* production-safe: never throw into request path */
    });
  });
}

async function persistObservabilityRow(type: string, payload: Record<string, unknown>): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("ai_observability").insert({ type, payload });
  if (error) throw new Error(error.message);
}
