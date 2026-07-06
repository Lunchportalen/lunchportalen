import { describe, expect, it, vi } from "vitest";

import { PHASE_C_ONBOARD_CONFIRMATION_PHRASE, PHASE_C_REQUIRED_GLOBAL_TEMPLATES } from "@/lib/provider-onboarding/phaseCLocales";
import { executeProviderOnboardingApply } from "@/lib/provider-onboarding/providerOnboardingExecute";

const snapshot = {
  existingProviders: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      slug: "melhus-catering",
      name: "Melhus Catering AS",
    },
  ],
  existingAdminEmails: [],
  providersByLocale: [],
  globalTemplateKeys: [...PHASE_C_REQUIRED_GLOBAL_TEMPLATES],
  envPresence: {
    hasSupabaseServiceRole: true,
    hasSanityReadToken: true,
    hasSanityWriteToken: true,
    hasSuperadminCreds: true,
  },
};

const input = {
  providerName: "Danish Lunch Pilot",
  providerSlug: "danish-lunch-pilot",
  locale: "da-DK",
  menuProfileId: "danish_office_lunch",
  country: "DK",
  currency: "DKK",
  timezone: "Europe/Copenhagen",
  adminEmail: "danish-lunch-pilot-admin@lunchportalen.no",
  safeFutureWeek: "2031-11-03",
  mode: "apply" as const,
};

describe("executeProviderOnboardingApply", () => {
  it("does not write when confirmation missing", async () => {
    const createProvider = vi.fn();
    const result = await executeProviderOnboardingApply({
      input: { ...input, operatorConfirmationPhrase: null },
      snapshot,
      adapters: {
        createProvider,
        ensureOrganizationMirror: vi.fn(),
        upsertProviderSettings: vi.fn(),
        provisionProviderAdmin: vi.fn(),
        ensureProviderMembership: vi.fn(),
        syncProviderToSanity: vi.fn(),
        verifySanityMirror: vi.fn(),
      },
    });
    expect(result.ok).toBe(false);
    expect(result.writesPerformed).toBe(false);
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("runs adapter steps without menuDays/publish when confirmation present", async () => {
    const adapters = {
      createProvider: vi.fn(async () => ({ providerId: "new-provider-id" })),
      ensureOrganizationMirror: vi.fn(async () => undefined),
      upsertProviderSettings: vi.fn(async () => undefined),
      provisionProviderAdmin: vi.fn(async () => ({ userId: "user-1", passwordIssued: true })),
      ensureProviderMembership: vi.fn(async () => undefined),
      syncProviderToSanity: vi.fn(async () => undefined),
      verifySanityMirror: vi.fn(async () => ({ ok: true })),
    };

    const result = await executeProviderOnboardingApply({
      input: {
        ...input,
        operatorConfirmationPhrase: PHASE_C_ONBOARD_CONFIRMATION_PHRASE,
      },
      snapshot,
      adapters,
    });

    expect(result.ok).toBe(true);
    expect(result.providerId).toBe("new-provider-id");
    expect(result.writesPerformed).toBe(true);
    expect(result.menuDaysCreated).toBe(false);
    expect(result.published).toBe(false);
    expect(result.sotStarted).toBe(false);
    expect(result.autoRolloutStarted).toBe(false);
    expect(result.passwordPrinted).toBe(false);
    expect(adapters.syncProviderToSanity).toHaveBeenCalledWith("new-provider-id");
  });

  it("refuses protected Melhus slug even with confirmation", async () => {
    const createProvider = vi.fn();
    const result = await executeProviderOnboardingApply({
      input: {
        ...input,
        providerName: "Melhus Catering AS",
        providerSlug: "melhus-catering",
        locale: "nb-NO",
        menuProfileId: "norwegian_company_lunch",
        country: "NO",
        currency: "NOK",
        timezone: "Europe/Oslo",
        operatorConfirmationPhrase: PHASE_C_ONBOARD_CONFIRMATION_PHRASE,
      },
      snapshot,
      adapters: {
        createProvider,
        ensureOrganizationMirror: vi.fn(),
        upsertProviderSettings: vi.fn(),
        provisionProviderAdmin: vi.fn(),
        ensureProviderMembership: vi.fn(),
        syncProviderToSanity: vi.fn(),
        verifySanityMirror: vi.fn(),
      },
    });
    expect(result.ok).toBe(false);
    expect(createProvider).not.toHaveBeenCalled();
  });
});
