// app/api/superadmin/companies/stats/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

export async function GET() {
  const supabase = await supabaseServer();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return jsonError(401, "unauthorized", "Ikke innlogget");
  const role = String(userData.user.user_metadata?.role ?? "");
  if (role !== "superadmin") return jsonError(403, "forbidden", "Mangler tilgang");

  // totals
  const totalRes = await supabase.from("companies").select("*", { count: "exact", head: true });
  if (totalRes.error) return jsonError(500, "db_error", "Kunne ikke hente total", totalRes.error);

  const activeRes = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");
  if (activeRes.error) return jsonError(500, "db_error", "Kunne ikke hente active", activeRes.error);

  const pausedRes = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .eq("status", "paused");
  if (pausedRes.error) return jsonError(500, "db_error", "Kunne ikke hente paused", pausedRes.error);

  const closedRes = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .eq("status", "closed");
  if (closedRes.error) return jsonError(500, "db_error", "Kunne ikke hente closed", closedRes.error);

  return NextResponse.json({
    ok: true,
    total: totalRes.count ?? 0,
    active: activeRes.count ?? 0,
    paused: pausedRes.count ?? 0,
    closed: closedRes.count ?? 0,
  });
}
