export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { generateLeads } from "@/lib/sales/generator";
import { runOutreach } from "@/lib/sales/outreachScale";
import { processPipeline } from "@/lib/sales/pipelineScale";
import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, q, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { isProductionMode } from "@/lib/runtime/mode";
import { trackRequest } from "@/lib/sre/metrics";

function parsePositiveInt(v: string | null, fallback: number, max: number): number {
  if (v == null || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.sales.scale.GET", ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid;
    traceRequest(rid, "/api/sales/scale");
    structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/sales/scale" } });
    trackRequest();

    if (!isProductionMode()) {
      console.log("[EXECUTION]", { rid, stage: "sales", blocked: "NOT_IN_PRODUCTION" });
      return jsonErr(rid, "Skalering krever PRODUCTION_MODE=true.", 403, "NOT_IN_PRODUCTION");
    }

    try {
      const n = parsePositiveInt(q(req, "n"), 10, 20);
      const outreachCap = parsePositiveInt(q(req, "outreach"), 10, 20);

      const leads = generateLeads(n);
      const piped = processPipeline(leads);
      const outreach = await runOutreach(piped, { maxOutreach: outreachCap });

      console.log("[EXECUTION]", { rid, stage: "sales", leads: n, outreachRows: outreach.length });

      return jsonOk(rid, { leads: piped, outreach }, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Salgs-skala feilet.";
      return jsonErr(rid, message, 500, "SALES_SCALE_FAIL", e);
    }
  });
}
