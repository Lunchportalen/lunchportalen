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

  const { data, error } = await sb
    .from("companies")
    // billing_hold og billing_hold_reason finnes ikke i prod-schema
    // (verifisert 2026-05-14, FASE 9J.5). Samme grunn som 9J.4 i page.tsx.
    // companies.status er autoritær gate. Hold-state defaultes til false
    // for ACTIVE companies via Boolean(undefined) i downstream-logikk.
    // Bredere migrasjon er flagget som arkitektonisk gjeld.
    // Downstream `data.billing_hold === true` evaluerer til false når
    // kolonnen er undefined (JS-spec), samme defensive default. Branch-
    // strukturen bevares for når en faktisk billing-hold-kilde introduseres.
    .select("status")
    .eq("id", cid)
    .maybeSingle();

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

  if ((data as any).billing_hold === true) {
    opsLog("order_rejected_company_hold", { rid, companyId: cid, reason: "billing_hold" });
    return {
      ok: false,
      status: 403,
      code: "BILLING_HOLD_ACTIVE",
      message: safeStr((data as any).billing_hold_reason) || "Firmaet er midlertidig satt på hold grunnet utestående.",
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
