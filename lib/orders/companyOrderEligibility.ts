import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Server-sperre før lp_order_set: billing_hold / PAUSED / CLOSED.
 * Tripletex er sannhet for faktura; dette er kun effekt av allerede satt firmastatus.
 */
export async function assertCompanyOrderWriteAllowed(
  sb: SupabaseClient,
  companyId: string,
  rid: string,
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const cid = safeStr(companyId);
  if (!cid) {
    return { ok: false, status: 403, code: "COMPANY_SCOPE_REQUIRED", message: "Mangler firmatilknytning." };
  }

  const { data, error } = await sb.from("companies").select("billing_hold,billing_hold_reason,status").eq("id", cid).maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 503,
      code: "COMPANY_LOOKUP_FAILED",
      message: "Kunne ikke verifisere firmastatus.",
    };
  }

  if (!data) {
    return { ok: false, status: 403, code: "COMPANY_NOT_FOUND", message: "Firma ikke funnet." };
  }

  if (data.billing_hold === true) {
    opsLog("order_rejected_company_hold", { rid, companyId: cid, reason: "billing_hold" });
    return {
      ok: false,
      status: 403,
      code: "BILLING_HOLD_ACTIVE",
      message: safeStr(data.billing_hold_reason) || "Firmaet er midlertidig satt på hold grunnet utestående.",
    };
  }

  const st = safeStr(data.status).toUpperCase();
  if (st === "PAUSED") {
    opsLog("order_rejected_company_hold", { rid, companyId: cid, reason: "company_paused" });
    return {
      ok: false,
      status: 403,
      code: "COMPANY_PAUSED",
      message: "Firmaet er satt på pause (administrativt).",
    };
  }
  if (st === "CLOSED") {
    opsLog("order_rejected_company_hold", { rid, companyId: cid, reason: "company_closed" });
    return {
      ok: false,
      status: 403,
      code: "COMPANY_CLOSED",
      message: "Firmaet er avsluttet.",
    };
  }

  return { ok: true };
}
