"use server";
import "server-only";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";

export type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeStatus(v: unknown): CompanyStatus {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE" || s === "PAUSED" || s === "CLOSED" || s === "PENDING") return s;
  return "PENDING";
}

/**
 * setCompanyStatus
 * - Superadmin action: oppdaterer companies.status
 * - Returnerer standard jsonOk/jsonErr med rid
 *
 * NB: RLS/rolle-sjekk håndteres av eksisterende supabaseServer() + policies.
 */
export async function setCompanyStatus(companyId: string, status: CompanyStatus) {
  const rid = makeRid();

  const company_id = safeStr(companyId);
  if (!company_id) {
    return jsonErr(rid, "Ugyldig companyId.", 400, { code: "BAD_COMPANY_ID" });
  }

  const nextStatus = normalizeStatus(status);

  try {
    const sb = await supabaseServer();

    const { data, error } = await sb
      .from("companies")
      .update({ status: nextStatus })
      .eq("id", company_id)
      .select("id,status")
      .maybeSingle();

    if (error) {
      return jsonErr(rid, "Kunne ikke oppdatere firmastatus.", 500, {
        code: "COMPANY_STATUS_UPDATE_FAILED",
        detail: { message: String((error as any)?.message ?? error) },
      });
    }

    if (!data?.id) {
      return jsonErr(rid, "Firma ikke funnet.", 404, { code: "COMPANY_NOT_FOUND" });
    }

    return jsonOk(rid, { ok: true, rid, company: data }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, {
      code: "COMPANY_STATUS_EXCEPTION",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
