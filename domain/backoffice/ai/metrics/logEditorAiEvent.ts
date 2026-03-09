/**
 * Best-effort client-side logging for editor-AI metrics.
 * Never throws; never blocks UI.
 * Logs to console in dev and sends to API for server persistence (trinn 2).
 */

import type { EditorAiEvent } from "./editorAiMetricsTypes";

const EDITOR_AI_METRICS_API = "/api/editor-ai/metrics";

export function logEditorAiEvent(evt: EditorAiEvent) {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("[EDITOR_AI]", evt);
    }
    fetch(EDITOR_AI_METRICS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evt),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // no-op
  }
}
