export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope } from "@/lib/auth/scope";

// ✅ RIKTIG: filen finnes hos dere
import { buildEsgNarrativeYear } from "@/lib/esg/narrative";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
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

function isUuid(v: any): v is string {
  return typeof v === "string" && /^[0-9a-fA-F-]{36}$/.test(v);
}

export async function GET(req: NextRequest) {
  const rid = crypto.randomUUID?.() ?? String(Date.now());
  const supabase = await supabaseServer();

  const scope: any = await getScope(req);
  if (scope?.ok === false) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);
  if (!scope?.role) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);

  if (scope.role !== "superadmin") {
    return jsonErr(403, rid, "FORBIDDEN", "Krever superadmin", { role: scope.role ?? null });
  }

  const url = new URL(req.url);
  const year = clampYear(Number(url.searchParams.get("year") ?? osloYear()));

  const companyId = url.searchParams.get("company_id");
  if (companyId && !isUuid(companyId)) {
    return jsonErr(400, rid, "BAD_REQUEST", "company_id må være uuid", { company_id: companyId });
  }

  let curQ = supabase.from("esg_yearly_snapshots").select("*").eq("year", year);
  let prevQ = supabase.from("esg_yearly_snapshots").select("*").eq("year", year - 1);

  if (companyId) {
    curQ = curQ.eq("company_id", companyId);
    prevQ = prevQ.eq("company_id", companyId);
  }

  const { data: cur, error: e1 } = await curQ;
  if (e1) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente året", e1);

  const { data: prev, error: e2 } = await prevQ;
  if (e2) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente forrige år", e2);

  const prevMap = new Map<string, any>();
  for (const r of prev ?? []) prevMap.set((r as any).company_id, r);

  const items = (cur ?? []).map((r: any) => {
    const p = prevMap.get(r.company_id) ?? null;
    const narrative = buildEsgNarrativeYear({ current: r, previous: p, year });
    return { ...r, narrative };
  });

  return NextResponse.json({ ok: true, rid, year, company_id: companyId ?? null, items }, { headers: noStore() });
}
