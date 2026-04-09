// lib/orders/agreementContractFallback.ts
import "server-only";

import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import type { DayKey } from "@/lib/agreements/normalize";
import { fallbackBasisChoicesClient, fallbackLuxusChoicesClient } from "@/lib/cms/mealTierFallback";

export type OrderContractTier = "BASIS" | "PREMIUM";

type Choice = { key: string; label?: string };

/**
 * When `companies.contract_week_tier` is not populated, derive tier for a weekday
 * from the ACTIVE `agreements` row (same source of truth as lp_order_set).
 */
export async function resolveTierForOrderDay(
  admin: any,
  companyId: string,
  locationId: string,
  dayKey: DayKey,
  existingWeekTier: Record<string, OrderContractTier> | null | undefined
): Promise<OrderContractTier | null> {
  const direct = existingWeekTier?.[dayKey];
  if (direct) return direct;

  const { data: agr } = await admin
    .from("agreements")
    .select("tier, delivery_days, status")
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!agr) return null;
  const dn = normalizeDeliveryDaysStrict((agr as { delivery_days?: unknown }).delivery_days);
  if (!dn.days.includes(dayKey)) return null;
  const at = String((agr as { tier?: unknown }).tier ?? "").toUpperCase();
  return at === "LUXUS" ? "PREMIUM" : "BASIS";
}

export function ensureMealChoicesPresent(basis: Choice[], premium: Choice[]): { basis: Choice[]; premium: Choice[] } {
  let b = (basis ?? []).filter((x) => x?.key);
  let p = (premium ?? []).filter((x) => x?.key);
  if (!b.length) b = fallbackBasisChoicesClient().map((c) => ({ key: c.key }));
  if (!p.length) p = fallbackLuxusChoicesClient().map((c) => ({ key: c.key }));
  return { basis: b, premium: p };
}
