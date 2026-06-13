// src/lib/guards/assertCompanyActiveApi.ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertCompanyActive } from "@/lib/guards/assertCompanyActive";
import { jsonErr } from "@/lib/http/respond";
import type { Database } from "@/lib/types/database";

type Args = {
  supa: SupabaseClient<Database>;
  companyId: string;
  rid: string;
};

export type CompanyActiveGateOk = { ok: true };
export type CompanyActiveGateFail = { ok: false; res: Response };

/**
 * assertCompanyActiveOr403
 *
 * API-friendly wrapper around assertCompanyActive.
 * - Uses shared company status logic (profile_company_status / companies).
 * - Returns { ok: true } when company is ACTIVE.
 * - Returns { ok: false, res } with jsonErr 4xx/5xx when not active / lookup fails.
 * - Never throws; fail-closed with deterministic API contract.
 */
export async function assertCompanyActiveOr403(args: Args): Promise<CompanyActiveGateOk | CompanyActiveGateFail> {
  const { supa, companyId, rid } = args;

  try {
    await assertCompanyActive({ rid, sb: supa, company_id: companyId });
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { status?: unknown; code?: unknown; message?: unknown };
    const status = typeof e?.status === "number" ? e.status : 403;
    const code = typeof e?.code === "string" ? e.code : "COMPANY_NOT_ACTIVE";
    const message = (typeof e?.message === "string" ? e.message : null) || "Firma er ikke aktivt.";

    const res = jsonErr(rid, message, status, {
      code,
      detail: {
        company_id: companyId,
        status,
      },
    }) as unknown as Response;

    return { ok: false, res };
  }
}

