/**
 * PHASE 17MENU — Runtime reader for provider_package_entitlements.
 * Fail-closed when enforcement is enabled and rows are missing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type CanonicalPackageCategory,
  type OrderablePackageCategory,
  type PackageKey,
  PACKAGE_ORDERABLE_CATEGORIES,
  asPackageKey,
  canonicalFromEntitlementKey,
  isOrderableCanonical,
  packageAllowsOrderable,
} from "@/lib/menu/canonicalPackageCategories";

export type PackageEntitlementResolution = {
  packageKey: PackageKey;
  providerId: string;
  /** Enabled canonical categories from DB (+ dual-read legacy keys). */
  enabledCategories: CanonicalPackageCategory[];
  orderableCategories: OrderablePackageCategory[];
  enterpriseUpgradeEnabled: boolean;
  source: "provider_package_entitlements" | "package_contract_fallback";
  dualReadLegacyKeys: boolean;
};

function entitlementsEnforced(): boolean {
  const v = String(process.env.LP_PACKAGE_ENTITLEMENTS_RUNTIME ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export function isPackageEntitlementsRuntimeEnabled(): boolean {
  return entitlementsEnforced();
}

type EntitlementRow = {
  entitlement_key: string;
  is_enabled: boolean;
  package_key: string;
};

export async function resolvePackageEntitlements(
  admin: SupabaseClient,
  args: { providerId: string; packageKey: PackageKey | string },
): Promise<PackageEntitlementResolution> {
  const packageKey = asPackageKey(args.packageKey);
  if (!packageKey) {
    throw new Error(`INVALID_PACKAGE_KEY:${String(args.packageKey)}`);
  }
  const providerId = String(args.providerId ?? "").trim();
  if (!providerId) {
    throw new Error("PROVIDER_ID_REQUIRED");
  }

  const { data, error } = await admin
    .from("provider_package_entitlements")
    .select("entitlement_key, is_enabled, package_key")
    .eq("provider_id", providerId)
    .eq("package_key", packageKey);

  if (error) {
    throw new Error(`ENTITLEMENT_QUERY_FAILED:${error.message}`);
  }

  const rows = (Array.isArray(data) ? data : []) as EntitlementRow[];
  const enabled = new Set<CanonicalPackageCategory>();
  let dualReadLegacyKeys = false;
  let enterpriseUpgradeEnabled = false;

  for (const row of rows) {
    if (!row?.is_enabled) continue;
    const key = String(row.entitlement_key ?? "");
    const canonical = canonicalFromEntitlementKey(key);
    if (!canonical) continue;
    if (key.includes("paasmurt") || key.includes(":salat") || key.endsWith(":thai") || key.includes("pokebowl") || key.includes("varmrett") || key.includes("thaimat")) {
      dualReadLegacyKeys = true;
    }
    enabled.add(canonical);
    if (canonical === "enterprise_upgrade") enterpriseUpgradeEnabled = true;
  }

  if (rows.length === 0) {
    if (entitlementsEnforced()) {
      throw new Error(`ENTITLEMENTS_MISSING:${providerId}:${packageKey}`);
    }
    // Safe fallback for Melhus/pre-wire: hardcoded package contract (not client-decided).
    const fallback = PACKAGE_ORDERABLE_CATEGORIES[packageKey];
    return {
      packageKey,
      providerId,
      enabledCategories: [
        ...fallback,
        ...(packageKey === "ENTERPRISE" ? (["enterprise_upgrade"] as const) : []),
      ],
      orderableCategories: [...fallback],
      enterpriseUpgradeEnabled: packageKey === "ENTERPRISE",
      source: "package_contract_fallback",
      dualReadLegacyKeys: false,
    };
  }

  const orderableCategories = [...enabled].filter(isOrderableCanonical);
  // Fail-closed: never grant categories outside package contract even if DB mis-seeded.
  const clipped = orderableCategories.filter((c) => packageAllowsOrderable(packageKey, c));

  if (entitlementsEnforced() && clipped.length === 0) {
    throw new Error(`ENTITLEMENTS_EMPTY:${providerId}:${packageKey}`);
  }

  return {
    packageKey,
    providerId,
    enabledCategories: [...enabled],
    orderableCategories: clipped,
    enterpriseUpgradeEnabled: enterpriseUpgradeEnabled || (packageKey === "ENTERPRISE" && enabled.has("warm_meal")),
    source: "provider_package_entitlements",
    dualReadLegacyKeys,
  };
}

export function assertChoiceEntitled(
  resolution: PackageEntitlementResolution,
  canonicalCategory: OrderablePackageCategory,
): void {
  if (!resolution.orderableCategories.includes(canonicalCategory)) {
    throw new Error(`PACKAGE_ENTITLEMENT_DENIED:${resolution.packageKey}:${canonicalCategory}`);
  }
}
