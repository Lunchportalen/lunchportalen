/**
 * PHASE 17MENU.1 — Provider-owned package pricing (no global hardcoded package prices).
 */

import type { PackageKey } from "@/lib/menu/canonicalPackageCategories";

export type ProviderPriceRecord = {
  provider_id: string;
  company_id: string | null;
  country_code: string;
  currency: string;
  package_key: PackageKey;
  upgrade_key: string | null;
  price_minor: number;
  minimum_quantity: number;
  maximum_quantity: number | null;
  effective_from: string;
  effective_to: string | null;
  price_version: string;
  active_status: boolean;
  created_by: string;
  created_at: string;
  audit_event_id: string;
};

export type PriceResolution =
  | { ok: true; record: ProviderPriceRecord; source: "company_contract" | "volume_rule" | "provider_default" }
  | { ok: false; code: "PRICE_NOT_FOUND" | "CURRENCY_MISMATCH" | "INACTIVE" | "OUT_OF_RANGE" };

export function resolveProviderPrice(args: {
  records: readonly ProviderPriceRecord[];
  providerId: string;
  companyId: string | null;
  countryCode: string;
  currency: string;
  packageKey: PackageKey;
  upgradeKey?: string | null;
  asOfIsoDate: string;
  quantity: number;
}): PriceResolution {
  const upgradeKey = args.upgradeKey ?? null;
  const active = args.records.filter((r) => {
    if (!r.active_status) return false;
    if (r.provider_id !== args.providerId) return false;
    if (r.country_code !== args.countryCode) return false;
    if (r.currency !== args.currency) return false;
    if (r.package_key !== args.packageKey) return false;
    if ((r.upgrade_key ?? null) !== upgradeKey) return false;
    if (r.effective_from > args.asOfIsoDate) return false;
    if (r.effective_to && r.effective_to < args.asOfIsoDate) return false;
    return true;
  });

  const companySpecific = active.find((r) => r.company_id && r.company_id === args.companyId);
  const volume = active.find(
    (r) =>
      !r.company_id &&
      args.quantity >= r.minimum_quantity &&
      (r.maximum_quantity == null || args.quantity <= r.maximum_quantity) &&
      r.audit_event_id.includes("volume"),
  );
  const providerDefault = active.find((r) => !r.company_id && !r.audit_event_id.includes("volume"));

  const chosen = companySpecific
    ? ({ record: companySpecific, source: "company_contract" as const })
    : volume
      ? ({ record: volume, source: "volume_rule" as const })
      : providerDefault
        ? ({ record: providerDefault, source: "provider_default" as const })
        : null;

  if (!chosen) return { ok: false, code: "PRICE_NOT_FOUND" };
  if (chosen.record.currency !== args.currency) return { ok: false, code: "CURRENCY_MISMATCH" };
  if (
    args.quantity < chosen.record.minimum_quantity ||
    (chosen.record.maximum_quantity != null && args.quantity > chosen.record.maximum_quantity)
  ) {
    return { ok: false, code: "OUT_OF_RANGE" };
  }
  if (!Number.isInteger(chosen.record.price_minor)) {
    throw new Error("FLOATING_POINT_FINANCIAL_USAGE:price_minor");
  }
  return { ok: true, ...chosen };
}

export type OrderPriceSnapshot = {
  provider_id: string;
  company_id: string;
  country_code: string;
  currency: string;
  package_key: PackageKey;
  package_price_minor: number;
  upgrades: Array<{ upgrade_key: string; price_minor: number }>;
  quantity: number;
  price_version: string;
  effective_date: string;
  commissionable: boolean;
  customer_tax_exclusive_total_minor: number;
};

export function buildOrderPriceSnapshot(args: {
  providerId: string;
  companyId: string;
  countryCode: string;
  currency: string;
  packageKey: PackageKey;
  packagePriceMinor: number;
  upgrades: Array<{ upgrade_key: string; price_minor: number }>;
  quantity: number;
  priceVersion: string;
  effectiveDate: string;
}): OrderPriceSnapshot {
  const qty = args.quantity;
  if (!Number.isInteger(qty) || qty < 1) throw new Error("INVALID_QUANTITY");
  const upgradeSum = args.upgrades.reduce((s, u) => {
    if (!Number.isInteger(u.price_minor)) throw new Error("FLOATING_POINT_FINANCIAL_USAGE:upgrade");
    return s + u.price_minor;
  }, 0);
  const package_price_minor = args.packagePriceMinor;
  if (!Number.isInteger(package_price_minor)) throw new Error("FLOATING_POINT_FINANCIAL_USAGE:package");
  return {
    provider_id: args.providerId,
    company_id: args.companyId,
    country_code: args.countryCode,
    currency: args.currency,
    package_key: args.packageKey,
    package_price_minor,
    upgrades: args.upgrades,
    quantity: qty,
    price_version: args.priceVersion,
    effective_date: args.effectiveDate,
    commissionable: true,
    customer_tax_exclusive_total_minor: (package_price_minor + upgradeSum) * qty,
  };
}
