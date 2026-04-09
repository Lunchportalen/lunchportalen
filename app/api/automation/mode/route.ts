export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { isAutoMode } from "@/lib/automation/isAutoMode";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";

/**
 * Leser AI_AUTO_MODE fra server (ingen persistert toggle uten DB).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.automation.mode.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    return jsonOk(
      gate.ctx.rid,
      {
        autoMode: isAutoMode(),
        source: "env:AI_AUTO_MODE",
        hint: "Endring krever server-miljø (ingen klient-løgn).",
      },
      200,
    );
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Kunne ikke lese auto-modus.", 500, "AUTOMATION_MODE_FAILED", e);
  }
}
