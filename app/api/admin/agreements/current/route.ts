// app/api/admin/agreements/current/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { noStoreHeaders } from "@/lib/http/noStore";
import { jsonErr } from "@/lib/http/respond";

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);
  if ((s as any)?.ok === false) return (s as any).res;

  const { rid, companyId } = (s as any).ctx;

  const roleBlock = requireRoleOr403((s as any).ctx, "admin.agreements.current", ["company_admin", "superadmin"]);
  if (roleBlock) return roleBlock;

  // ✅ Late import – ingen env ved build/import
  const { supabaseServer } = await import("@/lib/supabase/server");

  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget.");

  if (!companyId) return jsonErr(400, rid, "MISSING_COMPANY", "Mangler companyId i session.");

  const { data, error } = await sb
    .from("agreements")
    .select("*")
    .eq("company_id", companyId)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente avtale.", { message: error.message });

  return NextResponse.json(
    { ok: true, rid, agreement: data ?? null },
    { status: 200, headers: noStoreHeaders() }
  );
}
