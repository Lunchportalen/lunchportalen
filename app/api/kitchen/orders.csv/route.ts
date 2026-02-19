export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import { jsonErr } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { loadKitchenFeed } from "@/lib/kitchen/ordersFeed";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const auth = await scopeOr401(req);
  if (auth.ok === false) return auth.response;

  const { rid, scope } = auth.ctx;
  const requestId = rid;
  const denyRole = requireRoleOr403(auth.ctx, "api.kitchen.orders.csv.GET", ["kitchen", "superadmin"]);
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

    const lines: string[] = [
      ["date", "slot", "company_id", "company_name", "location_id", "location_name", "user_id", "name", "dept", "note"]
        .map(csvEscape)
        .join(","),
    ];

    for (const slot of feed.slots) {
      for (const company of slot.companies) {
        for (const location of company.locations) {
          for (const employee of location.employees) {
            lines.push(
              [
                feed.date,
                slot.slot,
                company.companyId,
                company.companyName,
                location.locationId,
                location.locationName,
                employee.userId,
                employee.name,
                employee.dept ?? "",
                employee.note ?? "",
              ]
                .map(csvEscape)
                .join(",")
            );
          }
        }
      }
    }

    return new Response(lines.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="kitchen_orders_${feed.date}.csv"`,
        "cache-control": "no-store",
        "x-rid": requestId,
      },
    });
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke generere CSV.", 500, "KITCHEN_CSV_FAILED", {
      message: safeStr(e?.message ?? e),
    });
  }
}
