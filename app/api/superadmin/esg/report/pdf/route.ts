

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { getScope } from "@/lib/auth/scope";
import { buildEsgPdf } from "@/lib/esg/pdf";
import { formatMonthYearLongNO } from "@/lib/date/format";
import { jsonErr, makeRid } from "@/lib/http/respond";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function pdfResponse(bytes: Uint8Array, filename: string, rid: string) {
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...noStore(),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "x-lp-rid": rid,
    },
  });
}

function isoMonthStart() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" });
  const today = fmt.format(new Date());
  return today.slice(0, 8) + "01"; // YYYY-MM-01
}

function isIsoMonth01(v: any): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-01$/.test(v);
}

function clampYear(n: number) {
  const fallback = Number(isoMonthStart().slice(0, 4));
  if (!Number.isFinite(n)) return fallback;
  const y = Math.trunc(n);
  if (y < 2000) return 2000;
  if (y > 2100) return 2100;
  return y;
}

export async function GET(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = makeRid();
  const supabase = await supabaseServer();

  // ✅ scope fra request (robust: støtter både Scope og {ok:false})
  const scope: any = await getScope(req);
  if (scope?.ok === false) return jsonErr(rid, "Ikke innlogget", 401, { code: "UNAUTHORIZED", detail: scope });
  if (!scope?.role) return jsonErr(rid, "Ikke innlogget", 401, { code: "UNAUTHORIZED", detail: scope });

  // ✅ superadmin-only (erstatter allowSuperadmin)
  if (scope.role !== "superadmin") return jsonErr(rid, "Krever superadmin", 403, { code: "FORBIDDEN", detail: { role: scope.role } });

  const url = new URL(req.url);

  const companyId = url.searchParams.get("company_id");
  if (!companyId) return jsonErr(rid, "company_id mangler", 400, "BAD_REQUEST");

  const modeRaw = (url.searchParams.get("mode") || "year").toLowerCase();
  const mode = modeRaw === "month" ? "month" : "year";

  const nowMonth01 = isoMonthStart();

  const year = clampYear(Number(url.searchParams.get("year") ?? nowMonth01.slice(0, 4)));

  const month = url.searchParams.get("month") || nowMonth01; // YYYY-MM-01
  if (!isIsoMonth01(month)) return jsonErr(rid, "month må være YYYY-MM-01", 400, { code: "BAD_REQUEST", detail: { month } });

  const toMonth = month;

  const fromMonth = (() => {
    const [y, m] = toMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 - 11, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  })();

  const { data: months, error: mErr } = await supabase
    .from("esg_monthly_snapshots")
    .select(
      "month, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score"
    )
    .eq("company_id", companyId)
    .gte("month", fromMonth)
    .lte("month", toMonth)
    .order("month", { ascending: true });

  if (mErr) return jsonErr(rid, "Kunne ikke hente måneder", 500, { code: "DB_ERROR", detail: mErr });

  const { data: yearly, error: yErr } = await supabase
    .from("esg_yearly_snapshots")
    .select(
      "year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score, computed_at, computed_version"
    )
    .eq("company_id", companyId)
    .eq("year", year)
    .maybeSingle();

  if (yErr) return jsonErr(rid, "Kunne ikke hente år", 500, { code: "DB_ERROR", detail: yErr });

  const { data: c, error: cErr } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
  if (cErr) return jsonErr(rid, "Kunne ikke hente firmanavn", 500, { code: "DB_ERROR", detail: cErr });

  const companyName = (c as any)?.name ?? null;

  const periodLabel =
    mode === "month"
      ? `Måned: ${formatMonthYearLongNO(`${month}-01`)}`
      : `År ${year}`;

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
  });

  const safeName = (companyName || "firma").replace(/[^\w\-]+/g, "_");
  const filename = `ESG_${safeName}_${mode === "month" ? month : year}.pdf`;
  return pdfResponse(bytes, filename, rid);
}

