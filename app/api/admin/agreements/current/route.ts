export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

export async function GET() {
  // ✅ VIKTIG: supabaseServer() er async i prosjektet ditt → må awaites
  const supabase = await supabaseServer();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return jsonError(401, "unauthorized", "Ikke innlogget");

  const role = String(user.user_metadata?.role ?? "").toLowerCase();
  const companyId = String(user.user_metadata?.company_id ?? "").trim();

  if (role !== "company_admin") return jsonError(403, "forbidden", "Ingen tilgang");
  if (!companyId) return jsonError(400, "missing_company_id", "Mangler company_id på profilen");

  const { data, error } = await supabase
    .from("company_agreements")
    .select("id,status,plan_tier,start_date,end_date,binding_months,delivery_days,cutoff_time,timezone,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return jsonError(500, "db_error", "Kunne ikke hente avtale", error);

  return NextResponse.json({ ok: true, agreement: data ?? null }, { status: 200 });
}
