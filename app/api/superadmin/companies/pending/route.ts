// app/api/superadmin/companies/pending/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function jsonError(
  status: number,
  error: string,
  message: string,
  detail?: any
) {
  return NextResponse.json(
    { ok: false, error, message, detail: detail ?? undefined },
    { status }
  );
}

export async function GET() {
  // ⚠️ supabaseServer() er async hos dere
  const sb = await supabaseServer();

  /**
   * Henter siste 20 firma med status = 'pending'
   * Brukes av Superadmin-header (🔔) og pending-oversikt
   */
  const { data, error } = await sb
    .from("companies")
    .select("id, name, orgnr, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return jsonError(
      500,
      "db_error",
      "Kunne ikke hente pending-firma",
      error
    );
  }

  return NextResponse.json({
    ok: true,
    companies: data ?? [],
  });
}
