import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PREVIEW_MAX = 8000;

export type AIEvent = {
  type: "ai_run" | "ai_result" | "ai_error" | "ai_conversion";
  key?: string;
  input?: string;
  output?: string;
  metadata?: Record<string, unknown>;
};

function truncate(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  if (s.length <= PREVIEW_MAX) return s;
  return `${s.slice(0, PREVIEW_MAX)}…`;
}

/**
 * Persists to `ai_activity_log` with action allowlist `agent_run` + structured metadata (no new columns).
 * Best-effort; never throws.
 */
export async function persistAiTrackEvent(event: AIEvent): Promise<void> {
  const meta: Record<string, unknown> = {
    track_event_type: event.type,
    ...(typeof event.key === "string" && event.key.trim() ? { prompt_key: event.key.trim() } : {}),
    ...(event.input !== undefined ? { input_preview: truncate(event.input) } : {}),
    ...(event.output !== undefined ? { output_preview: truncate(event.output) } : {}),
    ...(event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata) ? event.metadata : {}),
  };

  const row = buildAiActivityLogRow({
    action: "agent_run",
    metadata: meta,
  });

  const status =
    event.type === "ai_error" ? "error" : event.type === "ai_result" || event.type === "ai_conversion" ? "success" : null;

  const { error } = await supabaseAdmin().from("ai_activity_log").insert({
    ...row,
    status,
    duration_ms: null,
  } as Record<string, unknown>);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[AI_TRACK_INSERT_FAILED]", error.message);
  }
}

/**
 * Non-blocking tracking: server uses direct insert; browser may POST to `/api/ai/track`.
 * Never throws to callers.
 */
export async function trackAIEvent(event: AIEvent): Promise<void> {
  try {
    if (typeof window === "undefined") {
      await persistAiTrackEvent(event);
      return;
    }
    await fetch("/api/ai/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[AI_TRACK_FAIL]", e);
    try {
      await persistAiTrackEvent(event);
    } catch (e2) {
      // eslint-disable-next-line no-console
      console.log("[AI_TRACK_FAIL]", e2);
    }
  }
}
