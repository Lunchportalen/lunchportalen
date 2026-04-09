export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { buildPipelineActionsList } from "@/lib/pipeline/buildPipelineActions";
import { executeClosingProposals } from "@/lib/sales/executeClosing";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/**
 * Godkjente møteutkast fra «Closing opportunities» (source=ready). Ingen auto-send.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("closing_execute");

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_JSON");
  }

  if (body.confirm !== true) {
    return jsonErr(rid, "Bekreft med confirm: true.", 422, "CONFIRM_REQUIRED");
  }

  const leadIdsRaw = body.leadIds;
  const leadIds = Array.isArray(leadIdsRaw)
    ? leadIdsRaw.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

  if (leadIds.length === 0) {
    return jsonErr(rid, "leadIds er påkrevd.", 422, "LEAD_IDS_REQUIRED");
  }

  const built = await buildPipelineActionsList(rid, { skipLog: true });
  if (!built.ok) {
    return jsonErr(rid, built.error ?? "Kunne ikke bygge pipeline.", 503, "PIPELINE_BUILD_FAILED");
  }

  const exec = await executeClosingProposals(leadIds, {
    rid,
    prioritized: built.prioritized,
    items: built.items,
    mode: "ready",
  });

  return jsonOk(rid, { ok: exec.ok, results: exec.results }, 200);
}
