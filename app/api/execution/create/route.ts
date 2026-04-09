export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { addAction, getActionById } from "@/lib/execution/queue";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";

export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.execution.create.POST", ["superadmin"]);
  if (deny) return deny;

  try {
    const body = await readJson(req);
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const type = typeof o.type === "string" ? o.type.trim() : "";
    if (!type) {
      return jsonErr(gate.ctx.rid, "type er påkrevd.", 422, "VALIDATION_ERROR");
    }

    const id = crypto.randomUUID();
    const added = addAction({
      id,
      type,
      payload: o.payload,
      status: "pending",
    });

    if (added.ok === false) {
      opsLog("execution_create_rejected", { rid: gate.ctx.rid, reason: added.reason });
      await auditLog({
        action: "execution_create_rejected",
        entity: "execution",
        metadata: { rid: gate.ctx.rid, reason: added.reason, type },
      });
      return jsonErr(gate.ctx.rid, "Kunne ikke legge handling i kø.", 409, added.reason);
    }

    const action = getActionById(id);
    await auditLog({
      action: "execution_action_created",
      entity: "execution",
      metadata: { rid: gate.ctx.rid, id, type },
    });
    opsLog("execution_create_ok", { rid: gate.ctx.rid, id, type });

    return jsonOk(gate.ctx.rid, { action }, 200);
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Kunne ikke opprette handling.", 500, "EXECUTION_CREATE_FAILED", e);
  }
}
