

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

/* =========================================================
   Helpers
========================================================= */
/* =========================================================
   GET /api/superadmin/invoices/runs
   - List invoice runs (latest first)
   - Superadmin only
========================================================= */
export async function GET() {
  const rid = makeRid();
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

  // ─────────────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────────────
  const { data: userData, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userData?.user) {
    return jsonErr(rid, "Ikke innlogget", 401, "NOT_AUTHENTICATED");
  }

  const role = String(userData.user.user_metadata?.role ?? "");
  if (role !== "superadmin") {
    return jsonErr(rid, "Kun superadmin har tilgang", 403, "FORBIDDEN");
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
    return jsonErr(rid, "Kunne ikke hente fakturakjÃ¸ringer", 500, { code: "DB_FAILED", detail: error });
  }

  // ─────────────────────────────────────────────────────
  // Success
  // ─────────────────────────────────────────────────────
  return jsonOk(rid, { runs: data ?? [] });
}

