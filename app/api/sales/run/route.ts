export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { closeDeal } from "@/lib/sales/close";
import { generateOutreach } from "@/lib/sales/outreach";
import { bookMeeting } from "@/lib/sales/meeting";
import { processLead } from "@/lib/sales/pipelineFull";
import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { isProductionMode } from "@/lib/runtime/mode";
import { trackRequest } from "@/lib/sre/metrics";

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.sales.run.POST", ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid;
    traceRequest(rid, "/api/sales/run");
    structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/sales/run" } });
    trackRequest();

    if (!isProductionMode()) {
      console.log("[LIVE_SYSTEM]", { rid, blocked: "NOT_IN_PRODUCTION" });
      return jsonErr(rid, "Ikke i produksjonsmodus (PRODUCTION_MODE).", 403, "NOT_IN_PRODUCTION");
    }

    try {
      const body = await readJson(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return jsonErr(rid, "Ugyldig kropp.", 422, "INVALID_BODY");
      }

      const action = (body as { action?: unknown }).action;
      if (action === "close_deal") {
        const closing = closeDeal(body);
        console.log("[LIVE_SYSTEM]", { rid, lead: null, pipeline: null, closing });
        return jsonOk(rid, { closing }, 200);
      }

      const lead = (body as { lead?: unknown }).lead;
      if (!lead || typeof lead !== "object" || Array.isArray(lead)) {
        return jsonErr(rid, "Mangler lead-objekt.", 422, "MISSING_LEAD");
      }

      const leadObj = lead as Record<string, unknown>;
      const pipeline = processLead(leadObj);
      const outreach = await generateOutreach(leadObj);

      const requestMeeting = (body as { requestMeeting?: unknown }).requestMeeting === true;
      const meeting = requestMeeting ? bookMeeting(leadObj) : null;

      console.log("[LIVE_SYSTEM]", { rid, lead: leadObj, pipeline, outreach: "[redacted]", meeting });

      return jsonOk(rid, { pipeline, outreach, meeting }, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Salgskjøring feilet.";
      return jsonErr(rid, message, 500, "SALES_RUN_FAIL", e);
    }
  });
}
