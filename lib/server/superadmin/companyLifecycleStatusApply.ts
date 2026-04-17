// lib/server/superadmin/companyLifecycleStatusApply.ts
/** Canonical write path for companies.status (PENDING|ACTIVE|PAUSED|CLOSED). Used by set-status + agreement sync. */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonErr } from "@/lib/http/respond";

export type CompanyLifecycleStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export function normalizeCompanyLifecycleStatus(raw: string | null): CompanyLifecycleStatus | null {
  const u = safeStr(raw).toUpperCase();
  if (u === "ACTIVE") return "ACTIVE";
  if (u === "PAUSED") return "PAUSED";
  if (u === "CLOSED") return "CLOSED";
  if (u === "PENDING") return "PENDING";
  return null;
}

export async function applyCompanyLifecycleStatus(
  db: SupabaseClient,
  rid: string,
  companyId: string,
  next: CompanyLifecycleStatus
): Promise<
  | { ok: true; prev: CompanyLifecycleStatus; next: CompanyLifecycleStatus; already: boolean; companyName: string | null }
  | { ok: false; response: Response }
> {
  const cid = safeStr(companyId);
  if (!cid) return { ok: false, response: jsonErr(rid, "companyId mangler.", 400, { code: "VALIDATION" }) };

  const { data: company, error: cErr } = await db.from("companies").select("id,name,status").eq("id", cid).single();

  if (cErr || !company) {
    return {
      ok: false,
      response: jsonErr(rid, "Fant ikke firma.", 404, {
        code: "NOT_FOUND",
        detail: { message: cErr?.message ?? "Missing company" },
      }),
    };
  }

  const prev = normalizeCompanyLifecycleStatus(company.status as string) ?? "PENDING";
  const companyName = company.name ? safeStr(company.name) : null;

  if (prev === next) {
    return { ok: true, prev, next, already: true, companyName };
  }

  const now = new Date().toISOString();
  const { error: uErr } = await db.from("companies").update({ status: next, updated_at: now }).eq("id", cid);
  if (uErr) {
    return {
      ok: false,
      response: jsonErr(rid, "Kunne ikke oppdatere status.", 400, {
        code: "UPDATE_FAILED",
        detail: { message: uErr.message },
      }),
    };
  }

  return { ok: true, prev, next, already: false, companyName };
}
