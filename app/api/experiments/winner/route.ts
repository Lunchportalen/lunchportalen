import type { NextRequest } from "next/server";

import { calculateResults } from "@/lib/experiments/evaluator";
import type { ExperimentResults } from "@/lib/experiments/types";
import { selectWinner } from "@/lib/experiments/winner";
import { makeRid } from "@/lib/http/rid";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

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
 * GET ?experimentId=uuid — statistical winner + editor prep (superadmin).
 * Response: { ok: true, data } | { ok: false, error } (no rid).
 */
export async function GET(request: NextRequest) {
  const requestId = makeRid("exp_winner");
  const s = await scopeOr401(request);
  if (!s.ok) return errJson(requestId, "Ikke innlogget.", 401);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return errJson(requestId, "Ingen tilgang.", 403);

  const experimentId = (request.nextUrl.searchParams.get("experimentId") ?? "").trim();
  if (!experimentId || !isUuid(experimentId)) {
    return errJson(requestId, "experimentId (uuid) kreves.", 422);
  }

  const out = await calculateResults(experimentId);
  if (out.ok === false) {
    return errJson(requestId, out.error, 500);
  }

  const results: ExperimentResults = {
    variants: out.results.variants,
    winner: null,
  };
  const w = selectWinner(results);

  return okJson(
    requestId,
    {
      winner: w.winnerVariantId,
      confidence: w.confidence,
      reason: w.reason,
      pValue: w.pValue,
      significant: w.significant,
      compared: w.compared,
      editorPrep: w.editorPrep,
      aggregate: out.results.winner,
      variants: out.results.variants,
    },
    200,
  );
}
