export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const revalidate = 0;

import { isMissingRelationError } from "@/lib/db/missingRelation";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

async function adminDb(): Promise<any> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

async function requireSuperadmin() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, status: 401, message: "Ikke innlogget" };

  const role = String(data.user.user_metadata?.role ?? "");
  if (role !== "superadmin") return { ok: false as const, status: 403, message: "Ingen tilgang" };

  return { ok: true as const };
}

type TripletexInvoiceRow = {
  id: string;
  run_id: string;
  company_id: string;
  external_invoice_id: string | null;
  status: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function mapTripletexInvoiceToExportLog(row: TripletexInvoiceRow) {
  const statusRaw = String(row.status ?? "").toLowerCase();
  const status =
    statusRaw === "exported" || statusRaw === "success"
      ? "success"
      : statusRaw === "failed" || statusRaw === "error"
        ? "failed"
        : statusRaw === "pending" || statusRaw === "blocked"
          ? "blocked"
          : statusRaw || "blocked";

  return {
    id: row.id,
    exported_at: row.updated_at ?? row.created_at,
    exported_by: null,
    status,
    file_name: row.external_invoice_id ? `tripletex-${row.external_invoice_id}` : null,
    rows_count: 0,
    amount_ex_vat: null,
    detail: row.last_error,
  };
}

export async function GET(_: Request, ctx: { params: { runId: string } }) {
  const rid = makeRid();
  const guard = await requireSuperadmin();
  if (!guard.ok) return jsonErr(rid, guard.message, guard.status ?? 400, "AUTH");

  const runId = ctx.params.runId;
  if (!isUuid(runId)) return jsonErr(rid, "Ugyldig runId", 400, "BAD_REQUEST");

  const db = await adminDb();
  if (!db?.from) return jsonErr(rid, "supabaseAdmin er ikke tilgjengelig (mangler .from)", 500, "ADMIN_CLIENT_MISSING");

  const { data, error } = await db
    .from("tripletex_invoices")
    .select("id, run_id, company_id, external_invoice_id, status, last_error, created_at, updated_at")
    .eq("run_id", runId)
    .order("updated_at", { ascending: false })
    .limit(25);

  if (error) {
    if (isMissingRelationError(error, "tripletex_invoices")) {
      return jsonOk(rid, { exports: [] });
    }
    return jsonErr(rid, "Kunne ikke hente eksportlogg", 500, { code: "DB", detail: error });
  }

  const exports = (Array.isArray(data) ? data : []).map((row) => mapTripletexInvoiceToExportLog(row as TripletexInvoiceRow));

  return jsonOk(rid, { exports });
}
