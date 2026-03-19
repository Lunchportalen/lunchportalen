/**
 * Best-effort client-side logging for editor-AI metrics.
 * Never throws; never blocks UI. On 4xx/5xx or network failure the client does not retry.
 * Delivery success is not guaranteed; do not assume "logEditorAiEvent called" implies "event stored".
 * Logs to console in dev and sends to API for server persistence (trinn 2).
 * AI errors are logged with [EDITOR_AI_ERROR] for clearer observability.
 */

import type { EditorAiEvent } from "./editorAiMetricsTypes";

const EDITOR_AI_METRICS_API = "/api/editor-ai/metrics";

export function logEditorAiEvent(evt: EditorAiEvent) {
  try {
    if (process.env.NODE_ENV === "development") {
      if (evt.type === "ai_error") {
        console.warn("[EDITOR_AI_ERROR]", (evt as { feature?: string; message: string; kind?: string }).message, {
          feature: (evt as { feature?: string }).feature,
          kind: (evt as { kind?: string }).kind,
        });
      } else if (evt.type === "media_error") {
        const e = evt as { message: string; kind: string };
        console.warn("[EDITOR_MEDIA_ERROR]", e.message, { kind: e.kind });
      } else if (evt.type === "builder_warning") {
        const e = evt as { feature: string; message: string; count?: number };
        console.warn("[EDITOR_BUILDER_WARNING]", e.message, { feature: e.feature, count: e.count });
      } else if (evt.type === "content_error") {
        const e = evt as { message: string; kind: string };
        console.warn("[EDITOR_CONTENT_ERROR]", e.message, { kind: e.kind });
      } else {
        console.log("[EDITOR_AI]", evt);
      }
    }
    fetch(EDITOR_AI_METRICS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evt),
      credentials: "include",
      keepalive: true,
    })
      .then((res) => {
        if (process.env.NODE_ENV === "development" && !res.ok) {
          console.warn("[EDITOR_AI_METRICS] API returned", res.status, res.statusText);
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[EDITOR_AI_METRICS] Failed to send event:", err instanceof Error ? err.message : String(err));
        }
      });
  } catch {
    // no-op
  }
}
