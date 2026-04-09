export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { processCustomer } from "@/lib/business/pipeline";
import { recordRealRevenue } from "@/lib/business/revenueTrack";
import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { isProductionMode } from "@/lib/runtime/mode";
import { closeDeal } from "@/lib/sales/close";
import { trackRequest } from "@/lib/sre/metrics";

export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.business.run.POST", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  traceRequest(rid, "/api/business/run");
  structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/business/run" } });
  trackRequest();

  try {
    const body = await readJson(req);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonErr(rid, "Ugyldig kropp.", 422, "INVALID_BODY");
    }

    const rec = body as Record<string, unknown>;
    if (rec.action === "close_deal") {
      const closing = closeDeal(body);
      console.log("[EXECUTION]", { rid, stage: "business", closing });
      return jsonOk(rid, { closing }, 200);
    }

    const result = processCustomer(body);

    const approve = rec.approveRevenue === true;
    const revenueRaw = rec.revenueAmount;
    const revenueAmount =
      typeof revenueRaw === "number" && Number.isFinite(revenueRaw)
        ? revenueRaw
        : typeof revenueRaw === "string" && revenueRaw.trim() !== ""
          ? Number(revenueRaw)
          : NaN;

    let revenueRecorded = false as boolean;
    if (approve && Number.isFinite(revenueAmount) && revenueAmount > 0) {
      if (!isProductionMode()) {
        return jsonErr(rid, "Inntektsregistrering krever PRODUCTION_MODE=true.", 403, "NOT_IN_PRODUCTION");
      }
      await recordRealRevenue(revenueAmount, { rid, route: "business_run" });
      revenueRecorded = true;
    }

    console.log("[EXECUTION]", { rid, stage: "business", result, revenueRecorded });

    return jsonOk(rid, { customer: result, revenueRecorded }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Business-kjøring feilet.";
    return jsonErr(rid, message, 500, "BUSINESS_FAIL", e);
  }
}
