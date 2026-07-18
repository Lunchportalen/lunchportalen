/**
 * PHASE 17MENU.1 — Enterprise as provider–company contract product (not automatic Luxus).
 */

import type { OrderablePackageCategory, PackageKey } from "@/lib/menu/canonicalPackageCategories";

export type EnterpriseUpgradeKey =
  | "premium_protein"
  | "larger_portion"
  | "dessert"
  | "premium_side"
  | "special_weekday"
  | "enterprise_upgrade";

export type EnterpriseContract = {
  contract_id: string;
  provider_id: string;
  company_id: string;
  country_code: string;
  currency: string;
  base_price_minor: number;
  base_price_version: string;
  included_categories: OrderablePackageCategory[];
  included_upgrades: EnterpriseUpgradeKey[];
  paid_upgrades: Array<{ upgrade_key: EnterpriseUpgradeKey; price_minor: number; price_version: string }>;
  minimum_daily_quantity: number;
  contractual_volume: number | null;
  delivery_points: string[];
  delivery_windows: string[];
  capacity: number;
  cutoff: string;
  operating_days: string[];
  effective_from: string;
  effective_to: string | null;
  cost_centers: string[];
  reporting_needs: string[];
  version: string;
  audit_event_id: string;
};

/** Enterprise always includes warm_meal; never silently inherits full Luxus. */
export function assertEnterpriseContract(contract: EnterpriseContract): void {
  if (!contract.included_categories.includes("warm_meal")) {
    throw new Error("ENTERPRISE_MISSING_WARM_MEAL");
  }
  if (!Number.isInteger(contract.base_price_minor)) {
    throw new Error("FLOATING_POINT_FINANCIAL_USAGE:enterprise_base");
  }
  for (const u of contract.paid_upgrades) {
    if (!Number.isInteger(u.price_minor)) throw new Error("FLOATING_POINT_FINANCIAL_USAGE:upgrade");
  }
}

export type EnterpriseEmployeeVisibility = "included" | "paid_upgrade" | "unavailable";

export function enterpriseEmployeeVisibility(
  contract: EnterpriseContract,
  category: OrderablePackageCategory,
  upgradeKey?: EnterpriseUpgradeKey | null,
): { visibility: EnterpriseEmployeeVisibility; price_minor: number | null } {
  assertEnterpriseContract(contract);
  if (upgradeKey) {
    if (contract.included_upgrades.includes(upgradeKey)) {
      return { visibility: "included", price_minor: 0 };
    }
    const paid = contract.paid_upgrades.find((u) => u.upgrade_key === upgradeKey);
    if (paid) return { visibility: "paid_upgrade", price_minor: paid.price_minor };
    return { visibility: "unavailable", price_minor: null };
  }
  if (contract.included_categories.includes(category)) {
    return { visibility: "included", price_minor: 0 };
  }
  return { visibility: "unavailable", price_minor: null };
}

export function enterpriseIsNotAutomaticLuxus(contract: EnterpriseContract): boolean {
  const luxusOnly: OrderablePackageCategory[] = ["sushi", "poke_bowl", "thai"];
  // Pass when Enterprise does not automatically include all Luxus premium categories.
  const autoAll = luxusOnly.every((c) => contract.included_categories.includes(c));
  return !autoAll;
}

export function packageKeyForEnterprise(): PackageKey {
  return "ENTERPRISE";
}
