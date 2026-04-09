export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { buildInvestorValuationResult } from "@/lib/finance/runInvestorValuation";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/**
 * POST: investor-grade indikatorer (ARR, multiple, scenarioer) — kun lesing + valgfri audit-logg.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("investor_valuation");

  const body = await readJson(req).catch(() => ({}));
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const log = o.log === true;

  try {
    const data = await buildInvestorValuationResult({ log, rid });
    /** Additivt alias — `growthRate` er fasit i modellen. */
    return jsonOk(rid, { ...data, growth: data.growthRate }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "INVESTOR_VALUATION_FAILED");
  }
}
