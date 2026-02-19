export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { parsePeriodYm } from "@/lib/billing/periodYm";
import { osloPreviousPeriodYm } from "@/lib/date/osloPeriod";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireCompanyScopeOr403, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const { ctx } = gate;
  const rid = ctx.rid;

  const roleDeny = requireRoleOr403(ctx, ["company_admin"]);
  if (roleDeny) return roleDeny;

  const scopeDeny = requireCompanyScopeOr403(ctx);
  if (scopeDeny) return scopeDeny;

  const companyId = safeStr(ctx.scope.companyId);
  if (!companyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "FORBIDDEN");

  const url = new URL(req.url);
  const monthInput = safeStr(url.searchParams.get("month"));
  const month = monthInput || osloPreviousPeriodYm();

  if (!parsePeriodYm(month)) {
    return jsonErr(rid, "month må være på formatet YYYY-MM.", 400, "BAD_REQUEST");
  }

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("esg_monthly")
      .select("month,delivered_count,cancelled_count,delivery_rate,waste_estimate_kg,co2_estimate_kg,generated_at")
      .eq("company_id", companyId)
      .eq("month", month)
      .maybeSingle();

    if (error) {
      return jsonErr(rid, "Kunne ikke hente ESG-data.", 500, "ESG_READ_FAILED");
    }

    const record = data
      ? {
          month: safeStr((data as any).month),
          delivered_count: Number((data as any).delivered_count ?? 0),
          cancelled_count: Number((data as any).cancelled_count ?? 0),
          delivery_rate: Number((data as any).delivery_rate ?? 0),
          waste_estimate_kg: Number((data as any).waste_estimate_kg ?? 0),
          co2_estimate_kg: Number((data as any).co2_estimate_kg ?? 0),
          generated_at: safeStr((data as any).generated_at) || null,
        }
      : null;

    return jsonOk(rid, {
      companyId,
      month,
      record,
    });
  } catch {
    return jsonErr(rid, "Uventet feil ved henting av ESG-data.", 500, "ESG_LATEST_FAILED");
  }
}

