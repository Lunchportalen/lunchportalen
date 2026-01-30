// app/api/admin/esg/report/pdf/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { jsonErr } from "@/lib/http/respond";
import { buildEsgPdf } from "@/lib/esg/pdf";

/* =========================================================
   PDF response
========================================================= */

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

/* =========================================================
   Helpers
========================================================= */

function isoMonthStart() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = fmt.format(new Date());
  return today.slice(0, 8) + "01";
}

function isIsoDate(v: any): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function safeFilenamePart(v: any) {
  const s = String(v ?? "").trim();
  const cleaned = s.replace(/[^\w\-]+/g, "_");
  return cleaned.length ? cleaned : "firma";
}

function toMonthRangeLast12(toMonth01: string) {
  const [y, m] = toMonth01.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - 11, 1));
  const fromMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { fromMonth, toMonth: toMonth01 };
}

export async function GET(req: NextRequest) {
  // 1) Scope
  const a = await scopeOr401(req);
  if (a instanceof Response) return a;
  const ctx = a.ctx;

  // 2) Role gate (company_admin)
  const b = requireRoleOr403(ctx, ["company_admin"]);
  if (b instanceof Response) return b;

  // 3) Company scope gate
  const c = requireCompanyScopeOr403(ctx);
  if (c instanceof Response) return c;

  const companyId = String(ctx.scope.companyId);

  // 4) Parse params
  const url = new URL(req.url);
  const modeRaw = String(url.searchParams.get("mode") || "year").toLowerCase();
  const mode = modeRaw === "month" ? "month" : "year";

  const nowMonth01 = isoMonthStart();

  const year = Number(url.searchParams.get("year") || nowMonth01.slice(0, 4));
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return jsonErr(400, ctx.rid, "bad_request", "year må være et gyldig år (2000–2100)");
  }

  const month = String(url.searchParams.get("month") || nowMonth01); // YYYY-MM-01
  if (!isIsoDate(month) || !month.endsWith("-01")) {
    return jsonErr(400, ctx.rid, "bad_request", "month må være YYYY-MM-01");
  }

  const { fromMonth, toMonth } = toMonthRangeLast12(month);

  // 5) Data
  const supabase = await supabaseServer();

  // Months (last 12)
  const { data: months, error: mErr } = await supabase
    .from("esg_monthly_snapshots")
    .select(
      "month, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score"
    )
    .eq("company_id", companyId)
    .gte("month", fromMonth)
    .lte("month", toMonth)
    .order("month", { ascending: true });

  if (mErr) return jsonErr(500, ctx.rid, "db_error", "Kunne ikke hente måneder.", { message: mErr.message });

  // Yearly (for signature + summary)
  const { data: yearly, error: yErr } = await supabase
    .from("esg_yearly_snapshots")
    .select(
      "year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score, computed_at, computed_version, locked_at, lock_hash, lock_version"
    )
    .eq("company_id", companyId)
    .eq("year", year)
    .maybeSingle();

  if (yErr) return jsonErr(500, ctx.rid, "db_error", "Kunne ikke hente år.", { message: yErr.message });

  // Company name (optional)
  const { data: cRow, error: cErr } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) return jsonErr(500, ctx.rid, "db_error", "Kunne ikke hente firmanavn.", { message: cErr.message });

  const companyName = (cRow as any)?.name ?? null;

  // Period label
  const periodLabel =
    mode === "month"
      ? `Måned: ${new Date(month + "T00:00:00Z").toLocaleDateString("nb-NO", { month: "long", year: "numeric" })}`
      : `År ${year}`;

  // 6) Build PDF
  const bytes = await buildEsgPdf({
    title: "ESG-rapport",
    companyName,
    companyId,
    periodLabel,
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

  const safeName = safeFilenamePart(companyName);
  const filename = `ESG_${safeName}_${mode === "month" ? month : year}.pdf`;

  return pdfResponse(bytes, filename, ctx.rid);
}
