// lib/agreement/requireRule.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { opsLog } from "@/lib/ops/log";

export type AgreementRule = {
  id?: string | null;
  company_id: string;
  day_key: string;
  slot: string;
  tier: "BASIS" | "LUXUS";
  price_ex_vat?: number | null;
  price_inc_vat?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
};

export type RequireRuleOk = { ok: true; rule: AgreementRule };
export type RequireRuleErr = { ok: false; status: number; error: string; message: string };

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normTier(v: any): "BASIS" | "LUXUS" | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s;
  return null;
}

export async function requireRule(args: {
  sb: SupabaseClient;
  companyId: string;
  dayKey: string;
  slot?: string | null;
  dateISO?: string | null;
  rid?: string | null;
}): Promise<RequireRuleOk | RequireRuleErr> {
  const companyId = safeStr(args.companyId);
  const dayKey = safeStr(args.dayKey).toLowerCase();
  const slot = safeStr(args.slot ?? "lunch").toLowerCase() || "lunch";
  const rid = safeStr(args.rid ?? "");

  if (!companyId || !dayKey) {
    return { ok: false, status: 403, error: "FORBIDDEN", message: "Mangler firmatilknytning eller dag." };
  }

  const { data: agreementRow, error: aErr } = await (args.sb as any)
    .from("company_current_agreement")
    .select("id,company_id,status,delivery_days")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (aErr) {
    return { ok: false, status: 500, error: "AGREEMENT_LOOKUP_FAILED", message: "Kunne ikke hente avtale." };
  }
  if (!agreementRow?.company_id) {
    return { ok: false, status: 403, error: "AGREEMENT_MISSING", message: "Ingen aktiv avtale for firma." };
  }

  const deliveryNorm = normalizeDeliveryDaysStrict((agreementRow as any)?.delivery_days);
  if (deliveryNorm.unknown.length) {
    opsLog("agreement.delivery_days.warning", {
      rid: rid || null,
      company_id: companyId,
      agreement_id: (agreementRow as any)?.id ?? null,
      unknown: deliveryNorm.unknown,
      days: deliveryNorm.days,
      raw: (agreementRow as any)?.delivery_days ?? null,
    });
  }

  if (!deliveryNorm.days.includes(dayKey as any)) {
    return { ok: false, status: 403, error: "AGREEMENT_DAY_NOT_DELIVERY", message: "Dagen er ikke i avtalen." };
  }

  const q = (args.sb as any)
    .from("company_current_agreement_rules")
    .select("id,company_id,day_key,slot,is_enabled,tier,price_ex_vat,price_inc_vat,valid_from,valid_to")
    .eq("company_id", companyId)
    .eq("day_key", dayKey)
    .eq("slot", slot)
    .eq("is_enabled", true);

  const { data, error } = await q.maybeSingle();
  if (error) {
    return { ok: false, status: 500, error: "AGREEMENT_RULE_LOOKUP_FAILED", message: "Kunne ikke hente avtalerregler." };
  }
  if (!data) {
    return { ok: false, status: 403, error: "AGREEMENT_RULE_MISSING", message: "Dagen er ikke aktiv i avtalen." };
  }

  const tier = normTier((data as any)?.tier ?? null);
  if (!tier) {
    return { ok: false, status: 403, error: "INVALID_TIER", message: "Dagen har ugyldig nivå i avtalen." };
  }

  return {
    ok: true,
    rule: {
      id: (data as any)?.id ?? null,
      company_id: companyId,
      day_key: dayKey,
      slot,
      tier,
      price_ex_vat: (data as any)?.price_ex_vat ?? null,
      price_inc_vat: (data as any)?.price_inc_vat ?? null,
      valid_from: (data as any)?.valid_from ?? null,
      valid_to: (data as any)?.valid_to ?? null,
    },
  };
}
