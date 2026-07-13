// @enterprise-exclude
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { AIEvent } from "@/lib/ai/tracking";
import { persistAiTrackEvent } from "@/lib/ai/tracking";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
    const rid = makeRid("ai_track");
    try {
      // Fail-closed: telemetry writes require an authenticated session
      // (prevents anonymous telemetry poisoning / unauthenticated DB writes).
      const auth = await getAuthContext({ rid, reqHeaders: req.headers });
      if (!auth.sessionOk || !auth.userId) {
        return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return jsonErr(rid, "Ugyldig JSON.", 400, "INVALID_JSON");
      }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return jsonErr(rid, "Ugyldig body.", 400, "INVALID_BODY");
      }

      const b = body as Record<string, unknown>;
      const type = b.type;
      if (type !== "ai_run" && type !== "ai_result" && type !== "ai_error" && type !== "ai_conversion") {
        return jsonErr(rid, "Ugyldig type.", 400, "INVALID_TYPE");
      }

      const baseMeta =
        b.metadata !== undefined && typeof b.metadata === "object" && !Array.isArray(b.metadata)
          ? { ...(b.metadata as Record<string, unknown>) }
          : {};

      // Server truth only: client-sent company_id is never trusted.
      baseMeta.company_id = auth.company_id ?? null;

      const event: AIEvent = {
        type,
        key: typeof b.key === "string" ? b.key : undefined,
        input: typeof b.input === "string" ? b.input : undefined,
        output: typeof b.output === "string" ? b.output : undefined,
        metadata: baseMeta,
      };

      await persistAiTrackEvent(event);
      return jsonOk(rid, { ok: true }, 200);
    } catch {
      return jsonErr(rid, "Tracking feilet.", 500, "AI_TRACK_FAILED");
    }
  });
}
