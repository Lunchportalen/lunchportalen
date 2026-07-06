/**
 * Phase C provider onboarding execute — adapter-driven.
 * Never creates menuDays, never publishes, never starts SOT/auto-rollout.
 * Never mutates protected Melhus / Swedish Lunch Pilot providers.
 */

import {
  PHASE_C_PROTECTED_PROVIDER_IDS,
  PHASE_C_PROTECTED_PROVIDER_SLUGS,
} from "@/lib/provider-onboarding/phaseCLocales";
import { buildProviderOnboardingPlan } from "@/lib/provider-onboarding/providerOnboardingPlan";
import type {
  ProviderOnboardingInput,
  ProviderOnboardingPlanResult,
  ProviderOnboardingPreflightSnapshot,
} from "@/lib/provider-onboarding/providerOnboardingTypes";

export type ProviderOnboardingExecuteAdapters = {
  createProvider: (input: {
    name: string;
    slug: string;
    adminEmail: string;
  }) => Promise<{ providerId: string }>;
  ensureOrganizationMirror: (input: {
    providerId: string;
    name: string;
    slug: string;
  }) => Promise<void>;
  upsertProviderSettings: (input: {
    providerId: string;
    locale: string;
    menuProfileId: string;
    country: string;
    currency: string;
    timezone: string;
    adminEmail: string;
  }) => Promise<void>;
  provisionProviderAdmin: (input: {
    providerId: string;
    adminEmail: string;
  }) => Promise<{ userId: string; passwordIssued: boolean }>;
  ensureProviderMembership: (input: {
    providerId: string;
    userId: string;
  }) => Promise<void>;
  syncProviderToSanity: (providerId: string) => Promise<void>;
  verifySanityMirror: (input: {
    providerId: string;
    expectedSlug: string;
  }) => Promise<{ ok: boolean; message?: string }>;
};

export type ProviderOnboardingExecuteResult = {
  ok: boolean;
  plan: ProviderOnboardingPlanResult;
  providerId: string | null;
  stepsCompleted: string[];
  writesPerformed: boolean;
  menuDaysCreated: false;
  published: false;
  sotStarted: false;
  autoRolloutStarted: false;
  passwordPrinted: false;
  message: string;
};

function assertNotProtected(providerId: string, slug: string): void {
  const id = String(providerId ?? "").trim();
  const s = String(slug ?? "").trim().toLowerCase();
  if ((PHASE_C_PROTECTED_PROVIDER_IDS as readonly string[]).includes(id)) {
    throw new Error("PROTECTED_PROVIDER_MUTATION: refusing to mutate protected provider id.");
  }
  if ((PHASE_C_PROTECTED_PROVIDER_SLUGS as readonly string[]).includes(s)) {
    throw new Error("PROTECTED_PROVIDER_MUTATION: refusing to mutate protected provider slug.");
  }
}

/**
 * Execute onboarding apply through adapters after plan validation.
 * Callers must only invoke this under explicit operator GO.
 */
export async function executeProviderOnboardingApply(args: {
  input: ProviderOnboardingInput;
  snapshot: ProviderOnboardingPreflightSnapshot;
  adapters: ProviderOnboardingExecuteAdapters;
}): Promise<ProviderOnboardingExecuteResult> {
  const plan = buildProviderOnboardingPlan(
    { ...args.input, mode: "apply" },
    args.snapshot,
  );

  if (!plan.ok) {
    return {
      ok: false,
      plan,
      providerId: null,
      stepsCompleted: [],
      writesPerformed: false,
      menuDaysCreated: false,
      published: false,
      sotStarted: false,
      autoRolloutStarted: false,
      passwordPrinted: false,
      message: "Onboarding apply blocked by preflight.",
    };
  }

  const stepsCompleted: string[] = [];
  const { adapters } = args;
  const summary = plan.inputSummary;

  assertNotProtected("", summary.providerSlug);

  const created = await adapters.createProvider({
    name: summary.providerName,
    slug: summary.providerSlug,
    adminEmail: summary.adminEmail,
  });
  const providerId = String(created.providerId ?? "").trim();
  if (!providerId) {
    throw new Error("createProvider returned empty providerId");
  }
  assertNotProtected(providerId, summary.providerSlug);
  stepsCompleted.push("lp_provider_create");

  await adapters.ensureOrganizationMirror({
    providerId,
    name: summary.providerName,
    slug: summary.providerSlug,
  });
  stepsCompleted.push("organizations_mirror");

  await adapters.upsertProviderSettings({
    providerId,
    locale: summary.locale,
    menuProfileId: summary.menuProfileId,
    country: summary.country,
    currency: summary.currency,
    timezone: summary.timezone,
    adminEmail: summary.adminEmail,
  });
  stepsCompleted.push("provider_settings");

  const admin = await adapters.provisionProviderAdmin({
    providerId,
    adminEmail: summary.adminEmail,
  });
  stepsCompleted.push("provider_admin_auth");

  await adapters.ensureProviderMembership({
    providerId,
    userId: admin.userId,
  });
  stepsCompleted.push("provider_membership");

  await adapters.syncProviderToSanity(providerId);
  stepsCompleted.push("syncProviderToSanity");

  const mirror = await adapters.verifySanityMirror({
    providerId,
    expectedSlug: summary.providerSlug,
  });
  if (!mirror.ok) {
    return {
      ok: false,
      plan,
      providerId,
      stepsCompleted,
      writesPerformed: true,
      menuDaysCreated: false,
      published: false,
      sotStarted: false,
      autoRolloutStarted: false,
      passwordPrinted: false,
      message: mirror.message ?? "Sanity provider mirror verification failed.",
    };
  }
  stepsCompleted.push("verify_sanity_mirror");

  return {
    ok: true,
    plan,
    providerId,
    stepsCompleted,
    writesPerformed: true,
    menuDaysCreated: false,
    published: false,
    sotStarted: false,
    autoRolloutStarted: false,
    passwordPrinted: false,
    message:
      "Provider onboarded. Menu apply is NOT run. Store credentials in operator-local env. Run generator dryRun and confirm safeToApply=true before any scoped apply GO.",
  };
}
