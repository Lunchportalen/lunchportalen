import { getOrdersByTenant } from "@/lib/api/publicOrders";
import { getTenantContext } from "@/lib/api/guard";
import { jsonErr, jsonOk, jsonUnauthorized, makeRid } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public API v1 — ordre (minimal projeksjon, tenant via API-nøkkel).
 * Kontrakt: { ok, rid, data: { version, data } }
 */
export async function GET(req: Request) {
  const rid = makeRid("v1pub");
  try {
    const tenant = getTenantContext(req);
    opsLog("public_api_data_access", {
      rid,
      tenantId: tenant.tenantId,
      route: "/api/v1/public/orders",
      purpose: "tenant_orders_read",
    });
    const { rows } = await getOrdersByTenant(tenant.tenantId, rid);
    return jsonOk(
      rid,
      {
        version: "v1" as const,
        data: rows,
      },
      200,
      { "X-API-Version": "v1", "X-API-Deprecation-Policy": "additive-only" },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_API_KEY") {
      return jsonUnauthorized(rid, "Ugyldig eller manglende API-nøkkel.");
    }
    return jsonErr(rid, "Kunne ikke hente ordre.", 500, "PUBLIC_ORDERS_FAILED", String(e));
  }
}
