/**
 * Canonical package entitlement definitions for Phase 18SCALE seed.
 * Mirrors lib/menu/canonicalPackageCategories.ts PACKAGE_CANONICAL_CATEGORIES.
 */
export const PACKAGE_CANONICAL_CATEGORIES = {
  BASIS: ["sandwich", "salad_box", "warm_meal"],
  LUXUS: ["sandwich", "salad_box", "warm_meal", "sushi", "poke_bowl", "thai"],
  ENTERPRISE: [
    "sandwich",
    "salad_box",
    "warm_meal",
    "sushi",
    "poke_bowl",
    "thai",
    "enterprise_upgrade",
  ],
};

export const PACKAGES = Object.keys(PACKAGE_CANONICAL_CATEGORIES);

/** Stable DB entitlement_key for a canonical category. */
export function entitlementKeyForCanonical(cat) {
  if (cat === "enterprise_upgrade") return "enterprise_upgrade";
  return `menu_category:${cat}`;
}

/** Expected entitlement rows for one provider (all packages). */
export function expectedEntitlementsPerProvider() {
  return PACKAGES.reduce((n, pkg) => n + PACKAGE_CANONICAL_CATEGORIES[pkg].length, 0);
}

/** Build deterministic entitlement row payloads for one provider. */
export function buildProviderEntitlementRows(providerId, country) {
  const rows = [];
  for (const packageKey of PACKAGES) {
    for (const cat of PACKAGE_CANONICAL_CATEGORIES[packageKey]) {
      const entitlementKey = entitlementKeyForCanonical(cat);
      rows.push({
        provider_id: providerId,
        package_key: packageKey,
        entitlement_key: entitlementKey,
        is_enabled: true,
        default_value: {
          category: cat,
          country,
          source: "phase18scale_canonical",
          can_order: cat !== "enterprise_upgrade",
        },
      });
    }
  }
  return rows;
}
