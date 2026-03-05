// src/lib/guards/assertCompanyActiveApi.ts
import "server-only";

import { assertCompanyActive } from "@/lib/guards/assertCompanyActive";
import { jsonErr } from "@/lib/http/respond";

type Args = {
  supa: any;
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
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 403;
    const code = typeof err?.code === "string" ? err.code : "COMPANY_NOT_ACTIVE";
    const message = (err?.message as string) || "Firma er ikke aktivt.";

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

