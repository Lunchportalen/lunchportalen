import { describe, expect, it } from "vitest";

import {
  PHASE_C_ONBOARD_CONFIRMATION_PHRASE,
  PHASE_C_REQUIRED_GLOBAL_TEMPLATES,
} from "@/lib/provider-onboarding/phaseCLocales";
import {
  buildProviderOnboardingPlan,
  serializeProviderOnboardingPlan,
} from "@/lib/provider-onboarding/providerOnboardingPlan";
import type {
  ProviderOnboardingInput,
  ProviderOnboardingPreflightSnapshot,
} from "@/lib/provider-onboarding/providerOnboardingTypes";

const ENV_OK = {
  hasSupabaseServiceRole: true,
  hasSanityReadToken: true,
  hasSanityWriteToken: true,
  hasSuperadminCreds: true,
};

function baseSnapshot(
  partial: Partial<ProviderOnboardingPreflightSnapshot> = {},
): ProviderOnboardingPreflightSnapshot {
  return {
    existingProviders: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        slug: "melhus-catering",
        name: "Melhus Catering AS",
      },
      {
        id: "a08e4742-c89d-48c5-a6a8-cf8532179083",
        slug: "swedish-lunch-pilot",
        name: "Swedish Lunch Pilot",
      },
    ],
    existingAdminEmails: [
      "melhus-admin@example.com",
      "swedish-lunch-pilot-admin@lunchportalen.no",
    ],
    providersByLocale: [
      { providerId: "11111111-1111-1111-1111-111111111111", locale: "nb-NO" },
      { providerId: "a08e4742-c89d-48c5-a6a8-cf8532179083", locale: "sv-SE" },
    ],
    globalTemplateKeys: [...PHASE_C_REQUIRED_GLOBAL_TEMPLATES],
    envPresence: ENV_OK,
    ...partial,
  };
}

function danishInput(
  partial: Partial<ProviderOnboardingInput> = {},
): ProviderOnboardingInput {
  return {
    providerName: "Danish Lunch Pilot",
    providerSlug: "danish-lunch-pilot",
    locale: "da-DK",
    menuProfileId: "danish_office_lunch",
    country: "DK",
    currency: "DKK",
    timezone: "Europe/Copenhagen",
    adminEmail: "danish-lunch-pilot-admin@lunchportalen.no",
    safeFutureWeek: "2031-11-03",
    mode: "dry_run",
    ...partial,
  };
}

describe("buildProviderOnboardingPlan", () => {
  it("dryRun valid da-DK plan produces zero-write semantics and full write plan", () => {
    const plan = buildProviderOnboardingPlan(danishInput(), baseSnapshot());
    expect(plan.ok).toBe(true);
    expect(plan.mode).toBe("dry_run");
    expect(plan.writePlan.length).toBeGreaterThan(0);
    expect(plan.writePlan.some((s) => s.action === "syncProviderToSanity")).toBe(true);
    expect(plan.willCreateMenuDays).toBe(false);
    expect(plan.willPublish).toBe(false);
    expect(plan.willStartSot).toBe(false);
    expect(plan.willStartAutoRollout).toBe(false);
    expect(plan.safeToOnboardApply).toBe(false);
    expect(plan.rollbackPlan.length).toBeGreaterThan(0);
  });

  it("locale/profile mismatch stops", () => {
    const plan = buildProviderOnboardingPlan(
      danishInput({ menuProfileId: "swedish_lunch" }),
      baseSnapshot(),
    );
    expect(plan.ok).toBe(false);
    expect(plan.blockers.some((b) => b.code === "LOCALE_PROFILE_MISMATCH")).toBe(true);
  });

  it("slug conflict stops", () => {
    const plan = buildProviderOnboardingPlan(
      danishInput({ providerSlug: "melhus-catering", providerName: "Other Name" }),
      baseSnapshot(),
    );
    expect(plan.ok).toBe(false);
    expect(
      plan.blockers.some(
        (b) => b.code === "SLUG_CONFLICT" || b.code === "PROTECTED_PROVIDER_MUTATION",
      ),
    ).toBe(true);
  });

  it("admin email conflict stops", () => {
    const plan = buildProviderOnboardingPlan(
      danishInput({ adminEmail: "swedish-lunch-pilot-admin@lunchportalen.no" }),
      baseSnapshot(),
    );
    expect(plan.ok).toBe(false);
    expect(plan.blockers.some((b) => b.code === "ADMIN_EMAIL_CONFLICT")).toBe(true);
  });

  it("missing global template stops", () => {
    const plan = buildProviderOnboardingPlan(
      danishInput(),
      baseSnapshot({ globalTemplateKeys: ["paasmurt", "vegetarian"] }),
    );
    expect(plan.ok).toBe(false);
    expect(plan.blockers.some((b) => b.code === "MISSING_GLOBAL_TEMPLATE")).toBe(true);
  });

  it("apply mode without confirmation stops", () => {
    const plan = buildProviderOnboardingPlan(
      danishInput({ mode: "apply", operatorConfirmationPhrase: "wrong" }),
      baseSnapshot(),
    );
    expect(plan.ok).toBe(false);
    expect(plan.blockers.some((b) => b.code === "MISSING_CONFIRMATION")).toBe(true);
    expect(plan.writePlan).toEqual([]);
  });

  it("apply mode requires syncProviderToSanity in plan", () => {
    const plan = buildProviderOnboardingPlan(
      danishInput({
        mode: "apply",
        operatorConfirmationPhrase: PHASE_C_ONBOARD_CONFIRMATION_PHRASE,
      }),
      baseSnapshot(),
    );
    expect(plan.ok).toBe(true);
    expect(plan.writePlan.some((s) => s.action === "syncProviderToSanity")).toBe(true);
    expect(plan.safeToOnboardApply).toBe(true);
  });

  it("output redacts secrets", () => {
    const plan = buildProviderOnboardingPlan(danishInput(), baseSnapshot());
    const json = JSON.stringify(serializeProviderOnboardingPlan(plan));
    expect(plan.credentialsHandling.passwordPrinted).toBe(false);
    expect(plan.secretsRedacted).toBe(true);
    expect(json).not.toMatch(/password\s*[:=]\s*["'][^"']+["']/i);
    expect(json).not.toContain("eyJ");
    expect(json).not.toContain("service_role");
  });

  it("rollback/deactivation plan generated", () => {
    const plan = buildProviderOnboardingPlan(danishInput(), baseSnapshot());
    expect(plan.rollbackPlan.map((s) => s.action)).toContain("mark_provider_inactive");
    expect(plan.rollbackPlan.map((s) => s.action)).toContain("deactivate_membership");
  });

  it("existing Melhus/Swedish providers cannot be mutated", () => {
    const melhus = buildProviderOnboardingPlan(
      danishInput({
        providerName: "Melhus Catering AS",
        providerSlug: "melhus-catering",
        locale: "nb-NO",
        menuProfileId: "norwegian_company_lunch",
        country: "NO",
        currency: "NOK",
        timezone: "Europe/Oslo",
      }),
      baseSnapshot(),
    );
    const swedish = buildProviderOnboardingPlan(
      danishInput({
        providerName: "Swedish Lunch Pilot",
        providerSlug: "swedish-lunch-pilot",
        locale: "sv-SE",
        menuProfileId: "swedish_lunch",
        country: "SE",
        currency: "SEK",
        timezone: "Europe/Stockholm",
      }),
      baseSnapshot(),
    );
    expect(melhus.ok).toBe(false);
    expect(swedish.ok).toBe(false);
    expect(melhus.blockers.some((b) => b.code === "PROTECTED_PROVIDER_MUTATION")).toBe(true);
    expect(swedish.blockers.some((b) => b.code === "PROTECTED_PROVIDER_MUTATION")).toBe(true);
    expect(melhus.protectedProvidersUntouched).toBe(true);
    expect(swedish.protectedProvidersUntouched).toBe(true);
  });

  it("near-term week stops", () => {
    const plan = buildProviderOnboardingPlan(
      danishInput({ safeFutureWeek: "2026-07-13" }),
      baseSnapshot(),
    );
    expect(plan.ok).toBe(false);
    expect(plan.blockers.some((b) => b.code === "INVALID_SAFE_WEEK")).toBe(true);
  });
});
