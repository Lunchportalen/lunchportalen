export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function GET(req: Request) {
  const rid = makeRid("prov_reg_list");
  const { requireSuperadminApi } = await import("@/lib/superadmin/auth");
  const guard = await requireSuperadminApi();
  if (guard.ok === false) {
    return jsonErr(rid, guard.message, guard.status, guard.status === 401 ? "NOT_AUTHENTICATED" : "FORBIDDEN");
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "PENDING").toUpperCase();
  const allowed = new Set(["PENDING", "APPROVED", "REJECTED", "ALL"]);
  const filter = allowed.has(status) ? status : "PENDING";

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin() as any;

  let q = admin
    .from("provider_registrations")
    .select(
      "id, status, company_name, org_number, country_code, contact_name, contact_email, contact_phone, operating_language, invoice_language, currency, timezone, tax_registration, coverage_wish, provider_id, reviewed_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter !== "ALL") q = q.eq("status", filter);

  const { data, error } = await q;
  if (error) return jsonErr(rid, "Kunne ikke hente søknader.", 500, "LIST_FAILED", { detail: error.message });

  return jsonOk(rid, { registrations: data ?? [], status: filter }, 200);
}
