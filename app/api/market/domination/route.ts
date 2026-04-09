export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { withTimeout } from "@/lib/core/timeout";
import { analyzeCompetitors } from "@/lib/market/competitors";
import { generateDominationPlan } from "@/lib/market/domination";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

function isTimeoutErr(e: unknown): boolean {
  return e instanceof Error && e.message === "TIMEOUT";
}

/**
 * GET: statisk konkurrentliste (ingen AI). Plan genereres via POST.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.market.domination.GET", ["superadmin"]);
  if (deny) return deny;

  const competitors = analyzeCompetitors();
  opsLog("api_market_domination_GET", { rid: gate.ctx.rid, competitors: competitors.length });
  await auditLog({
    action: "market_domination_competitors_view",
    entity: "market",
    metadata: { rid: gate.ctx.rid },
  });
  return jsonOk(gate.ctx.rid, { competitors }, 200);
}

/**
 * POST: generer domineringsplan (eksplisitt godkjenning via klikk).
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.market.domination.POST", ["superadmin"]);
    if (deny) return deny;

    try {
      const plan = await withTimeout(generateDominationPlan(), 25_000);
      opsLog("api_market_domination_POST", { rid: gate.ctx.rid });
      await auditLog({
        action: "market_domination_plan_generated",
        entity: "market",
        metadata: { rid: gate.ctx.rid, preview: String(plan).slice(0, 200) },
      });
      return jsonOk(gate.ctx.rid, { plan }, 200);
    } catch (e) {
      if (isTimeoutErr(e)) {
        return jsonErr(gate.ctx.rid, "Domineringsplan tok for lang tid (timeout).", 504, "DOMINATION_TIMEOUT", e);
      }
      return jsonErr(gate.ctx.rid, "Kunne ikke generere plan.", 500, "DOMINATION_FAILED", e);
    }
  });
}
