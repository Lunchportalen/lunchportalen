/**
 * Phase C provider onboarding planner — pure, deterministic, no side effects.
 * Dry-run and apply share the same validation; apply only adds confirmation gate.
 */

import {
  PHASE_C_ONBOARD_CONFIRMATION_PHRASE,
  PHASE_C_PROTECTED_PROVIDER_IDS,
  PHASE_C_PROTECTED_PROVIDER_SLUGS,
  PHASE_C_REQUIRED_GLOBAL_TEMPLATES,
  phaseCTargetForLocale,
} from "@/lib/provider-onboarding/phaseCLocales";
import type {
  ProviderOnboardingBlocker,
  ProviderOnboardingInput,
  ProviderOnboardingPlanResult,
  ProviderOnboardingPreflightSnapshot,
  ProviderOnboardingRollbackStep,
  ProviderOnboardingWriteStep,
} from "@/lib/provider-onboarding/providerOnboardingTypes";

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSlug(value: unknown): string {
  return normalize(value).toLowerCase();
}

function normalizeEmail(value: unknown): string {
  return normalize(value).toLowerCase();
}

function isMondayIsoDate(weekStart: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return false;
  const d = new Date(`${weekStart}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 1;
}

function isFarFutureWeek(weekStart: string): boolean {
  if (!isMondayIsoDate(weekStart)) return false;
  // Phase C policy: far-future only (never near-term). Require year >= 2031.
  return Number(weekStart.slice(0, 4)) >= 2031;
}

function emailEnvHint(locale: string): string {
  const token = locale.replace("-", "_").toUpperCase();
  return `${token}_PROVIDER_ADMIN_EMAIL`;
}

function passwordEnvHint(locale: string): string {
  const token = locale.replace("-", "_").toUpperCase();
  return `${token}_PROVIDER_ADMIN_PASSWORD`;
}

function isProtectedProviderTarget(input: ProviderOnboardingInput): boolean {
  const slug = normalizeSlug(input.providerSlug);
  if ((PHASE_C_PROTECTED_PROVIDER_SLUGS as readonly string[]).includes(slug)) {
    return true;
  }
  // Never allow an input that would mutate known protected IDs by name/slug collision only —
  // ID write targets are generated at apply time; plan blocks protected slugs/names.
  const name = normalize(input.providerName).toLowerCase();
  return (
    name === "melhus catering as" ||
    name === "swedish lunch pilot" ||
    (PHASE_C_PROTECTED_PROVIDER_IDS as readonly string[]).some((id) =>
      normalize(input.providerSlug).includes(id),
    )
  );
}

export function validateLocaleMapping(input: ProviderOnboardingInput): ProviderOnboardingBlocker[] {
  const blockers: ProviderOnboardingBlocker[] = [];
  const target = phaseCTargetForLocale(input.locale);

  if (!target) {
    blockers.push({
      code: "LOCALE_PROFILE_MISMATCH",
      message: `Locale ${normalize(input.locale)} is not a Phase C launch locale.`,
    });
    return blockers;
  }

  if (normalize(input.menuProfileId) !== target.menuProfileId) {
    blockers.push({
      code: "LOCALE_PROFILE_MISMATCH",
      message: `menuProfileId must be ${target.menuProfileId} for ${target.locale}.`,
    });
  }
  if (normalize(input.country) !== target.country) {
    blockers.push({
      code: "LOCALE_COUNTRY_MISMATCH",
      message: `country must be ${target.country} for ${target.locale}.`,
    });
  }
  if (normalize(input.currency) !== target.currency) {
    blockers.push({
      code: "LOCALE_CURRENCY_MISMATCH",
      message: `currency must be ${target.currency} for ${target.locale}.`,
    });
  }
  if (normalize(input.timezone) !== target.timezone) {
    blockers.push({
      code: "LOCALE_TIMEZONE_MISMATCH",
      message: `timezone must be ${target.timezone} for ${target.locale}.`,
    });
  }

  return blockers;
}

export function validateRequiredFields(input: ProviderOnboardingInput): ProviderOnboardingBlocker[] {
  const blockers: ProviderOnboardingBlocker[] = [];
  const required: Array<keyof ProviderOnboardingInput> = [
    "providerName",
    "providerSlug",
    "locale",
    "menuProfileId",
    "country",
    "currency",
    "timezone",
    "adminEmail",
    "safeFutureWeek",
  ];
  for (const key of required) {
    if (!normalize(input[key])) {
      blockers.push({
        code: "MISSING_REQUIRED_FIELD",
        message: `Missing required field: ${key}.`,
      });
    }
  }
  return blockers;
}

function buildWritePlan(input: ProviderOnboardingInput): ProviderOnboardingWriteStep[] {
  return [
    {
      step: 1,
      action: "lp_provider_create",
      target: "providers",
      notes: `Create provider slug=${normalizeSlug(input.providerSlug)} via approved RPC path (superadmin session).`,
    },
    {
      step: 2,
      action: "organizations_insert",
      target: "organizations",
      notes: "Create organizations mirror row with id=providerId, type=provider.",
    },
    {
      step: 3,
      action: "provider_settings_upsert",
      target: "provider_settings",
      notes: `Upsert locale=${input.locale}, menu_profile_id=${input.menuProfileId}, country=${input.country}, currency=${input.currency}, timezone=${input.timezone}.`,
    },
    {
      step: 4,
      action: "provider_admin_auth_provision",
      target: "auth.users + profiles",
      notes: "Create or validate provider_admin auth user. Password never printed.",
    },
    {
      step: 5,
      action: "provider_membership_upsert",
      target: "provider_memberships",
      notes: "Upsert provider_admin membership for the new provider only.",
    },
    {
      step: 6,
      action: "syncProviderToSanity",
      target: "sanity.provider",
      notes: "Mandatory mirror upsert; verify read-only id/slug match after sync.",
    },
    {
      step: 7,
      action: "post_onboard_verify_read_only",
      target: "provider + settings + membership + sanity mirror",
      notes: "Read-only verification only. Does NOT apply menuDays, publish, or start SOT.",
    },
  ];
}

function buildRollbackPlan(): ProviderOnboardingRollbackStep[] {
  return [
    { step: 1, action: "deactivate_membership", target: "provider_memberships" },
    { step: 2, action: "deactivate_provider_admin", target: "auth.users / profiles" },
    { step: 3, action: "mark_provider_inactive", target: "providers.status" },
    { step: 4, action: "retain_org_mirror_history", target: "organizations" },
    { step: 5, action: "retain_sanity_mirror_or_mark_inactive", target: "sanity.provider" },
  ];
}

export function buildProviderOnboardingPlan(
  input: ProviderOnboardingInput,
  snapshot: ProviderOnboardingPreflightSnapshot,
): ProviderOnboardingPlanResult {
  const blockers: ProviderOnboardingBlocker[] = [];

  blockers.push(...validateRequiredFields(input));
  blockers.push(...validateLocaleMapping(input));

  if (!isFarFutureWeek(normalize(input.safeFutureWeek))) {
    blockers.push({
      code: "INVALID_SAFE_WEEK",
      message: "safeFutureWeek must be a Monday ISO date in year >= 2031 (far-future only).",
    });
  }

  if (isProtectedProviderTarget(input)) {
    blockers.push({
      code: "PROTECTED_PROVIDER_MUTATION",
      message:
        "Target matches a protected Phase B provider (Melhus or Swedish Lunch Pilot). Onboarding factory must never mutate those providers.",
    });
  }

  const slug = normalizeSlug(input.providerSlug);
  const name = normalize(input.providerName).toLowerCase();
  const email = normalizeEmail(input.adminEmail);

  const slugHit = snapshot.existingProviders.find((p) => normalizeSlug(p.slug) === slug);
  if (slugHit) {
    blockers.push({
      code: "SLUG_CONFLICT",
      message: `Provider slug already exists (id=${slugHit.id}).`,
    });
  }

  const nameHit = snapshot.existingProviders.find(
    (p) => normalize(p.name).toLowerCase() === name,
  );
  if (nameHit) {
    blockers.push({
      code: "NAME_CONFLICT",
      message: `Provider name already exists (id=${nameHit.id}).`,
    });
  }

  if (snapshot.existingAdminEmails.map(normalizeEmail).includes(email)) {
    blockers.push({
      code: "ADMIN_EMAIL_CONFLICT",
      message: "Admin email is already registered. Use a unique provider_admin email.",
    });
  }

  const missingTemplates = PHASE_C_REQUIRED_GLOBAL_TEMPLATES.filter(
    (key) => !snapshot.globalTemplateKeys.includes(key),
  );
  if (missingTemplates.length > 0) {
    blockers.push({
      code: "MISSING_GLOBAL_TEMPLATE",
      message: `Missing global Sanity templates: ${missingTemplates.join(", ")}.`,
    });
  }

  const env = snapshot.envPresence;
  if (
    !env.hasSupabaseServiceRole ||
    !env.hasSanityReadToken ||
    !env.hasSanityWriteToken ||
    !env.hasSuperadminCreds
  ) {
    blockers.push({
      code: "MISSING_ENV",
      message:
        "Required operator env is incomplete (service role, Sanity read/write, superadmin). Values are not printed.",
    });
  }

  if (input.mode === "apply") {
    if (normalize(input.operatorConfirmationPhrase) !== PHASE_C_ONBOARD_CONFIRMATION_PHRASE) {
      blockers.push({
        code: "MISSING_CONFIRMATION",
        message: `Apply requires operatorConfirmationPhrase=${PHASE_C_ONBOARD_CONFIRMATION_PHRASE}.`,
      });
    }
  }

  const writePlan = buildWritePlan(input);
  const rollbackPlan = buildRollbackPlan();
  const ok = blockers.length === 0;

  return {
    ok,
    mode: input.mode,
    blockers,
    writePlan: input.mode === "dry_run" || ok ? writePlan : [],
    rollbackPlan,
    credentialsHandling: {
      emailEnvHint: emailEnvHint(input.locale),
      passwordEnvHint: passwordEnvHint(input.locale),
      passwordPrinted: false,
      instructions:
        "Store provider admin password in operator-local env only. Never commit, log, or print passwords. Rotate if exposure is suspected.",
    },
    secretsRedacted: true,
    safeToOnboardApply: ok && input.mode === "apply",
    willCreateMenuDays: false,
    willPublish: false,
    willStartSot: false,
    willStartAutoRollout: false,
    protectedProvidersUntouched: true,
    inputSummary: {
      providerName: normalize(input.providerName),
      providerSlug: slug,
      locale: normalize(input.locale),
      menuProfileId: normalize(input.menuProfileId),
      country: normalize(input.country),
      currency: normalize(input.currency),
      timezone: normalize(input.timezone),
      adminEmail: email,
      safeFutureWeek: normalize(input.safeFutureWeek),
    },
  };
}

/**
 * Machine-readable JSON body safe for stdout (no secrets).
 */
export function serializeProviderOnboardingPlan(
  plan: ProviderOnboardingPlanResult,
): Record<string, unknown> {
  return {
    ok: plan.ok,
    mode: plan.mode,
    blockers: plan.blockers,
    writePlan: plan.writePlan,
    rollbackPlan: plan.rollbackPlan,
    credentialsHandling: plan.credentialsHandling,
    secretsRedacted: plan.secretsRedacted,
    safeToOnboardApply: plan.safeToOnboardApply,
    willCreateMenuDays: plan.willCreateMenuDays,
    willPublish: plan.willPublish,
    willStartSot: plan.willStartSot,
    willStartAutoRollout: plan.willStartAutoRollout,
    protectedProvidersUntouched: plan.protectedProvidersUntouched,
    inputSummary: plan.inputSummary,
    confirmationPhraseRequired: PHASE_C_ONBOARD_CONFIRMATION_PHRASE,
    postOnboardGates: [
      "syncProviderToSanity completed and verified read-only",
      "generator dryRun HTTP 200",
      "providerMirrorPreflight.ok=true",
      "safeToApply=true",
      "applyBlocked=false",
      "evidence archive PR",
      "separate scoped GO before menu apply",
    ],
    sot: "NO-GO",
    autoRollout: "NO-GO",
  };
}
