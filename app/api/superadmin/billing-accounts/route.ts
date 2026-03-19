

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function jsonError(rid: string, status: number, error: string, message: string, detail?: any) {
  const err = detail !== undefined ? { code: error, detail } : error;
  return jsonErr(rid, message, status, err);
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

export async function POST(req: Request) {
  const rid = makeRid();
  const { requireRole } = await import("@/lib/auth/requireRole");
  const guard = await requireRole(["superadmin"]);
  if (!guard.ok) return jsonError(rid, guard.status ?? 403, "FORBIDDEN", guard.error ?? "Ingen tilgang.");

  const body = await req.json().catch(() => null);
  const company_id = body?.company_id;
  const tripletex_customer_id = String(body?.tripletex_customer_id ?? "").trim() || null;

  if (!isUuid(company_id)) return jsonError(rid, 400, "BAD_COMPANY_ID", "company_id må være UUID");

  // Upsert (service role; superadmin-only route, cross-tenant table)
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();
  const { error } = await admin.from("company_billing_accounts").upsert(
    {
      company_id,
      tripletex_customer_id,
    },
    { onConflict: "company_id" }
  );

  if (error) return jsonError(rid, 500, "UPSERT_FAILED", "Kunne ikke lagre mapping", error);

  const { auditSuperadmin } = await import("@/lib/audit/actions");
  await auditSuperadmin({
    actor_user_id: guard.userId,
    action: "billing_account.upsert",
    company_id,
    target_type: "company_billing_account",
    target_id: company_id,
    target_label: `company=${company_id}`,
    after: { company_id, tripletex_customer_id },
    meta: { rid },
  });

  return jsonOk(rid, { ok: true }, 200);
}

