// app/api/admin/users/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function asString(v: any) {
  return String(v ?? "").trim();
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();

  // 1) auth
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return jsonError(401, "not_authenticated", "Ikke innlogget");

  const role = asString(userData.user.user_metadata?.role ?? "employee");
  if (role !== "company_admin") return jsonError(403, "forbidden", "Kun company_admin");

  // 2) company_id via profile (RLS enforces)
  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", userData.user.id)
    .single();

  if (meErr || !me?.company_id) return jsonError(400, "no_company", "Fant ikke company_id", meErr);

  const companyId = String(me.company_id);

  // 3) status gate
  const { data: company, error: compErr } = await supabase
    .from("companies")
    .select("id,status")
    .eq("id", companyId)
    .single();

  if (compErr || !company) return jsonError(404, "company_not_found", "Fant ikke firma", compErr);
  if (asString((company as any).status) !== "active") return jsonError(403, "company_not_active", "Firma er ikke aktivt");

  // 4) optional filters (safe + simple)
  const url = new URL(req.url);
  const q = asString(url.searchParams.get("q"));
  const limitRaw = Number(url.searchParams.get("limit") ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 200;

  // 5) list users (RLS: admin can read only within own company)
  // NOTE: Supabase query builder doesn't support OR across columns cleanly without ilike on one column.
  // We do a simple approach:
  // - if q present: filter by full_name ilike; if you want department too, we can add RPC later.
  let query = supabase
    .from("profiles")
    .select("user_id,full_name,department,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (q) {
    query = query.ilike("full_name", `%${q}%`);
  }

  const { data: rows, error } = await query;

  if (error) return jsonError(500, "query_failed", "Kunne ikke hente ansatte", error);

  return NextResponse.json({
    ok: true,
    companyId,
    count: (rows ?? []).length,
    users: rows ?? [],
  });
}
