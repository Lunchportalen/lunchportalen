export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope } from "@/lib/auth/scope";
import { toCsv } from "@/lib/esg/csv";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      ...noStore(),
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
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

export async function GET(req: NextRequest) {
  const rid = crypto.randomUUID?.() ?? String(Date.now());

  const supabase = await supabaseServer();

  const scope: any = await getScope(req);
  if (scope?.ok === false) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);
  if (!scope?.role) return jsonErr(401, rid, "UNAUTHORIZED", "Ikke innlogget", scope);

  if (scope.role !== "superadmin") return jsonErr(403, rid, "FORBIDDEN", "Krever superadmin", { role: scope.role });

  const url = new URL(req.url);
  const year = clampYear(Number(url.searchParams.get("year") ?? osloYear()));

  const { data, error } = await supabase
    .from("esg_yearly_snapshots")
    .select(
      "company_id, location_id, year, ordered_count, cancelled_in_time_count, no_show_count, waste_meals, waste_kg, waste_co2e_kg, avg_meal_price_nok, cost_ordered_nok, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score, locked_at, lock_hash, lock_version"
    )
    .eq("year", year)
    .order("stability_score", { ascending: true });

  if (error) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente yearly snapshots", error);

  const headers = [
    "company_id",
    "location_id",
    "year",
    "ordered_count",
    "cancelled_in_time_count",
    "no_show_count",
    "waste_meals",
    "waste_kg",
    "waste_co2e_kg",
    "avg_meal_price_nok",
    "cost_ordered_nok",
    "cost_saved_nok",
    "cost_waste_nok",
    "cost_net_nok",
    "stability_score",
    "locked_at",
    "lock_version",
    "lock_hash",
  ];

  const csv = toCsv((data ?? []) as any, headers);
  return csvResponse(csv, `ESG_YEARLY_${year}.csv`);
}
