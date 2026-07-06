/**
 * Phase C provider onboarding factory — contracts (pure, no I/O).
 */

export type ProviderOnboardingMode = "dry_run" | "apply";

export type ProviderOnboardingBlockerCode =
  | "LOCALE_PROFILE_MISMATCH"
  | "LOCALE_COUNTRY_MISMATCH"
  | "LOCALE_CURRENCY_MISMATCH"
  | "LOCALE_TIMEZONE_MISMATCH"
  | "SLUG_CONFLICT"
  | "NAME_CONFLICT"
  | "ADMIN_EMAIL_CONFLICT"
  | "MISSING_GLOBAL_TEMPLATE"
  | "MISSING_CONFIRMATION"
  | "PROTECTED_PROVIDER_MUTATION"
  | "INVALID_SAFE_WEEK"
  | "MISSING_ENV"
  | "MISSING_REQUIRED_FIELD";

export type PhaseCLocaleClassification =
  | "READY_FOR_DRYRUN"
  | "READY_FOR_SCOPED_APPLY"
  | "BLOCKED_PROVIDER"
  | "BLOCKED_ORG_MIRROR"
  | "BLOCKED_SETTINGS"
  | "BLOCKED_AUTH"
  | "BLOCKED_CREDS"
  | "BLOCKED_SANITY_MIRROR"
  | "BLOCKED_GLOBAL_TEMPLATE"
  | "BLOCKED_SCHEMA"
  | "BLOCKED_UNKNOWN";

export type ProviderOnboardingInput = {
  providerName: string;
  providerSlug: string;
  locale: string;
  menuProfileId: string;
  country: string;
  currency: string;
  timezone: string;
  adminEmail: string;
  safeFutureWeek: string;
  mode: ProviderOnboardingMode;
  /** Required for apply mode. Phrase: ONBOARD_PROVIDER_APPLY */
  operatorConfirmationPhrase?: string | null;
};

export type ProviderOnboardingEnvPresence = {
  hasSupabaseServiceRole: boolean;
  hasSanityReadToken: boolean;
  hasSanityWriteToken: boolean;
  hasSuperadminCreds: boolean;
};

export type ProviderOnboardingPreflightSnapshot = {
  existingProviders: Array<{ id: string; slug: string; name: string }>;
  existingAdminEmails: string[];
  providersByLocale: Array<{ providerId: string; locale: string }>;
  globalTemplateKeys: string[];
  envPresence: ProviderOnboardingEnvPresence;
};

export type ProviderOnboardingBlocker = {
  code: ProviderOnboardingBlockerCode;
  message: string;
};

export type ProviderOnboardingWriteStep = {
  step: number;
  action: string;
  target: string;
  notes: string;
};

export type ProviderOnboardingRollbackStep = {
  step: number;
  action: string;
  target: string;
};

export type ProviderOnboardingCredentialsHandling = {
  emailEnvHint: string;
  passwordEnvHint: string;
  passwordPrinted: false;
  instructions: string;
};

export type ProviderOnboardingPlanResult = {
  ok: boolean;
  mode: ProviderOnboardingMode;
  blockers: ProviderOnboardingBlocker[];
  writePlan: ProviderOnboardingWriteStep[];
  rollbackPlan: ProviderOnboardingRollbackStep[];
  credentialsHandling: ProviderOnboardingCredentialsHandling;
  secretsRedacted: true;
  safeToOnboardApply: boolean;
  willCreateMenuDays: false;
  willPublish: false;
  willStartSot: false;
  willStartMassExpansion: false;
  protectedProvidersUntouched: true;
  inputSummary: {
    providerName: string;
    providerSlug: string;
    locale: string;
    menuProfileId: string;
    country: string;
    currency: string;
    timezone: string;
    adminEmail: string;
    safeFutureWeek: string;
  };
};

export type PhaseCLocaleInventoryRow = {
  locale: string;
  menuProfileId: string;
  country: string;
  currency: string;
  timezone: string;
  providerExists: boolean;
  providerId: string | null;
  providerSlug: string | null;
  organizationMirrorExists: boolean;
  providerSettingsComplete: boolean;
  providerAdminAuthExists: boolean;
  providerMembershipExists: boolean;
  automationCredsAvailable: boolean;
  sanityProviderMirrorExists: boolean;
  providerRefResolves: boolean;
  globalSanityTemplatesOk: boolean;
  providerScopedCatalogDocs: number;
  existingFutureMenuDays: number;
  latestApplyOrDryRunEvidence: string | null;
  canDryRunToday: boolean;
  canApplyAfterGo: boolean;
  classification: PhaseCLocaleClassification;
  blockers: string[];
};
