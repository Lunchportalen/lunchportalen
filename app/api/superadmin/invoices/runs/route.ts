export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/* =========================================================
   Helpers
========================================================= */
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

/* =========================================================
   GET /api/superadmin/invoices/runs
   - List invoice runs (latest first)
   - Superadmin only
========================================================= */
export async function GET() {
  const supabase = await supabaseServer();

  // ─────────────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────────────
  const { data: userData, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userData?.user) {
    return jsonError(401, "NOT_AUTHENTICATED", "Ikke innlogget");
  }

  const role = String(userData.user.user_metadata?.role ?? "");
  if (role !== "superadmin") {
    return jsonError(403, "FORBIDDEN", "Kun superadmin har tilgang");
  }

  // ─────────────────────────────────────────────────────
  // Fetch invoice runs
  // ─────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from("invoice_runs")
    .select(
      `
        id,
        period_from,
        period_to,
        status,
        created_at,
        note
      `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return jsonError(
      500,
      "DB_FAILED",
      "Kunne ikke hente fakturakjøringer",
      error
    );
  }

  // ─────────────────────────────────────────────────────
  // Success
  // ─────────────────────────────────────────────────────
  return NextResponse.json(
    {
      ok: true,
      runs: data ?? [],
    },
    { status: 200 }
  );
}
