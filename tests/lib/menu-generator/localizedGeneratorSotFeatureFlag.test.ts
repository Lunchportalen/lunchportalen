import { describe, expect, it } from "vitest";

import {
  isLocalizedGeneratorAutoRolloutEnabled,
  isLocalizedGeneratorSotDryRunEnabled,
  isLocalizedGeneratorSotEligibleForProvider,
  isLocalizedGeneratorSotEnabled,
  isLocalizedGeneratorSotMsdiLocalizedMappingEnabled,
  isProviderInLocalizedGeneratorSotAllowlist,
  parseLocalizedGeneratorSotProviderAllowlist,
} from "@/lib/menu-generator/sotFeatureFlag";

const DANISH_PILOT = "799ba3a2-a127-48a0-87b7-87944a2f42a3";
const MELHUS = "11111111-1111-1111-1111-111111111111";

describe("localized generator SOT feature flags — default OFF", () => {
  it("treats missing env as OFF", () => {
    expect(isLocalizedGeneratorSotEnabled({})).toBe(false);
    expect(isLocalizedGeneratorSotDryRunEnabled({})).toBe(false);
    expect(isLocalizedGeneratorAutoRolloutEnabled({})).toBe(false);
    expect(parseLocalizedGeneratorSotProviderAllowlist({})).toEqual([]);
  });

  it("treats malformed truthy values as OFF", () => {
    expect(isLocalizedGeneratorSotEnabled({ LP_LOCALIZED_GENERATOR_SOT_ENABLED: "yes" })).toBe(false);
    expect(isLocalizedGeneratorSotEnabled({ LP_LOCALIZED_GENERATOR_SOT_ENABLED: "TRUE" })).toBe(false);
    expect(isLocalizedGeneratorSotDryRunEnabled({ LP_LOCALIZED_GENERATOR_SOT_DRY_RUN: "2" })).toBe(false);
  });

  it("accepts only true or 1 for master and dry-run flags", () => {
    expect(isLocalizedGeneratorSotEnabled({ LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true" })).toBe(true);
    expect(isLocalizedGeneratorSotEnabled({ LP_LOCALIZED_GENERATOR_SOT_ENABLED: "1" })).toBe(true);
    expect(isLocalizedGeneratorSotDryRunEnabled({ LP_LOCALIZED_GENERATOR_SOT_DRY_RUN: "true" })).toBe(true);
  });
});

describe("localized generator SOT provider allowlist", () => {
  it("returns empty allowlist when env missing or blank", () => {
    expect(parseLocalizedGeneratorSotProviderAllowlist({})).toEqual([]);
    expect(parseLocalizedGeneratorSotProviderAllowlist({ LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: "  " })).toEqual(
      [],
    );
  });

  it("ignores invalid tokens and deduplicates", () => {
    const env = {
      LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: `${DANISH_PILOT},not-a-uuid,${DANISH_PILOT.toUpperCase()}, ,`,
    };
    expect(parseLocalizedGeneratorSotProviderAllowlist(env)).toEqual([DANISH_PILOT]);
  });

  it("enabled flag with empty allowlist keeps provider inert", () => {
    const env = { LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true" };
    expect(isProviderInLocalizedGeneratorSotAllowlist(DANISH_PILOT, env)).toBe(false);
    expect(isLocalizedGeneratorSotEligibleForProvider(DANISH_PILOT, env)).toBe(false);
  });

  it("allowlists only explicit provider IDs when master ON", () => {
    const env = {
      LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
      LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
    };
    expect(isProviderInLocalizedGeneratorSotAllowlist(DANISH_PILOT, env)).toBe(true);
    expect(isProviderInLocalizedGeneratorSotAllowlist(MELHUS, env)).toBe(false);
    expect(isLocalizedGeneratorSotEligibleForProvider(DANISH_PILOT, env)).toBe(true);
    expect(isLocalizedGeneratorSotEligibleForProvider(MELHUS, env)).toBe(false);
  });
});

describe("localized generator SOT auto-rollout boundary", () => {
  it("auto-rollout flag is independent and default OFF", () => {
    const env = {
      LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
      LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED: "true",
    };
    expect(isLocalizedGeneratorAutoRolloutEnabled(env)).toBe(true);
    expect(isLocalizedGeneratorSotEnabled(env)).toBe(true);
  });

  it("MSDI mapping flag is default OFF and independent of master SOT", () => {
    expect(isLocalizedGeneratorSotMsdiLocalizedMappingEnabled({})).toBe(false);
    expect(
      isLocalizedGeneratorSotMsdiLocalizedMappingEnabled({
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
      }),
    ).toBe(false);
    expect(
      isLocalizedGeneratorSotMsdiLocalizedMappingEnabled({
        LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED: "1",
      }),
    ).toBe(true);
  });
});
