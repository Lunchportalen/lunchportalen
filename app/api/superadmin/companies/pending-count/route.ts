// app/api/superadmin/companies/pending-count/route.ts
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
  // ⚠️ VIKTIG: supabaseServer() er async hos dere
  const sb = await supabaseServer();

  /**
   * Teller antall firma med status = 'pending'
   * RLS forutsetter current_role() = 'superadmin'
   */
  const { count, error } = await sb
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    return jsonError(
      500,
      "db_error",
      "Kunne ikke hente pending-count",
      error
    );
  }

  return NextResponse.json({
    ok: true,
    pending: count ?? 0,
  });
}
