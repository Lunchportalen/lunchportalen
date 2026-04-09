import type { NextRequest } from "next/server";

import { pickWinner } from "@/lib/ai/experimentWinnerDecision";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { applyExperimentWinnerToCms } from "@/lib/experiments/applyWinnerToCms";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

export const runtime = "nodejs";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(request: NextRequest) {
  return withApiAiEntrypoint(request, "POST", async () => {
    const s = await scopeOr401(request);
    if (!s?.ok) return denyResponse(s);
    const ctx = s.ctx;
    const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
    if (roleDeny) return roleDeny;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
    }
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const experimentId = typeof o?.experimentId === "string" ? o.experimentId.trim() : "";
    if (!experimentId || !isUuid(experimentId)) {
      return jsonErr(ctx.rid, "experimentId (uuid) påkrevd.", 422, "VALIDATION_ERROR");
    }
    const applyProd = o?.applyProd === true;

    const decision = await pickWinner(experimentId);
    opsLog("experiment.resolve.pick_winner", {
      rid: ctx.rid,
      experimentId,
      ok: decision.ok,
      winner: decision.ok ? decision.winnerVariantId : null,
      reason: decision.ok ? decision.reason : decision.reason,
    });

    if (!decision.ok) {
      return jsonErr(ctx.rid, decision.reason, 422, "THRESHOLD_NOT_MET");
    }

    return withCmsPageDocumentGate("api/backoffice/experiments/resolve/POST", async () => {
      const applied = await applyExperimentWinnerToCms({
        experimentId,
        winnerVariantId: decision.winnerVariantId,
        applyProd,
        rid: ctx.rid,
      });
      if (applied.ok === false) {
        return jsonErr(ctx.rid, applied.message, 500, "APPLY_FAILED");
      }
      opsLog("experiment_resolved", {
        rid: ctx.rid,
        experimentId,
        winnerVariantId: decision.winnerVariantId,
        channel: "backoffice",
        applyProd,
      });
      return jsonOk(
        ctx.rid,
        {
          resolved: true,
          winnerVariantId: decision.winnerVariantId,
          applyProd,
          byVariant: decision.byVariant,
        },
        200,
      );
    });
  });
}
