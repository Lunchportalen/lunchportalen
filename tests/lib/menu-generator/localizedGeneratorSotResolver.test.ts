import { describe, expect, it } from "vitest";

import {
  buildLocalizedGeneratorSotInactiveControl,
  buildLocalizedGeneratorSotProviderControl,
} from "@/lib/menu-generator/localizedGeneratorSotControl";
import {
  LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE,
} from "@/lib/menu-generator/sotMsdiItemMapping";
import {
  LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE,
  resolveLocalizedGeneratorSotDecision,
} from "@/lib/menu-generator/localizedGeneratorSotResolver";

const DANISH_PILOT = "799ba3a2-a127-48a0-87b7-87944a2f42a3";
const MELHUS = "11111111-1111-1111-1111-111111111111";

describe("localized generator SOT resolver — default OFF / kill switch", () => {
  it("keeps legacy source when env missing", () => {
    const decision = resolveLocalizedGeneratorSotDecision({ providerId: DANISH_PILOT });
    expect(decision.selectedSource).toBe("legacy");
    expect(decision.canServeGeneratedAsAuthoritative).toBe(false);
    expect(decision.sourceOfTruthChanged).toBe(false);
    expect(decision.autoRollout).toBe(false);
    expect(decision.hasMutationIntent).toBe(false);
    expect(decision.sotEligible).toBe(false);
    expect(decision.wouldSelectGenerated).toBe(false);
  });

  it("kill switch OFF reverts to legacy even with allowlist configured", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: DANISH_PILOT,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
      },
    });
    expect(decision.sotMasterEnabled).toBe(false);
    expect(decision.selectedSource).toBe("legacy");
    expect(decision.reasons).toContain("kill_switch_off");
  });
});

describe("localized generator SOT resolver — allowlist inertness", () => {
  it("master ON but provider not allowlisted stays legacy", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: MELHUS,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
      },
    });
    expect(decision.providerAllowlisted).toBe(false);
    expect(decision.sotEligible).toBe(false);
    expect(decision.selectedSource).toBe("legacy");
  });

  it("allowlisted provider is eligible but still legacy serve in F0", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: DANISH_PILOT,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
      },
    });
    expect(decision.sotEligible).toBe(true);
    expect(decision.wouldSelectGenerated).toBe(true);
    expect(decision.selectedSource).toBe("legacy");
    expect(decision.canServeGeneratedAsAuthoritative).toBe(false);
    expect(decision.reasons).toContain("f0_hook_not_wired");
  });
});

describe("localized generator SOT resolver — dry-run", () => {
  it("dry-run reports would-select without mutation intent", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: DANISH_PILOT,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
        LP_LOCALIZED_GENERATOR_SOT_DRY_RUN: "true",
      },
    });
    expect(decision.dryRun).toBe(true);
    expect(decision.wouldSelectGenerated).toBe(true);
    expect(decision.hasMutationIntent).toBe(false);
    expect(decision.selectedSource).toBe("legacy");
    expect(decision.reasons).toContain("dry_run_observe_only");
  });
});

describe("localized generator SOT resolver — boundaries", () => {
  it("never enables auto-rollout or source-of-truth switch", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: DANISH_PILOT,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
        LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED: "true",
      },
    });
    expect(decision.autoRollout).toBe(false);
    expect(decision.sourceOfTruthChanged).toBe(false);
    expect(decision.reasons).toContain("auto_rollout_forbidden");
  });

  it("documents MSDI v1 tier-product global catalog boundary when mapping flag OFF", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: DANISH_PILOT,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
      },
    });
    expect(decision.msdiSnapshotMode).toBe(LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE);
    expect(decision.msdiLocalizedMappingBlocked).toBe(true);
    expect(decision.wouldUseMsdiLocalizedMapping).toBe(false);
    expect(decision.reasons).toContain("msdi_v1_tier_products_global_boundary");
  });

  it("unblocks localized MSDI mapping when mapping flag ON for allowlisted provider", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: DANISH_PILOT,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
        LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED: "true",
      },
    });
    expect(decision.msdiSnapshotMode).toBe(LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE);
    expect(decision.msdiLocalizedMappingBlocked).toBe(false);
    expect(decision.wouldUseMsdiLocalizedMapping).toBe(true);
    expect(decision.selectedSource).toBe("legacy");
    expect(decision.canServeGeneratedAsAuthoritative).toBe(false);
  });

  it("dry-run reports MSDI mapping preview without mutation intent", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: DANISH_PILOT,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
        LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_DRY_RUN: "true",
      },
      dryRunMarket: { countryCode: "DK", currency: "DKK" },
      varmrettProjection: { mealTitle: "Kylling i karry", meal: { title: "Kylling", allergens: ["soya"] } },
    });
    expect(decision.dryRun).toBe(true);
    expect(decision.hasMutationIntent).toBe(false);
    expect(decision.dryRunMsdiMappingPreview).not.toBeNull();
    expect(decision.dryRunMsdiMappingPreview?.currency).toBe("DKK");
    const sample = decision.dryRunMsdiMappingPreview?.sampleVarmrett;
    expect(sample && "offeredPriceCentsExVat" in sample).toBe(true);
    if (sample && "offeredPriceCentsExVat" in sample) {
      expect(sample.offeredPriceCentsExVat).not.toBe(9000);
      expect(sample.currency).toBe("DKK");
    }
  });
});

describe("localized generator SOT control", () => {
  it("builds inactive control when master OFF", () => {
    const control = buildLocalizedGeneratorSotInactiveControl({});
    expect(control.status).toBe("inactive");
    expect(control.active).toBe(false);
    expect(control.productionCutoverAllowed).toBe(false);
    expect(control.decision).toBeNull();
  });

  it("builds dry_run control for allowlisted provider", () => {
    const control = buildLocalizedGeneratorSotProviderControl(
      {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
        LP_LOCALIZED_GENERATOR_SOT_DRY_RUN: "true",
      },
      DANISH_PILOT,
    );
    expect(control.status).toBe("dry_run");
    expect(control.selectedSource).toBe("legacy");
    expect(control.sourceOfTruthChanged).toBe(false);
  });
});
