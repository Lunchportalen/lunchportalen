

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";

// ✅ RIKTIG: filen finnes hos dere
import { buildEsgNarrativeYear } from "@/lib/esg/narrative";

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
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

  const url = new URL(req.url);
  const year = clampYear(Number(url.searchParams.get("year") ?? osloYear()));

  const companyId = url.searchParams.get("company_id");
  if (companyId && !isUuid(companyId)) {
    return jsonErr(ctx.rid, "company_id må være uuid", 400, "BAD_REQUEST", { detail: { company_id: companyId } });
  }

  let curQ = supabase.from("esg_yearly_snapshots").select("*").eq("year", year);
  let prevQ = supabase.from("esg_yearly_snapshots").select("*").eq("year", year - 1);

  if (companyId) {
    curQ = curQ.eq("company_id", companyId);
    prevQ = prevQ.eq("company_id", companyId);
  }

  const { data: cur, error: e1 } = await curQ;
  if (e1) return jsonErr(ctx.rid, "Kunne ikke hente året", 500, "DB_ERROR", { detail: e1 });

  const { data: prev, error: e2 } = await prevQ;
  if (e2) return jsonErr(ctx.rid, "Kunne ikke hente forrige år", 500, "DB_ERROR", { detail: e2 });

  const prevMap = new Map<string, any>();
  for (const r of prev ?? []) prevMap.set((r as any).company_id, r);

  const items = (cur ?? []).map((r: any) => {
    const p = prevMap.get(r.company_id) ?? null;
    const narrative = buildEsgNarrativeYear({ current: r, previous: p, year });
    return { ...r, narrative };
  });

  return jsonOk(ctx.rid, { year, company_id: companyId ?? null, items });
}


