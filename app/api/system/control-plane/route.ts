/**
 * GET /api/system/control-plane
 * Control-plane observability: AI/CMS/DS strict flags, compliance %, recent warnings.
 * Auth: superadmin only (same family as /api/system/ai/health).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { getControlPlaneSnapshot } from "@/lib/system/controlPlaneMetrics";
import { getControlCoverageReport } from "@/lib/system/controlCoverage";

const allowedRoles = ["superadmin"] as const;

function pickResponse(x: { res?: Response; response?: Response } | Response | null): Response {
  if (x instanceof Response) return x;
  const r = x?.res ?? x?.response;
  if (r) return r;
  return jsonErr("no_rid", "Role-guard returnerte ingen Response.", 500, "guard_contract_mismatch");
}

function hasCtx(x: unknown): x is { ctx: { rid: string } } {
  return !!x && typeof x === "object" && x !== null && "ctx" in x && (x as { ctx: unknown }).ctx != null;
}

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);

  if (!hasCtx(s)) {
    return pickResponse(s as { res?: Response; response?: Response } | null);
  }

  const denied = requireRoleOr403(s.ctx, "system.control-plane", allowedRoles);

  if (denied) {
    if (denied instanceof Response) return denied;
    if (typeof denied === "object" && ("res" in denied || "response" in denied)) {
      return pickResponse(denied as { res?: Response; response?: Response });
    }
    return jsonErr(
      s.ctx.rid,
      "Role-guard returnerte ukjent type.",
      500,
      "guard_contract_mismatch",
      { typeofDenied: typeof denied },
    );
  }

  try {
    const snapshot = getControlPlaneSnapshot();
    const repo = getControlCoverageReport();
    const data = {
      ...snapshot,
      staticRepo: {
        health: repo.metrics,
        aiViolations: repo.aiViolations,
        cmsViolations: repo.cmsViolations,
        growthViolations: repo.growthViolations,
      },
    };
    return jsonOk(s.ctx.rid, data, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(s.ctx.rid, msg, 500, "CONTROL_PLANE_SNAPSHOT_FAILED");
  }
}
