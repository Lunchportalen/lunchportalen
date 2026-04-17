import type { SystemTestContext } from "../context";
import { assert } from "../utils/assert";
import type { SystemTestAdmin } from "../utils/supabaseAdmin";

const deliveryDays = ["mon", "tue", "wed", "thu", "fri"];

/**
 * ACTIVE agreement for (company, location). Tries ledger RPCs first, then direct insert (fixture-style).
 */
export async function createAgreement(ctx: SystemTestContext, admin: SystemTestAdmin): Promise<SystemTestContext> {
  if (!ctx.companyId || !ctx.locationId) throw new Error("createAgreement: missing companyId or locationId");

  const rpcParams = {
    p_company_id: ctx.companyId,
    p_location_id: ctx.locationId,
    p_tier: "BASIS",
    p_delivery_days: deliveryDays,
    p_slot_start: "11:00",
    p_slot_end: "13:00",
    p_starts_at: ctx.agreementStartsAtISO,
    p_binding_months: 12,
    p_notice_months: 3,
    p_price_per_employee: 100,
  };

  const { data, error: createErr } = await admin.rpc("lp_agreement_create_pending", rpcParams);

  if (!createErr) {
    const row = (Array.isArray(data) ? data[0] : data) as { agreement_id?: string } | null;
    const agreementId = String(row?.agreement_id ?? "");
    assert(agreementId, "createAgreement: RPC returned no agreement_id");

    const { error: approveErr } = await admin.rpc("lp_agreement_approve_active", {
      p_agreement_id: agreementId,
      p_actor_user_id: null,
    });
    if (approveErr) throw new Error(`createAgreement approve: ${approveErr.message}`);

    const { data: verify, error: vErr } = await admin
      .from("agreements")
      .select("id, status, delivery_days")
      .eq("id", agreementId)
      .maybeSingle();
    if (vErr) throw new Error(`createAgreement verify: ${vErr.message}`);
    assert(verify?.id === agreementId, "createAgreement: agreement row missing");
    const st = String(verify?.status ?? "").toUpperCase();
    assert(st === "ACTIVE", `createAgreement: expected ACTIVE, got ${verify?.status}`);

    return { ...ctx, agreementId };
  }

  const msg = String(createErr.message ?? "");
  if (msg.includes("schema cache") || msg.includes("Could not find the function")) {
    // DEPRECATED — do not use: direct agreements insert bypasses ledger RPCs. Prefer lp_agreement_create_pending + superadmin approve/activate path.
    const { data: ins, error: insertErr } = await admin
      .from("agreements")
      .insert({
        company_id: ctx.companyId,
        location_id: ctx.locationId,
        tier: "BASIS",
        status: "ACTIVE",
        delivery_days: deliveryDays,
        slot_start: "11:00",
        slot_end: "13:00",
        starts_at: ctx.agreementStartsAtISO,
      } as never)
      .select("id")
      .single();
    if (insertErr) throw new Error(`createAgreement fallback insert: ${insertErr.message}`);
    const agreementId = String((ins as { id?: string })?.id ?? "");
    assert(agreementId, "createAgreement fallback: no id");
    return { ...ctx, agreementId };
  }

  throw new Error(`createAgreement: ${createErr.message}`);
}
