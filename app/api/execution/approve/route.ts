export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { approveAction } from "@/lib/execution/approval";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";

export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.execution.approve.POST", ["superadmin"]);
  if (deny) return deny;

  try {
    const body = await readJson(req);
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id) {
      return jsonErr(gate.ctx.rid, "id er påkrevd.", 422, "VALIDATION_ERROR");
    }

    const result = await approveAction(id);
    if (result.ok === false) {
      return jsonErr(gate.ctx.rid, "Godkjenning avvist.", 409, result.reason, { id });
    }

    return jsonOk(gate.ctx.rid, { id }, 200);
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Godkjenning feilet.", 500, "EXECUTION_APPROVE_FAILED", e);
  }
}
