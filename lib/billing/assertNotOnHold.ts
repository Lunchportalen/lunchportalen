// STATUS: KEEP

import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { jsonErr } from "@/lib/http/respond";

export async function assertNotOnHoldOrThrowResponse(companyId: string, rid: string): Promise<void> {
  const sb = await supabaseServer(); // ✅ VIKTIG

  const { error } = await sb.rpc("assert_company_not_on_hold", { p_company_id: companyId });

  if (!error) return;

  const msg = String((error as any)?.message ?? "");
  const code = String((error as any)?.code ?? "");

  const isHold =
    msg.includes("BILLING_HOLD_ACTIVE") ||
    msg.toLowerCase().includes("billing_hold_active") ||
    code === "P0001";

  if (isHold) {
    throw jsonErr(rid, "Firmaet er midlertidig satt på hold grunnet utestående.", 403, {
      code: "BILLING_HOLD_ACTIVE",
      detail: { companyId },
    });
  }

  throw jsonErr(rid, "Kunne ikke verifisere betalingsstatus. Prøv igjen.", 503, {
    code: "BILLING_HOLD_CHECK_FAILED",
    detail: { companyId, message: msg, pg: { code } },
  });
}
