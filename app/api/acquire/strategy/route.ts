export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { generateStrategy } from "@/lib/acquire/strategy";
import { auditLog } from "@/lib/core/audit";
import { withTimeout } from "@/lib/core/timeout";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

function isTimeoutErr(e: unknown): boolean {
  return e instanceof Error && e.message === "TIMEOUT";
}

/**
 * POST: generer M&A-strategi-utkast (kun etter eksplisitt handling — ikke auto-load).
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.acquire.strategy.POST", ["superadmin"]);
    if (deny) return deny;

    try {
      const strategy = await withTimeout(generateStrategy(), 25_000);
      opsLog("api_acquire_strategy_POST", { rid: gate.ctx.rid });
      await auditLog({
        action: "acquire_strategy_generated",
        entity: "acquire",
        metadata: { rid: gate.ctx.rid, preview: String(strategy).slice(0, 200) },
      });
      return jsonOk(gate.ctx.rid, { strategy }, 200);
    } catch (e) {
      if (isTimeoutErr(e)) {
        return jsonErr(gate.ctx.rid, "Strategi tok for lang tid (timeout).", 504, "ACQUIRE_STRATEGY_TIMEOUT", e);
      }
      return jsonErr(gate.ctx.rid, "Kunne ikke generere strategi.", 500, "ACQUIRE_STRATEGY_FAILED", e);
    }
  });
}
