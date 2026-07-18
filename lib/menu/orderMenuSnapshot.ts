/**
 * PHASE 17MENU — Immutable order menu snapshot shape.
 * Historical orders must not be rewritten by later translation/menu edits.
 */

import type { CanonicalPackageCategory, PackageKey } from "@/lib/menu/canonicalPackageCategories";

export type OrderMenuSnapshotV1 = {
  schema_version: 1;
  country_code: string;
  market_profile_id: string;
  market_profile_version: string;
  locale_shown: string;
  package_key: PackageKey;
  category_key: CanonicalPackageCategory;
  item_key: string | null;
  variant_key: string | null;
  localized_name: string;
  production_name: string;
  allergens: string[];
  dietary_tags: string[];
  quantity: number;
  currency: string | null;
  unit_price_minor: number | null;
  warm_dish_bank_version: string | null;
  menu_publication_version: string | null;
  provider_id: string;
  company_id: string;
  ordered_at: string;
};

export function buildOrderMenuSnapshot(input: Omit<OrderMenuSnapshotV1, "schema_version">): OrderMenuSnapshotV1 {
  return { schema_version: 1, ...input };
}
