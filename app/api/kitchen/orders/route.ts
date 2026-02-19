export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { loadKitchenFeed } from "@/lib/kitchen/ordersFeed";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  const auth = await scopeOr401(req);
  if (auth.ok === false) return auth.response;

  const { rid, scope } = auth.ctx;
  const denyRole = requireRoleOr403(auth.ctx, "api.kitchen.orders.GET", ["kitchen", "superadmin"]);
  if (denyRole) return denyRole;

  const date = safeStr(req.nextUrl.searchParams.get("date")) || osloTodayISODate();
  if (!isIsoDate(date)) {
    return jsonErr(rid, "Ugyldig dato. Bruk YYYY-MM-DD.", 400, "BAD_DATE");
  }

  const role = safeStr(scope.role).toLowerCase();
  const scopeCompanyId = safeStr(scope.companyId) || null;
  const scopeLocationId = safeStr(scope.locationId) || null;

  if (role === "kitchen" && (!scopeCompanyId || !scopeLocationId)) {
    return jsonErr(rid, "Scope er ikke tilordnet for kjøkken-bruker.", 403, "SCOPE_NOT_ASSIGNED");
  }

  try {
    const feed = await loadKitchenFeed(date, {
      role: role === "superadmin" ? "superadmin" : "kitchen",
      companyId: scopeCompanyId,
      locationId: scopeLocationId,
    });

    return jsonOk(rid, {
      date: feed.date,
      slots: feed.slots,
    });
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke hente kjøkkenordre.", 500, "KITCHEN_ORDERS_FAILED", {
      message: safeStr(e?.message ?? e),
    });
  }
}
