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

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normTier(v: unknown): "BASIS" | "LUXUS" | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s;
  return null;
}

/**
 * requireRule
 * - Verifiserer aktiv avtale for firma
 * - Verifiserer at dayKey finnes i delivery_days
 * - Henter deterministisk "gyldig" regel for (company_id, day_key, slot)
 *   - bruker dateISO hvis gitt (valid_from/valid_to)
 *   - tåler flere rader (historikk/duplikater) ved å velge nyeste valid_from
 */
export async function requireRule(args: {
  sb: SupabaseClient;
  companyId: string;
  dayKey: string;
  slot?: string | null;
  dateISO?: string | null; // YYYY-MM-DD (oslo-dato)
  rid?: string | null;
}): Promise<RequireRuleOk | RequireRuleErr> {
  const companyId = safeStr(args.companyId);
  const dayKey = safeStr(args.dayKey).toLowerCase();
  const slot = safeStr(args.slot ?? "lunch").toLowerCase() || "lunch";
  const rid = safeStr(args.rid ?? "");
  const dateISO = safeStr(args.dateISO ?? "");

  if (!companyId || !dayKey) {
    return { ok: false, status: 403, error: "FORBIDDEN", message: "Mangler firmatilknytning eller dag." };
  }

  // 1) Aktiv avtale
  const { data: agreementRow, error: aErr } = await (args.sb as any)
    .from("company_current_agreement")
    .select("id,company_id,status,delivery_days")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (aErr) {
    opsLog("agreement.lookup_failed", {
      rid: rid || null,
      company_id: companyId,
      supabase_error: safeStr((aErr as any)?.message ?? aErr),
    });
    return { ok: false, status: 500, error: "AGREEMENT_LOOKUP_FAILED", message: "Kunne ikke hente avtale." };
  }

  if (!agreementRow?.company_id) {
    return { ok: false, status: 403, error: "AGREEMENT_MISSING", message: "Ingen aktiv avtale for firma." };
  }

  // 2) delivery_days må inneholde dayKey
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

  // 3) Regler: deterministisk plukk 1 rad, tåler flere treff
  let q = (args.sb as any)
    .from("company_current_agreement_rules")
    .select("id,company_id,day_key,slot,is_enabled,tier,price_ex_vat,price_inc_vat,valid_from,valid_to")
    .eq("company_id", companyId)
    .eq("day_key", dayKey)
    .eq("slot", slot)
    .eq("is_enabled", true);

  // Gyldighet hvis dato er gitt:
  // valid_from <= date
  // AND (valid_to IS NULL OR valid_to >= date)
  // NB: vi lar valid_from null være "eldst" (nullsLast i order)
  if (dateISO) {
    q = q.lte("valid_from", dateISO).or(`valid_to.is.null,valid_to.gte.${dateISO}`);
  }

  // Velg "nyeste" regel for dagens treff
  q = q.order("valid_from", { ascending: false, nullsLast: true }).limit(1);

  const { data, error } = await q.maybeSingle();

  if (error) {
    opsLog("agreement.rule.lookup_failed", {
      rid: rid || null,
      company_id: companyId,
      day_key: dayKey,
      slot,
      dateISO: dateISO || null,
      supabase_error: safeStr((error as any)?.message ?? error),
    });
    return { ok: false, status: 500, error: "AGREEMENT_RULE_LOOKUP_FAILED", message: "Kunne ikke hente avtalerregler." };
  }

  if (!data) {
    // (Ingen aktive regler for dag/slot) – eller ikke gyldig innen dato
    opsLog("agreement.rule.missing", {
      rid: rid || null,
      company_id: companyId,
      day_key: dayKey,
      slot,
      dateISO: dateISO || null,
    });
    return { ok: false, status: 403, error: "AGREEMENT_RULE_MISSING", message: "Dagen er ikke aktiv i avtalen." };
  }

  const tier = normTier((data as any)?.tier ?? null);
  if (!tier) {
    opsLog("agreement.rule.invalid_tier", {
      rid: rid || null,
      company_id: companyId,
      day_key: dayKey,
      slot,
      tier_raw: (data as any)?.tier ?? null,
      rule_id: (data as any)?.id ?? null,
    });
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
