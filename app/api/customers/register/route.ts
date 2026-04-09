export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { registerCustomer } from "@/lib/business/customers";
import { structuredLog } from "@/lib/core/structuredLog";
import { traceRequest } from "@/lib/core/requestTrace";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { isProductionMode } from "@/lib/runtime/mode";
import { trackRequest } from "@/lib/sre/metrics";

export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.customers.register.POST", ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid;
  traceRequest(rid, "/api/customers/register");
  structuredLog({ type: "request_start", source: "api", rid, payload: { route: "/api/customers/register" } });
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

    const result = registerCustomer(body as Parameters<typeof registerCustomer>[0]);
    console.log("[LIVE_SYSTEM]", { rid, route: "customers_register", result });

    return jsonOk(rid, result, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registrering feilet.";
    return jsonErr(rid, message, 500, "CUSTOMER_FAIL", e);
  }
}
