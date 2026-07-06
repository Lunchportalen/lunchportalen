/**
 * Phase C onboarding — read-only live preflight snapshot builder.
 * Never writes. Secrets never returned (env presence / boolean ok only).
 */

import {
  PHASE_C_LAUNCH_LOCALES,
  PHASE_C_PROTECTED_PROVIDER_IDS,
  PHASE_C_REQUIRED_GLOBAL_TEMPLATES,
} from "@/lib/provider-onboarding/phaseCLocales";
import {
  buildPhaseCLocaleInventoryRow,
  type PhaseCLocaleInventoryInput,
} from "@/lib/provider-onboarding/phaseCInventoryClassify";
import type {
  PhaseCLocaleInventoryRow,
  ProviderOnboardingEnvPresence,
  ProviderOnboardingPreflightSnapshot,
} from "@/lib/provider-onboarding/providerOnboardingTypes";

export type LiveReadSnapshotAdapters = {
  listProviders: () => Promise<Array<{ id: string; slug: string; name: string }>>;
  listProviderSettingsLocales: () => Promise<
    Array<{ providerId: string; locale: string }>
  >;
  /** Return emails that already exist from the candidate list (normalized lowercase). */
  findExistingAdminEmails: (candidateEmails: string[]) => Promise<string[]>;
  listGlobalTemplateKeys: () => Promise<string[]>;
  /** Optional inventory enrichment (read-only). */
  loadLocaleInventoryRows?: (
    globalTemplatesOk: boolean,
  ) => Promise<PhaseCLocaleInventoryInput[]>;
};

export type LiveReadSnapshotOk = {
  ok: true;
  snapshotSource: "live";
  writes: 0;
  readOnly: true;
  snapshot: ProviderOnboardingPreflightSnapshot;
  inventory: PhaseCLocaleInventoryRow[];
  globalTemplatesOk: boolean;
  missingGlobalTemplates: string[];
  protectedProviderIds: readonly string[];
};

export type LiveReadSnapshotErr = {
  ok: false;
  snapshotSource: "live";
  writes: 0;
  readOnly: true;
  error: {
    code:
      | "LIVE_READ_FAILED"
      | "LIVE_READ_MISSING_ADAPTER"
      | "LIVE_READ_MISSING_ENV";
    message: string;
  };
};

export type LiveReadSnapshotResult = LiveReadSnapshotOk | LiveReadSnapshotErr;

export function buildFixturePreflightSnapshot(
  envPresence: ProviderOnboardingEnvPresence,
  overrides: Partial<ProviderOnboardingPreflightSnapshot> = {},
): ProviderOnboardingPreflightSnapshot {
  return {
    existingProviders: [
      {
        id: PHASE_C_PROTECTED_PROVIDER_IDS[0],
        slug: "melhus-catering",
        name: "Melhus Catering AS",
      },
      {
        id: PHASE_C_PROTECTED_PROVIDER_IDS[1],
        slug: "swedish-lunch-pilot",
        name: "Swedish Lunch Pilot",
      },
    ],
    existingAdminEmails: [
      "melhus-admin@example.com",
      "swedish-lunch-pilot-admin@lunchportalen.no",
    ],
    providersByLocale: [
      { providerId: PHASE_C_PROTECTED_PROVIDER_IDS[0], locale: "nb-NO" },
      { providerId: PHASE_C_PROTECTED_PROVIDER_IDS[1], locale: "sv-SE" },
    ],
    globalTemplateKeys: [...PHASE_C_REQUIRED_GLOBAL_TEMPLATES],
    envPresence,
    ...overrides,
  };
}

export async function buildLiveReadPreflightSnapshot(args: {
  adapters: LiveReadSnapshotAdapters;
  envPresence: ProviderOnboardingEnvPresence;
  candidateAdminEmails: string[];
}): Promise<LiveReadSnapshotResult> {
  const { adapters, envPresence, candidateAdminEmails } = args;

  if (!adapters) {
    return {
      ok: false,
      snapshotSource: "live",
      writes: 0,
      readOnly: true,
      error: {
        code: "LIVE_READ_MISSING_ADAPTER",
        message: "Live-read adapters are required for --snapshot-source live.",
      },
    };
  }

  if (
    !envPresence.hasSupabaseServiceRole ||
    !envPresence.hasSanityReadToken
  ) {
    return {
      ok: false,
      snapshotSource: "live",
      writes: 0,
      readOnly: true,
      error: {
        code: "LIVE_READ_MISSING_ENV",
        message:
          "Live-read dryRun requires Supabase service-role and Sanity read token env presence (values never printed).",
      },
    };
  }

  try {
    const [existingProviders, providersByLocale, existingAdminEmails, globalTemplateKeys] =
      await Promise.all([
        adapters.listProviders(),
        adapters.listProviderSettingsLocales(),
        adapters.findExistingAdminEmails(candidateAdminEmails),
        adapters.listGlobalTemplateKeys(),
      ]);

    const missingGlobalTemplates = PHASE_C_REQUIRED_GLOBAL_TEMPLATES.filter(
      (key) => !globalTemplateKeys.includes(key),
    );
    const globalTemplatesOk = missingGlobalTemplates.length === 0;

    let inventoryInputs: PhaseCLocaleInventoryInput[] = [];
    if (adapters.loadLocaleInventoryRows) {
      inventoryInputs = await adapters.loadLocaleInventoryRows(globalTemplatesOk);
    } else {
      inventoryInputs = PHASE_C_LAUNCH_LOCALES.map((t) => ({
        locale: t.locale,
        menuProfileId: t.menuProfileId,
        country: t.country,
        currency: t.currency,
        timezone: t.timezone,
        providerExists: providersByLocale.some((p) => p.locale === t.locale),
        providerId:
          providersByLocale.find((p) => p.locale === t.locale)?.providerId ??
          t.knownProviderId,
        providerSlug:
          existingProviders.find(
            (p) =>
              p.id ===
              (providersByLocale.find((row) => row.locale === t.locale)?.providerId ??
                t.knownProviderId),
          )?.slug ?? null,
        organizationMirrorExists: false,
        providerSettingsComplete: false,
        providerAdminAuthExists: false,
        providerMembershipExists: false,
        automationCredsAvailable: false,
        sanityProviderMirrorExists: false,
        providerRefResolves: false,
        globalSanityTemplatesOk: globalTemplatesOk,
        providerScopedCatalogDocs: 0,
        existingFutureMenuDays: 0,
        latestApplyOrDryRunEvidence: null,
      }));
    }

    const inventory = inventoryInputs.map((row) => buildPhaseCLocaleInventoryRow(row));

    return {
      ok: true,
      snapshotSource: "live",
      writes: 0,
      readOnly: true,
      snapshot: {
        existingProviders,
        existingAdminEmails: existingAdminEmails.map((e) => e.toLowerCase()),
        providersByLocale,
        globalTemplateKeys,
        envPresence,
      },
      inventory,
      globalTemplatesOk,
      missingGlobalTemplates: [...missingGlobalTemplates],
      protectedProviderIds: PHASE_C_PROTECTED_PROVIDER_IDS,
    };
  } catch (error) {
    return {
      ok: false,
      snapshotSource: "live",
      writes: 0,
      readOnly: true,
      error: {
        code: "LIVE_READ_FAILED",
        message: String((error as { message?: string })?.message ?? error),
      },
    };
  }
}
