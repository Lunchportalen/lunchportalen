import type { NextRequest } from "next/server";

import { runRollout } from "@/lib/experiments/rollout";
import { makeRid } from "@/lib/http/rid";
import { readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

function okJson(ridValue: string, data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, rid: ridValue, data }), { status, headers: JSON_HEADERS });
}

function errJson(ridValue: string, error: string, status: number, message?: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      rid: ridValue,
      error,
      message: message ?? error,
      status,
    }),
    { status, headers: JSON_HEADERS },
  );
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * POST { experimentId, mode: "prepare" | "apply", confirmApply?, forceVariantId? }
 * - prepare | apply: same proposal payload; server never writes CMS.
 * - mode "apply" requires confirmApply === true (explicit editor handoff intent).
 * Response: { ok: true, data } | { ok: false, error } (no rid).
 */
export async function POST(request: NextRequest) {
  const requestId = makeRid("exp_rollout");
  const s = await scopeOr401(request);
  if (!s.ok) return errJson(requestId, "Ikke innlogget.", 401);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return errJson(requestId, "Ingen tilgang.", 403);

  const body = await readJson(request);
  const experimentId = typeof body.experimentId === "string" ? body.experimentId.trim() : "";
  const modeRaw = typeof body.mode === "string" ? body.mode.trim().toLowerCase() : "";
  const mode = modeRaw === "apply" ? "apply" : modeRaw === "prepare" ? "prepare" : "";
  const confirmApply = body.confirmApply === true;
  const forceVariantId =
    typeof body.forceVariantId === "string" && body.forceVariantId.trim() ? body.forceVariantId.trim() : undefined;

  if (!experimentId || !isUuid(experimentId)) {
    return errJson(requestId, "experimentId (uuid) kreves.", 422);
  }
  if (mode !== "prepare" && mode !== "apply") {
    return errJson(requestId, "mode må være prepare eller apply.", 422);
  }

  if (mode === "apply" && !confirmApply) {
    return errJson(requestId, "apply krever confirmApply: true (eksplisitt flagg).", 422);
  }

  const out = await runRollout(experimentId, mode, { forceVariantId });
  if (out.ok === false) {
    return errJson(requestId, out.error, 422);
  }

  return okJson(
    requestId,
    {
      rolloutPlan: out.rolloutPlan,
      applied: out.applied,
      contentPayload: out.contentPayload,
      winner: {
        variantId: out.winner.winnerVariantId,
        confidence: out.winner.confidence,
        reason: out.winner.reason,
        pValue: out.winner.pValue,
        significant: out.winner.significant,
        compared: out.winner.compared,
        editorPrep: out.winner.editorPrep,
      },
      pageId: out.pageId,
      variantId: out.variantId,
      mode: out.mode,
    },
    200,
  );
}
