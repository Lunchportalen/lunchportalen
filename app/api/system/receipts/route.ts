
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { osloTodayISODate } from "@/lib/date/oslo";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // scopeOr401: Response ved 401, ellers { ok:true, ctx }
  const a = await scopeOr401(req);
  if (a instanceof Response) return a;

  const ctx = a.ctx;

  // requireRoleOr403: Response ved 403, ellers ok
  const r = requireRoleOr403(ctx, ["superadmin", "kitchen"]);
  if (r instanceof Response) return r;

  const rid = ctx.rid;

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || osloTodayISODate();

  if (!isISODate(date)) {
    return jsonErr(400, rid, "bad_request", "Ugyldig dato. Bruk YYYY-MM-DD.", {
      received: date,
    });
  }

  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("v_receipt_rows")
    .select("*")
    .eq("delivery_date", date)
    .order("company_name", { ascending: true })
    .order("location_name", { ascending: true })
    .order("employee_name", { ascending: true });

  if (error) {
    return jsonErr(500, rid, "db_error", "Kunne ikke hente kvitteringsgrunnlag.", {
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  return jsonOk({
    rid,
    date,
    rows: data ?? [],
  });
}


