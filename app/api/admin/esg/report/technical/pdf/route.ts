// app/api/admin/esg/technical/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { buildTechnicalAppendixPdf } from "@/lib/esg/pdf-technical";

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
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

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

  try {
    const url = new URL(req.url);
    const year = clampYear(Number(url.searchParams.get("year") ?? osloYear()));

    const { data: yearly, error: yErr } = await supabase
      .from("esg_yearly_snapshots")
      .select(
        "year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, computed_version, locked_at, lock_hash, lock_version"
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
    return pdfResponse(bytes, `Technical_ESG_${safe}_${year}.pdf`, ctx.rid);
  } catch (e: any) {
    return jsonErr(ctx.rid, "Uventet feil.", 500, { code: "unexpected", detail: { message: String(e?.message ?? e) } });
  }
}

