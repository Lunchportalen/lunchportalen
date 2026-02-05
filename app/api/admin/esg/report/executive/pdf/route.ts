// app/api/admin/esg/report/executive/pdf/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { jsonErr } from "@/lib/http/respond";
import { buildExecutiveOnePagerPdf } from "@/lib/esg/pdf-executive";

function pdfResponse(bytes: Uint8Array, filename: string, rid: string) {
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "x-lp-rid": rid,
    },
  });
}

function osloMonthStartISO() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = fmt.format(new Date());
  return today.slice(0, 8) + "01"; // YYYY-MM-01
}

function addMonths(isoMonth01: string, delta: number) {
  const [y, m] = isoMonth01.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function safeFilenamePart(v: any) {
  const s = String(v ?? "").trim();
  const cleaned = s.replace(/[^\w\-]+/g, "_");
  return cleaned.length ? cleaned : "firma";
}

function clampYear(n: number) {
  const fallback = Number(osloMonthStartISO().slice(0, 4));
  if (!Number.isFinite(n)) return fallback;
  const y = Math.trunc(n);
  if (y < 2000) return 2000;
  if (y > 2100) return 2100;
  return y;
}

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  // 1) Scope
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;
  const ctx = a.ctx;

  // 2) Role gate (company_admin)
  const b = requireRoleOr403(ctx, ["company_admin"]);
  if (b instanceof Response) return b;

  // 3) Company scope gate
  const c = requireCompanyScopeOr403(ctx);
  if (c instanceof Response) return c;

  const companyId = String(ctx.scope.companyId);

  // 4) Params
  const url = new URL(req.url);
  const year = clampYear(Number(url.searchParams.get("year") ?? osloMonthStartISO().slice(0, 4)));

  const thisMonth = osloMonthStartISO();
  const fromMonth = addMonths(thisMonth, -11);

  // 5) Data
  const supabase = await supabaseServer();

  const { data: months, error: mErr } = await supabase
    .from("esg_monthly_snapshots")
    .select(
      "month, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score"
    )
    .eq("company_id", companyId)
    .gte("month", fromMonth)
    .lte("month", thisMonth)
    .order("month", { ascending: true });

  if (mErr) return jsonErr(ctx.rid, "Kunne ikke hente månedssnapshots.", 500, { code: "db_error", detail: { message: mErr.message } });

  const { data: yearly, error: yErr } = await supabase
    .from("esg_yearly_snapshots")
    .select(
      "year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score, computed_version, locked_at, lock_hash, lock_version"
    )
    .eq("company_id", companyId)
    .eq("year", year)
    .maybeSingle();

  if (yErr) return jsonErr(ctx.rid, "Kunne ikke hente årssnapshot.", 500, { code: "db_error", detail: { message: yErr.message } });

  const { data: cRow, error: cErr } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) return jsonErr(ctx.rid, "Kunne ikke hente firmanavn.", 500, { code: "db_error", detail: { message: cErr.message } });

  const companyName = (cRow as any)?.name ?? null;

  // 6) Build PDF
  const bytes = await buildExecutiveOnePagerPdf({
    companyName,
    companyId,
    year,
    yearly: yearly ?? null,
    months: months ?? [],
    generatedAtISO: new Date().toISOString(),
    computedVersion: (yearly as any)?.computed_version ?? "v1",
    signature: {
      lockedAt: (yearly as any)?.locked_at ?? null,
      lockHash: (yearly as any)?.lock_hash ?? null,
      lockVersion: (yearly as any)?.lock_version ?? null,
    },
  });

  const safe = safeFilenamePart(companyName);
  return pdfResponse(bytes, `Executive_ESG_${safe}_${year}.pdf`, ctx.rid);
}

