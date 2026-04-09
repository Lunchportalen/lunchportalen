export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** POST: logg cockpit-handling til ai_activity_log (superadmin). */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("sales_cockpit_log");
  const body = await readJson(req);
  const action = typeof body.action === "string" ? body.action.trim().slice(0, 80) : "";
  if (!action) {
    return jsonErr(rid, "action er påkrevd.", 422, "VALIDATION_ERROR");
  }
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};

  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", "sales_cockpit_log");
    if (!ok) {
      return jsonOk(rid, { logged: false }, 200);
    }
    const { error } = await admin.from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: `sales_cockpit_${action}`,
        actor_user_id: gate.ctx.scope?.email ?? null,
        metadata: { ...metadata, source: "sales_cockpit" },
        tool: "sales_cockpit",
      }),
    );
    if (error) {
      console.error("[SALES_COCKPIT_LOG]", error.message);
      return jsonOk(rid, { logged: false }, 200);
    }
    return jsonOk(rid, { logged: true }, 200);
  } catch (e) {
    console.error("[SALES_COCKPIT_LOG_FATAL]", e);
    return jsonErr(rid, "Logging feilet.", 500, "COCKPIT_LOG_FAILED");
  }
  });
}
