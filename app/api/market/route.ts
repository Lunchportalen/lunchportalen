export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { withTimeout } from "@/lib/core/timeout";
import { getMarketBundle } from "@/lib/market/bundle";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

function isTimeoutErr(e: unknown): boolean {
  return e instanceof Error && e.message === "TIMEOUT";
}

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.market.GET", ["superadmin"]);
    if (deny) return deny;

    try {
      const bundle = await withTimeout(getMarketBundle(), 25_000);
      opsLog("api_market_GET", { rid: gate.ctx.rid });
      await auditLog({
        action: "market_category_bundle",
        entity: "market",
        metadata: { rid: gate.ctx.rid },
      });
      return jsonOk(gate.ctx.rid, bundle, 200);
    } catch (e) {
      if (isTimeoutErr(e)) {
        return jsonErr(gate.ctx.rid, "Kategori-motor tok for lang tid (timeout).", 504, "MARKET_TIMEOUT", e);
      }
      return jsonErr(gate.ctx.rid, "Kunne ikke generere kategori-innhold.", 500, "MARKET_BUNDLE_FAILED", e);
    }
  });
}
