import { describe, expect, it } from "vitest";

import {
  LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE,
  mapMsdiLocalizedItemSnapshot,
} from "@/lib/menu-generator/sotMsdiItemMapping";
import { resolveMsdiLocalizedMappingPolicy } from "@/lib/menu-generator/sotMsdiMappingPolicy";
import {
  isLocalizedGeneratorSotMsdiLocalizedMappingEnabled,
  LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED_ENV,
} from "@/lib/menu-generator/sotFeatureFlag";

const DANISH_PILOT = "799ba3a2-a127-48a0-87b7-87944a2f42a3";

const SOT_ENV = {
  LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
  LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
  LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED: "true",
} as const;

describe("MSDI localized mapping feature flag — default OFF", () => {
  it("treats missing MSDI mapping flag as OFF", () => {
    expect(isLocalizedGeneratorSotMsdiLocalizedMappingEnabled({})).toBe(false);
    expect(LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED_ENV).toBe(
      "LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED",
    );
  });

  it("requires explicit true/1 to enable MSDI mapping flag", () => {
    expect(
      isLocalizedGeneratorSotMsdiLocalizedMappingEnabled({
        LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED: "true",
      }),
    ).toBe(true);
    expect(
      isLocalizedGeneratorSotMsdiLocalizedMappingEnabled({
        LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED: "TRUE",
      }),
    ).toBe(false);
  });
});

describe("MSDI localized mapping policy", () => {
  it("keeps sync inactive when all flags OFF", () => {
    const policy = resolveMsdiLocalizedMappingPolicy(DANISH_PILOT, {});
    expect(policy.msdiMappingActiveForSync).toBe(false);
    expect(policy.msdiMappingReady).toBe(false);
  });

  it("keeps sync inactive during dry-run even when mapping flag ON", () => {
    const policy = resolveMsdiLocalizedMappingPolicy(DANISH_PILOT, {
      ...SOT_ENV,
      LP_LOCALIZED_GENERATOR_SOT_DRY_RUN: "true",
    });
    expect(policy.msdiMappingReady).toBe(true);
    expect(policy.dryRun).toBe(true);
    expect(policy.msdiMappingActiveForSync).toBe(false);
  });

  it("activates sync path only when SOT eligible, mapping flag ON, dry-run OFF", () => {
    const policy = resolveMsdiLocalizedMappingPolicy(DANISH_PILOT, SOT_ENV);
    expect(policy.msdiMappingReady).toBe(true);
    expect(policy.msdiMappingActiveForSync).toBe(true);
  });
});

describe("mapMsdiLocalizedItemSnapshot — Danish/DKK no NOK leakage", () => {
  it("maps generated varmrett content with DKK market pricing", () => {
    const result = mapMsdiLocalizedItemSnapshot({
      categoryKey: "varmrett",
      categoryTitle: "Varmrett",
      tier: "BASIS",
      countryCode: "DK",
      currency: "DKK",
      varmrettProjection: {
        mealTitle: "Kylling i karry",
        meal: { title: "Kylling", description: "Med ris", allergens: ["soya"] },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.snapshotMode).toBe(LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE);
    expect(result.productNameSnapshot).toContain("Kylling i karry");
    expect(result.productNameSnapshot).toContain("Allergener:");
    expect(result.currency).toBe("DKK");
    expect(result.offeredPriceCentsExVat).not.toBe(9000);
    expect(result.vatRateSnapshot).toBe(0.25);
  });

  it("fail-closed when varmrett generated content is incomplete", () => {
    const result = mapMsdiLocalizedItemSnapshot({
      categoryKey: "varmrett",
      categoryTitle: "Varmrett",
      tier: "BASIS",
      countryCode: "DK",
      currency: "DKK",
      varmrettProjection: { mealTitle: null, meal: null },
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.blocker).toBe("incomplete_varmrett_generated_content");
  });

  it("fail-closed on currency/market mismatch", () => {
    const result = mapMsdiLocalizedItemSnapshot({
      categoryKey: "varmrett",
      categoryTitle: "Varmrett",
      tier: "BASIS",
      countryCode: "DK",
      currency: "NOK",
      varmrettProjection: { mealTitle: "Test", meal: null },
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.blocker).toBe("currency_market_mismatch");
  });
});

describe("mapMsdiLocalizedItemSnapshot — static categories", () => {
  it("maps localized lunch category items for non-varmrett categories", () => {
    const result = mapMsdiLocalizedItemSnapshot({
      categoryKey: "paasmurt",
      categoryTitle: "Påsmurt",
      tier: "BASIS",
      countryCode: "DK",
      currency: "DKK",
      staticCategoryItems: [{ title: "Ost & Skinke", description: "Klassiker", allergens: ["melk"] }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.productNameSnapshot).toContain("Ost & Skinke");
    expect(result.currency).toBe("DKK");
  });
});
