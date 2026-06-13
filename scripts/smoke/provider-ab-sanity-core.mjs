/**
 * Pure Provider A/B Sanity doc builders (no Sanity client I/O).
 */
import {
  FIXTURE_DATE,
  FIXTURE_MENU_CATEGORY_SANITY,
  FIXTURE_TIER,
  PROVIDER_A,
  PROVIDER_B,
} from "./fixtures/provider-ab-staging.constants.mjs";

const FORBIDDEN_DATASETS = new Set(["production", "prod"]);

/**
 * @returns {string}
 */
export function resolveSanityDatasetFromEnv() {
  return (
    String(process.env.SANITY_DATASET ?? "").trim() ||
    String(process.env.NEXT_PUBLIC_SANITY_DATASET ?? "").trim() ||
    ""
  );
}

/**
 * Fail-closed dataset guard.
 * @param {string} dataset
 */
export function assertSanityStagingDataset(dataset) {
  const d = String(dataset ?? "").trim().toLowerCase();
  if (!d) {
    throw new Error("ABORT: SANITY_DATASET / NEXT_PUBLIC_SANITY_DATASET must be set");
  }
  if (FORBIDDEN_DATASETS.has(d)) {
    throw new Error(`ABORT: refuse Sanity dataset "${dataset}" — staging only`);
  }
  if (d !== "staging") {
    throw new Error(`ABORT: Sanity dataset must be "staging" (got "${dataset}")`);
  }
  return d;
}

/**
 * Pure doc builders for dry-run / tests.
 */
export function buildProviderAbSanityDocs() {
  const nowISO = new Date().toISOString();
  return {
    providerB: {
      _id: PROVIDER_B.sanityProviderDocId,
      _type: "provider",
      name: PROVIDER_B.name,
      slug: { _type: "slug", current: PROVIDER_B.slug },
    },
    menuDayA: {
      _id: PROVIDER_A.sanityMenuDayDocId,
      _type: "menuDay",
      date: FIXTURE_DATE,
      planTier: FIXTURE_TIER,
      category: FIXTURE_MENU_CATEGORY_SANITY,
      provider: { _type: "reference", _ref: PROVIDER_A.providerId },
      mealTitle: PROVIDER_A.menuLabel,
      description: "Provider A A/B fixture menuDay (staging)",
      customerVisible: true,
      approvedForPublish: true,
      customerVisibleSetAt: nowISO,
      approvedAt: nowISO,
    },
    menuDayB: {
      _id: PROVIDER_B.sanityMenuDayDocId,
      _type: "menuDay",
      date: FIXTURE_DATE,
      planTier: FIXTURE_TIER,
      category: FIXTURE_MENU_CATEGORY_SANITY,
      provider: { _type: "reference", _ref: PROVIDER_B.providerId },
      mealTitle: PROVIDER_B.menuLabel,
      description: "Provider B A/B fixture menuDay (staging)",
      customerVisible: true,
      approvedForPublish: true,
      customerVisibleSetAt: nowISO,
      approvedAt: nowISO,
    },
  };
}
