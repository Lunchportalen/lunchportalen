// app/api/admin/esg/report/executive/pdf/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope, mustCompanyId } from "@/lib/auth/scope";
import { buildExecutiveOnePagerPdf } from "@/lib/esg/pdf-executive";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

function pdfResponse(bytes: Uint8Array, filename: string) {
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: { ...noStore(), "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` },
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
  const d = new Date(Date.UTC(y, (m - 1) + delta, 1));
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
    const year = clampYear(Number(url.searchParams.get("year") ?? osloMonthStartISO().slice(0, 4)));

    const thisMonth = osloMonthStartISO();
    const fromMonth = addMonths(thisMonth, -11);

    // Months: last 12 up to current month
    const { data: months, error: mErr } = await supabase
      .from("esg_monthly_snapshots")
      .select(
        "month, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score"
      )
      .eq("company_id", companyId)
      .gte("month", fromMonth)
      .lte("month", thisMonth)
      .order("month", { ascending: true });

    if (mErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente månedssnapshots", mErr);

    // Yearly: include lock fields for ESG-signature
    const { data: yearly, error: yErr } = await supabase
      .from("esg_yearly_snapshots")
      .select(
        "year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score, computed_version, locked_at, lock_hash, lock_version"
      )
      .eq("company_id", companyId)
      .eq("year", year)
      .maybeSingle();

    if (yErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente årssnapshot", yErr);

    const { data: c, error: cErr } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    if (cErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente firmanavn", cErr);

    const companyName = (c as any)?.name ?? null;

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
    return pdfResponse(bytes, `Executive_ESG_${safe}_${year}.pdf`);
  } catch (e: any) {
    return jsonErr(500, rid, "UNEXPECTED", "Uventet feil", { message: String(e?.message ?? e) });
  }
}
