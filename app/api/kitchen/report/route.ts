// app/api/kitchen/report/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { isIsoDate } from "@/lib/date/oslo";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import {
  buildKitchenReport,
  parseKitchenDate,
  parseKitchenMode,
  parseKitchenWeekStart,
} from "@/lib/kitchen/report";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await scopeOr401(req);
  if (auth.ok === false) return auth.response;

  const deny = requireRoleOr403(auth.ctx, ["kitchen", "superadmin"]);
  if (deny) return deny;

  const role = safeStr(auth.ctx.scope.role).toLowerCase();
  const mode = parseKitchenMode(req.nextUrl.searchParams.get("mode"));
  const date = parseKitchenDate(req.nextUrl.searchParams.get("date"));
  const weekStart = parseKitchenWeekStart(req.nextUrl.searchParams.get("weekStart"));

  if (!mode) {
    return jsonErr(auth.ctx.rid, "Ugyldig forespørsel.", 400, "BAD_REQUEST");
  }

  if (!isIsoDate(date)) {
    return jsonErr(auth.ctx.rid, "Ugyldig forespørsel.", 400, "BAD_REQUEST");
  }

  if (mode === "week" && !isIsoDate(weekStart)) {
    return jsonErr(auth.ctx.rid, "Ugyldig forespørsel.", 400, "BAD_REQUEST");
  }

  try {
    const report = await buildKitchenReport({
      mode,
      date,
      weekStart,
      scope: {
        role: role === "superadmin" ? "superadmin" : "kitchen",
        company_id: safeStr(auth.ctx.scope.companyId) || null,
        location_id: safeStr(auth.ctx.scope.locationId) || null,
        user_id: safeStr(auth.ctx.scope.userId) || null,
        email: safeStr(auth.ctx.scope.email) || null,
        rid: auth.ctx.rid,
      },
    });

    return jsonOk(auth.ctx.rid, report);
  } catch (error: any) {
    const code = safeStr(error?.code).toUpperCase();

    if (
      code === "BAD_REQUEST" ||
      code === "BAD_MODE" ||
      code === "BAD_DATE" ||
      code === "BAD_WEEK_START"
    ) {
      return jsonErr(auth.ctx.rid, "Ugyldig forespørsel.", 400, "BAD_REQUEST");
    }

    if (code === "FORBIDDEN" || code === "UNAUTHORIZED") {
      return jsonErr(auth.ctx.rid, "Ingen tilgang.", 403, "FORBIDDEN");
    }

    if (code === "MISSING_CONTRACT" || code === "AGREEMENT_MISSING") {
      return jsonErr(auth.ctx.rid, "Mangler aktiv avtale for rapporten.", 422, "MISSING_CONTRACT");
    }

    if (code === "MISSING_DATA") {
      return jsonErr(auth.ctx.rid, "Manglende datagrunnlag for rapporten.", 422, "MISSING_DATA");
    }

    return jsonErr(auth.ctx.rid, "Kunne ikke hente kjøkkenrapport.", 500, "KITCHEN_REPORT_FAILED");
  }
}

