// app/api/admin/company/status/set/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { scopeOr401 } from "@/lib/http/routeGuard";

/**
 * POST /api/admin/company/status/set — **deprecated / closed**
 *
 * Firmalivssyklus (PENDING|ACTIVE|PAUSED|CLOSED) er superadmin-beslutning.
 * Canonical skrivebane: POST `/api/superadmin/companies/set-status` (+ `applyCompanyLifecycleStatus`).
 * company_admin skal aldri mutere `companies.status` via admin-API.
 */
export async function POST(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  return jsonErr(
    gate.ctx.rid,
    "Firmastatus endres ikke via denne endepunktet. Bruk superadmin-flyten (POST /api/superadmin/companies/set-status).",
    403,
    "FORBIDDEN",
    { reason: "superadmin_only", deprecatedRoute: "/api/admin/company/status/set" }
  );
}

export async function GET(req: NextRequest) {
  const rid = String(req.headers.get("x-rid") ?? "").trim() || makeRid("rid");
  return jsonErr(rid, "Bruk POST.", 405, "METHOD_NOT_ALLOWED", { method: "GET" });
}
