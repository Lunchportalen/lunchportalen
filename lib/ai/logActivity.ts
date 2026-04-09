/**
 * Best-effort AI route logging to ai_activity_log (service role). Fire-and-forget; never throws to callers.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePageId(nodeId: string | null | undefined): string | null {
  if (!nodeId || typeof nodeId !== "string") return null;
  const t = nodeId.trim();
  return UUID_RE.test(t) ? t : null;
}

export type LogActivityParams = {
  rid: string;
  /** Route bucket: improve = /api/ai/block, audit = page audit, image = image-generator, batch reserved. */
  action: "improve" | "audit" | "image" | "batch";
  blockId?: string | null;
  nodeId?: string | null;
  status: "success" | "error";
  /** Wall-clock duration in ms (clamped). */
  duration: number;
  actorUserId?: string | null;
  metadataExtra?: Record<string, unknown>;
};

/**
 * Persists one row; does not await on the request critical path — call as void logActivity(...).
 */
export function logActivity(params: LogActivityParams): void {
  void (async () => {
    try {
      const pageId = parsePageId(params.nodeId ?? null);
      // Always persist wall-clock ms to duration_ms (routes pass Date.now() - start).
      const raw = params.duration;
      const durationMs = Math.max(
        0,
        Math.min(typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 0, 86_400_000)
      );

      const base = buildAiActivityLogRow({
        action: params.action,
        page_id: pageId,
        actor_user_id: params.actorUserId ?? null,
        metadata: {
          ...(params.metadataExtra && typeof params.metadataExtra === "object" ? params.metadataExtra : {}),
          source: "ai_route_log",
        },
      });

      const { error } = await supabaseAdmin()
        .from("ai_activity_log")
        .insert({
          ...base,
          rid: params.rid,
          block_id: params.blockId ?? null,
          node_id: params.nodeId ?? null,
          status: params.status,
          duration_ms: durationMs,
        } as Record<string, unknown>);

      if (error) {
        console.error("[AI_LOG_FAILED]", error.message);
      }
    } catch (e) {
      console.error("[AI_LOG_FAILED]", e);
    }
  })();
}
