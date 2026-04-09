export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import {
  executeAiRecommendationApply,
  parseAiRecommendationApplyRequest,
} from "@/lib/ai/recommendationActions";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { scheduleAuditEvent } from "@/lib/security/audit";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

/**
 * POST /api/ai/recommendation/apply
 * Superadmin: execute governance / billing actions from AI dashboard recommendations.
 */
export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const { ctx } = gate;
  const { rid } = ctx;

  const denyRole = requireRoleOr403(ctx, ["superadmin"]);
  if (denyRole) return denyRole;

  const body = await readJson(req);
  const parsed = parseAiRecommendationApplyRequest(body);
  if (!parsed) {
    return jsonErr(rid, "Ugyldig body (action + payload påkrevd).", 400, "INVALID_BODY");
  }

  const actorUserId = ctx.scope.userId ?? null;
  const actorEmail = ctx.scope.email ?? null;

  try {
    const result = await executeAiRecommendationApply({
      req: parsed,
      actorUserId,
      actorEmail,
      rid,
    });
    return jsonOk(rid, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      msg === "INVALID_COMPANY_ID"
        ? "INVALID_COMPANY_ID"
        : msg === "INVALID_TOOL"
          ? "INVALID_TOOL"
          : msg === "INVALID_NOTE"
            ? "INVALID_NOTE"
            : msg === "INVALID_HISTORY_ID" || msg === "HISTORY_NOT_FOUND"
              ? "INVALID_HISTORY"
              : msg === "ROLLBACK_NOT_ALLOWED_FOR_DRY_RUN" || msg === "ALREADY_ROLLED_BACK"
                ? "ROLLBACK_CONFLICT"
                : msg === "IDEMPOTENCY_KEY_CONFLICT"
              ? "IDEMPOTENCY_KEY_CONFLICT"
              : msg.startsWith("COMPANY_GOV_WRITE_FAILED") ||
                    msg.startsWith("PLATFORM_GOV_WRITE_FAILED") ||
                    msg.startsWith("COMPANY_FLAG_") ||
                    msg.startsWith("APPLY_LOG_INSERT_FAILED") ||
                    msg.startsWith("ROLLBACK_") ||
                    msg.startsWith("PLATFORM_RESTORE_FAILED") ||
                    msg.startsWith("COMPANY_RESTORE_FAILED")
                  ? "APPLY_PERSIST_FAILED"
                  : "APPLY_FAILED";

    scheduleAuditEvent({
      companyId: null,
      userId: actorUserId,
      action: "ai_recommendation_apply",
      resource: "ai_recommendation",
      metadata: {
        ok: false,
        rid,
        action: parsed.action,
        payload: parsed.payload,
        recommendation_id: parsed.recommendation_id,
        error: msg.slice(0, 2000),
        code,
      },
    });

    const status =
      code === "INVALID_COMPANY_ID" ||
      code === "INVALID_TOOL" ||
      code === "INVALID_NOTE" ||
      code === "INVALID_HISTORY" ||
      code === "ROLLBACK_CONFLICT" ||
      code === "IDEMPOTENCY_KEY_CONFLICT"
        ? 400
        : 500;
    return jsonErr(rid, "Kunne ikke utføre handlingen.", status, code, msg);
  }
  });
}
