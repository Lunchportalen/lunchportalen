import { describe, expect, it } from "vitest";

import { buildPhaseCLocaleInventoryRow } from "@/lib/provider-onboarding/phaseCInventoryClassify";

const base = {
  locale: "da-DK",
  menuProfileId: "danish_office_lunch",
  country: "DK",
  currency: "DKK",
  timezone: "Europe/Copenhagen",
  providerExists: false,
  providerId: null,
  providerSlug: null,
  organizationMirrorExists: false,
  providerSettingsComplete: false,
  providerAdminAuthExists: false,
  providerMembershipExists: false,
  automationCredsAvailable: false,
  sanityProviderMirrorExists: false,
  providerRefResolves: false,
  globalSanityTemplatesOk: true,
  providerScopedCatalogDocs: 0,
  existingFutureMenuDays: 0,
  latestApplyOrDryRunEvidence: null,
};

describe("classifyPhaseCLocaleInventory", () => {
  it("classifies missing provider as BLOCKED_PROVIDER", () => {
    const row = buildPhaseCLocaleInventoryRow(base);
    expect(row.classification).toBe("BLOCKED_PROVIDER");
    expect(row.canDryRunToday).toBe(false);
    expect(row.canApplyAfterGo).toBe(false);
  });

  it("classifies Melhus-like row with evidence as READY_FOR_SCOPED_APPLY", () => {
    const row = buildPhaseCLocaleInventoryRow({
      ...base,
      locale: "nb-NO",
      menuProfileId: "norwegian_company_lunch",
      country: "NO",
      currency: "NOK",
      timezone: "Europe/Oslo",
      providerExists: true,
      providerId: "11111111-1111-1111-1111-111111111111",
      providerSlug: "melhus-catering",
      organizationMirrorExists: true,
      providerSettingsComplete: true,
      providerAdminAuthExists: true,
      providerMembershipExists: true,
      automationCredsAvailable: true,
      sanityProviderMirrorExists: true,
      providerRefResolves: true,
      providerScopedCatalogDocs: 2,
      existingFutureMenuDays: 15,
      latestApplyOrDryRunEvidence: "PR #430 production smoke",
    });
    expect(row.classification).toBe("READY_FOR_SCOPED_APPLY");
    expect(row.canDryRunToday).toBe(true);
    expect(row.canApplyAfterGo).toBe(true);
  });

  it("classifies missing mirror as BLOCKED_SANITY_MIRROR", () => {
    const row = buildPhaseCLocaleInventoryRow({
      ...base,
      providerExists: true,
      providerId: "x",
      providerSlug: "danish-lunch-pilot",
      organizationMirrorExists: true,
      providerSettingsComplete: true,
      providerAdminAuthExists: true,
      providerMembershipExists: true,
      automationCredsAvailable: true,
      sanityProviderMirrorExists: false,
      providerRefResolves: false,
    });
    expect(row.classification).toBe("BLOCKED_SANITY_MIRROR");
  });
});
