

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { INVOICE_RUN_LIST_SELECT, mapInvoiceRunRow } from "@/lib/superadmin/invoiceRunDb";

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
  const { requireSuperadminApi } = await import("@/lib/superadmin/auth");
  const guard = await requireSuperadminApi();
  if (guard.ok === false) {
    return jsonErr(rid, guard.message, guard.status, guard.status === 401 ? "NOT_AUTHENTICATED" : "FORBIDDEN");
  }

  // ─────────────────────────────────────────────────────
  // Fetch invoice runs
  // ─────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from("invoice_runs")
    .select(INVOICE_RUN_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return jsonErr(rid, "Kunne ikke hente fakturakjøringer", 500, { code: "DB_FAILED", detail: error });
  }

  const runs = (Array.isArray(data) ? data : []).map(mapInvoiceRunRow);

  return jsonOk(rid, { runs });
}

