export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { withTimeout } from "@/lib/core/timeout";
import { getBoardData } from "@/lib/board/data";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withLoadGuard } from "@/lib/infra/loadGuard";
import { opsLog } from "@/lib/ops/log";

function isTimeoutErr(e: unknown): boolean {
  return e instanceof Error && e.message === "TIMEOUT";
}

function isLoadErr(e: unknown): boolean {
  return (
    e !== null &&
    typeof e === "object" &&
    "code" in e &&
    (e as { code?: string }).code === "LOAD_LIMIT"
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.board.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const data = await withLoadGuard(() => withTimeout(getBoardData(), 15_000), 50);
    opsLog("api_board_GET", { rid: gate.ctx.rid, arr: data.arr });
    await auditLog({
      action: "board_snapshot_view",
      entity: "board",
      metadata: { rid: gate.ctx.rid },
    });
    return jsonOk(gate.ctx.rid, data, 200);
  } catch (e) {
    if (isTimeoutErr(e)) {
      return jsonErr(gate.ctx.rid, "Board-data tok for lang tid (timeout).", 504, "BOARD_TIMEOUT", e);
    }
    if (isLoadErr(e)) {
      return jsonErr(gate.ctx.rid, "Systemet er midlertidig overbelastet.", 503, "BOARD_LOAD_LIMIT", e);
    }
    return jsonErr(gate.ctx.rid, "Kunne ikke hente board-data.", 500, "BOARD_FAILED", e);
  }
}
