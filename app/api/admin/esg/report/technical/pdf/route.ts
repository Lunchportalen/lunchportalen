export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope, mustCompanyId } from "@/lib/auth/scope";
import { buildTechnicalAppendixPdf } from "@/lib/esg/pdf-technical";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
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

function osloYear() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric" });
  return Number(fmt.format(new Date()));
}
function clampYear(n: number) {
  if (!Number.isFinite(n)) return osloYear();
  const y = Math.trunc(n);
  if (y < 2000) return 2000;
  if (y > 2100) return 2100;
  return y;
}
function safeFilenamePart(v: any) {
  const s = String(v ?? "").trim();
  const cleaned = s.replace(/[^\w\-]+/g, "_");
  return cleaned.length ? cleaned : "firma";
}

export async function GET(req: NextRequest) {
  const rid = crypto.randomUUID?.() ?? String(Date.now());
  const supabase = await supabaseServer();

  try {
    const scope: any = await getScope(req);
    if (scope?.ok === false) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);
    if (!scope?.role) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);

    const companyId = mustCompanyId(scope);
    if (!companyId) return jsonErr(403, rid, "FORBIDDEN", "Mangler company_id");

    const url = new URL(req.url);
    const year = clampYear(Number(url.searchParams.get("year") ?? osloYear()));

    const { data: yearly, error: yErr } = await supabase
      .from("esg_yearly_snapshots")
      .select("year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, computed_version, locked_at, lock_hash, lock_version")
      .eq("company_id", companyId)
      .eq("year", year)
      .maybeSingle();

    if (yErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente årssnapshot", yErr);

    const { data: c, error: cErr } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    if (cErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente firmanavn", cErr);

    const companyName = (c as any)?.name ?? null;

    const bytes = await buildTechnicalAppendixPdf({
      companyName,
      companyId,
      year,
      generatedAtISO: new Date().toISOString(),
      computedVersion: (yearly as any)?.computed_version ?? "v1",
      orderedCount: (yearly as any)?.ordered_count ?? null,
      cancelledInTimeCount: (yearly as any)?.cancelled_in_time_count ?? null,
      wasteMeals: (yearly as any)?.waste_meals ?? null,
      wasteKg: (yearly as any)?.waste_kg ?? null,
      wasteCo2eKg: (yearly as any)?.waste_co2e_kg ?? null,
      lockedAt: (yearly as any)?.locked_at ?? null,
      lockHash: (yearly as any)?.lock_hash ?? null,
      lockVersion: (yearly as any)?.lock_version ?? null,
    });

    const safe = safeFilenamePart(companyName);
    return pdfResponse(bytes, `Technical_ESG_${safe}_${year}.pdf`);
  } catch (e: any) {
    return jsonErr(500, rid, "UNEXPECTED", "Uventet feil", { message: String(e?.message ?? e) });
  }
}
