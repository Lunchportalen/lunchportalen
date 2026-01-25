export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope } from "@/lib/auth/scope";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function osloYear() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric" });
  return Number(fmt.format(new Date()));
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

type CompanyMeta = { name: string | null; status: string | null };

export async function GET(req: NextRequest) {
  const rid = crypto.randomUUID?.() ?? String(Date.now());

  try {
    // ✅ await klienten
    const supabase = await supabaseServer();

    // ✅ scope fra request (robust: støtter både Scope og { ok:false })
    const scope: any = await getScope(req);
    if (scope?.ok === false) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);
    if (!scope?.role) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);

    // ✅ superadmin-only
    if (scope.role !== "superadmin") return jsonErr(403, rid, "FORBIDDEN", "Krever superadmin", { role: scope.role });

    const url = new URL(req.url);
    const year = clampInt(Number(url.searchParams.get("year") ?? osloYear()), 2000, 2100);
    const score = String(url.searchParams.get("score") ?? "ALL").toUpperCase(); // A|B|C|D|ALL
    const q = String(url.searchParams.get("q") ?? "").trim();
    const page = clampInt(Number(url.searchParams.get("page") ?? 1), 1, 500);
    const limit = clampInt(Number(url.searchParams.get("limit") ?? 50), 10, 200);
    const offset = (page - 1) * limit;

    // 1) base: yearly snapshots (for alle firma)
    let yearlyQ = supabase
      .from("esg_yearly_snapshots")
      .select(
        "company_id, year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score"
      )
      .eq("year", year);

    if (score !== "ALL") yearlyQ = yearlyQ.eq("stability_score", score);

    const { data: rows, error: yErr } = await yearlyQ;
    if (yErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente ESG yearly", yErr);

    // 2) firmainfo (navn/status) for UI
    // - IKKE anta created_at finnes
    // - IKKE anta status finnes
    let companies: any[] | null = null;

    // Forsøk med status først
    const tryWithStatus = await supabase.from("companies").select("id, name, status");
    if (!tryWithStatus.error) {
      companies = tryWithStatus.data ?? [];
    } else {
      // Fallback uten status
      const tryWithoutStatus = await supabase.from("companies").select("id, name");
      if (tryWithoutStatus.error) {
        return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente companies", {
          withStatus: tryWithStatus.error,
          withoutStatus: tryWithoutStatus.error,
        });
      }
      companies = tryWithoutStatus.data ?? [];
    }

    const companyMap = new Map<string, CompanyMeta>();
    for (const r of companies ?? []) {
      companyMap.set((r as any).id, {
        name: (r as any).name ?? null,
        status: (r as any).status ?? null,
      });
    }

    // 3) Kombiner og filtrer på q (navn/uuid/status)
    const list = (rows ?? [])
      .map((r: any) => {
        const meta = companyMap.get(r.company_id) || { name: null, status: null };
        const ordered = Number(r.ordered_count ?? 0);
        const wasteMeals = Number(r.waste_meals ?? 0);
        const wasteRate = ordered > 0 ? wasteMeals / ordered : null;

        return {
          company_id: String(r.company_id),
          company_name: meta.name,
          company_status: meta.status,
          year: Number(r.year),

          stability_score: (r.stability_score as string | null) ?? null,

          ordered_count: ordered,
          cancelled_in_time_count: Number(r.cancelled_in_time_count ?? 0),

          waste_meals: wasteMeals,
          waste_kg: Number(r.waste_kg ?? 0),
          waste_co2e_kg: Number(r.waste_co2e_kg ?? 0),

          cost_saved_nok: Number(r.cost_saved_nok ?? 0),
          cost_waste_nok: Number(r.cost_waste_nok ?? 0),
          cost_net_nok: Number(r.cost_net_nok ?? 0),

          waste_rate: wasteRate, // 0..1
        };
      })
      .filter((r) => {
        if (!q) return true;
        const qq = q.toLowerCase();
        return (
          (r.company_id || "").toLowerCase().includes(qq) ||
          (r.company_name || "").toLowerCase().includes(qq) ||
          (r.company_status || "").toLowerCase().includes(qq)
        );
      });

    // 4) Sortering: score A→D, deretter waste_rate lavest, deretter spart høyest
    const scoreRank = (s: string | null) => (s === "A" ? 1 : s === "B" ? 2 : s === "C" ? 3 : s === "D" ? 4 : 9);

    list.sort((a, b) => {
      const ar = scoreRank(a.stability_score);
      const br = scoreRank(b.stability_score);
      if (ar !== br) return ar - br;

      const aw = a.waste_rate ?? 999;
      const bw = b.waste_rate ?? 999;
      if (aw !== bw) return aw - bw;

      return (b.cost_saved_nok ?? 0) - (a.cost_saved_nok ?? 0);
    });

    const total = list.length;
    const pageItems = list.slice(offset, offset + limit);

    return jsonOk({ ok: true, rid, year, total, page, limit, items: pageItems });
  } catch (e: any) {
    // ✅ aldri tom 500 igjen
    return jsonErr(500, rid, "UNEXPECTED", "Uventet feil i ESG benchmark", { message: String(e?.message ?? e) });
  }
}
