// app/api/admin/esg/report/pdf/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope, mustCompanyId } from "@/lib/auth/scope";
import { buildEsgPdf } from "@/lib/esg/pdf";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function pdfResponse(bytes: Uint8Array, filename: string) {
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...noStore(),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

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
  const rid = crypto.randomUUID?.() ?? String(Date.now());

  // ✅ await klienten
  const supabase = await supabaseServer();

  try {
    // ✅ scope fra request (cookies/headers)
    const scope: any = await getScope(req);

    // robust: støtter både Scope og { ok:false }
    if (scope?.ok === false) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);
    if (!scope?.role) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);

    const companyId = mustCompanyId(scope);
    if (!companyId) return jsonErr(403, rid, "FORBIDDEN", "Mangler company_id", { role: scope?.role ?? null });

    const url = new URL(req.url);
    const modeRaw = (url.searchParams.get("mode") || "year").toLowerCase();
    const mode = modeRaw === "month" ? "month" : "year";

    const nowMonth01 = isoMonthStart();

    const year = Number(url.searchParams.get("year") || nowMonth01.slice(0, 4));
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return jsonErr(400, rid, "BAD_REQUEST", "year må være et gyldig år (2000–2100)");
    }

    const month = url.searchParams.get("month") || nowMonth01; // YYYY-MM-01
    if (!isIsoDate(month) || !month.endsWith("-01")) {
      return jsonErr(400, rid, "BAD_REQUEST", "month må være YYYY-MM-01");
    }

    const { fromMonth, toMonth } = toMonthRangeLast12(month);

    // 1) Months (last 12)
    const { data: months, error: mErr } = await supabase
      .from("esg_monthly_snapshots")
      .select(
        "month, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score"
      )
      .eq("company_id", companyId)
      .gte("month", fromMonth)
      .lte("month", toMonth)
      .order("month", { ascending: true });

    if (mErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente måneder", mErr);

    // 2) Yearly (for signature + summary)
    const { data: yearly, error: yErr } = await supabase
      .from("esg_yearly_snapshots")
      .select(
        "year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score, computed_at, computed_version, locked_at, lock_hash, lock_version"
      )
      .eq("company_id", companyId)
      .eq("year", year)
      .maybeSingle();

    if (yErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente år", yErr);

    // 3) Company name (optional)
    const { data: c, error: cErr } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    if (cErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente firmanavn", cErr);

    const companyName = (c as any)?.name ?? null;

    // 4) Period label
    const periodLabel =
      mode === "month"
        ? `Måned: ${new Date(month + "T00:00:00Z").toLocaleDateString("nb-NO", { month: "long", year: "numeric" })}`
        : `År ${year}`;

    // 5) Build PDF (includes narrative + ESG signature)
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

    return pdfResponse(bytes, filename);
  } catch (e: any) {
    return jsonErr(500, rid, "UNEXPECTED", "Uventet feil", { message: String(e?.message ?? e) });
  }
}
