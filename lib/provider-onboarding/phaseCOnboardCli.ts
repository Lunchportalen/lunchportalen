/**
 * Phase C onboarding factory CLI core — plan-only by default.
 * Live dryRun is read-only. Apply remains gated and refuses without live adapters GO.
 */

import {
  PHASE_C_ONBOARD_CONFIRMATION_PHRASE,
  PHASE_C_SAFE_FUTURE_WEEKS,
  phaseCTargetForLocale,
} from "@/lib/provider-onboarding/phaseCLocales";
import type { LiveReadEnvMeta } from "@/lib/provider-onboarding/createLiveReadAdapters";
import {
  buildFixturePreflightSnapshot,
  buildLiveReadPreflightSnapshot,
  type LiveReadSnapshotAdapters,
  type LiveReadSnapshotResult,
} from "@/lib/provider-onboarding/liveReadSnapshot";
import {
  executeProviderOnboardingApply,
  type ProviderOnboardingExecuteAdapters,
} from "@/lib/provider-onboarding/providerOnboardingExecute";
import {
  buildProviderOnboardingPlan,
  serializeProviderOnboardingPlan,
} from "@/lib/provider-onboarding/providerOnboardingPlan";
import type {
  PhaseCLocaleInventoryRow,
  ProviderOnboardingEnvPresence,
  ProviderOnboardingInput,
  ProviderOnboardingPreflightSnapshot,
} from "@/lib/provider-onboarding/providerOnboardingTypes";

export type SnapshotSource = "live" | "fixture";

export type PhaseCOnboardCliDeps = {
  envPresence: ProviderOnboardingEnvPresence;
  /** Build live adapters only when snapshotSource=live. */
  createLiveAdapters?: () => LiveReadSnapshotAdapters;
  /** Optional override for tests (mock live read). */
  liveRead?: (args: {
    adapters: LiveReadSnapshotAdapters;
    envPresence: ProviderOnboardingEnvPresence;
    candidateAdminEmails: string[];
  }) => Promise<LiveReadSnapshotResult>;
  /** Non-secret live-read env pairing metadata. */
  liveReadEnvMeta?: LiveReadEnvMeta;
  /** When true and liveOnboardFlag, apply may execute live write adapters. */
  liveAdaptersEnabled?: boolean;
  liveOnboardFlag?: boolean;
  /** Build write adapters only under full apply gates. */
  createLiveWriteAdapters?: () => ProviderOnboardingExecuteAdapters;
};

export type PhaseCOnboardCliResult = {
  exitCode: number;
  body: Record<string, unknown>;
  writes: number;
};

function stripQuotes(value: string): string {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1).trim();
  }
  return v;
}

/**
 * Read flag value. Joins subsequent non-flag tokens so
 * `--providerName Danish Lunch Pilot` survives shells that split on spaces.
 */
function argValue(argv: string[], flag: string): string | null {
  const prefix = `${flag}=`;
  const eqIdx = argv.findIndex((a) => a.startsWith(prefix));
  if (eqIdx >= 0) {
    const parts = [argv[eqIdx]!.slice(prefix.length)];
    let i = eqIdx + 1;
    while (i < argv.length && !argv[i]!.startsWith("--")) {
      parts.push(argv[i]!);
      i += 1;
    }
    const joined = stripQuotes(parts.join(" ").trim());
    return joined || null;
  }

  const idx = argv.indexOf(flag);
  if (idx >= 0) {
    const parts: string[] = [];
    let i = idx + 1;
    while (i < argv.length && !argv[i]!.startsWith("--")) {
      parts.push(argv[i]!);
      i += 1;
    }
    const joined = stripQuotes(parts.join(" ").trim());
    return joined || null;
  }

  return null;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function firstArg(argv: string[], flags: string[]): string | null {
  for (const flag of flags) {
    const v = argValue(argv, flag);
    if (v != null && v !== "") return v;
  }
  return null;
}

export function resolveSnapshotSource(argv: string[], mode: "dry_run" | "apply"): SnapshotSource {
  const explicit = firstArg(argv, ["--snapshot-source", "--snapshotSource"]);
  if (explicit === "fixture" || explicit === "live") return explicit;
  // Default: live for dryRun and apply planning — never silently empty.
  if (mode === "dry_run" || mode === "apply") return "live";
  return "live";
}

export function buildCliInput(argv: string[]): ProviderOnboardingInput {
  const dryRun = hasFlag(argv, "--dry-run") || hasFlag(argv, "--dryRun");
  const apply = hasFlag(argv, "--apply");
  if (dryRun === apply) {
    throw new Error("Specify exactly one of --dry-run or --apply");
  }

  const locale = firstArg(argv, ["--locale"]) ?? "";
  const target = phaseCTargetForLocale(locale);
  if (!target) {
    throw new Error(`Unknown or unsupported Phase C locale: ${locale}`);
  }

  return {
    providerName:
      firstArg(argv, ["--providerName", "--name", "--provider-name"]) ??
      target.recommendedProviderName,
    providerSlug:
      firstArg(argv, ["--providerSlug", "--slug", "--provider-slug"]) ??
      target.recommendedProviderSlug,
    locale: target.locale,
    menuProfileId:
      firstArg(argv, ["--menuProfileId", "--menu-profile-id"]) ?? target.menuProfileId,
    country: firstArg(argv, ["--country"]) ?? target.country,
    currency: firstArg(argv, ["--currency"]) ?? target.currency,
    timezone: firstArg(argv, ["--timezone"]) ?? target.timezone,
    adminEmail:
      firstArg(argv, ["--adminEmail", "--admin-email"]) ??
      `${target.recommendedProviderSlug}-admin@lunchportalen.no`,
    safeFutureWeek:
      firstArg(argv, ["--safeFutureWeek", "--week", "--safe-future-week"]) ??
      PHASE_C_SAFE_FUTURE_WEEKS[target.locale] ??
      "2031-11-03",
    mode: apply ? "apply" : "dry_run",
    operatorConfirmationPhrase: firstArg(argv, ["--confirm", "--confirmPhrase"]),
  };
}

function exactNextGoPrompt(input: ProviderOnboardingInput): string {
  return [
    `GO Phase C ${input.locale} provider onboarding apply-only — ${input.providerName}`,
    `(slug=${input.providerSlug}, locale=${input.locale}, menuProfileId=${input.menuProfileId},`,
    `country=${input.country}, currency=${input.currency}, timezone=${input.timezone},`,
    `adminEmail=${input.adminEmail}, confirm=${PHASE_C_ONBOARD_CONFIRMATION_PHRASE}).`,
    "Allowed: provider/org/settings/auth/membership + syncProviderToSanity + read-only verify.",
    "Forbidden: menuDays, publish, generator apply, SOT, mass expansion, Melhus/Swedish mutation.",
  ].join(" ");
}

function classificationForLocale(
  inventory: PhaseCLocaleInventoryRow[] | undefined,
  locale: string,
): string | null {
  return inventory?.find((row) => row.locale === locale)?.classification ?? null;
}

async function resolveSnapshot(args: {
  source: SnapshotSource;
  input: ProviderOnboardingInput;
  deps: PhaseCOnboardCliDeps;
}): Promise<{
  snapshot: ProviderOnboardingPreflightSnapshot;
  snapshotSource: SnapshotSource;
  inventory: PhaseCLocaleInventoryRow[];
  globalTemplatesOk: boolean | null;
  missingGlobalTemplates: string[];
}> {
  const { source, input, deps } = args;

  if (source === "fixture") {
    const snapshot = buildFixturePreflightSnapshot(deps.envPresence);
    return {
      snapshot,
      snapshotSource: "fixture",
      inventory: [],
      globalTemplatesOk: snapshot.globalTemplateKeys.length > 0,
      missingGlobalTemplates: [],
    };
  }

  if (!deps.createLiveAdapters && !deps.liveRead) {
    throw new Error(
      "Live snapshot source requires live adapters (operator env). Do not use empty snapshot for production-like dryRun. Use --snapshot-source fixture only in tests.",
    );
  }

  const adapters = deps.createLiveAdapters
    ? deps.createLiveAdapters()
    : ({
        listProviders: async () => [],
        listProviderSettingsLocales: async () => [],
        findExistingAdminEmails: async () => [],
        listGlobalTemplateKeys: async () => [],
      } satisfies LiveReadSnapshotAdapters);

  const liveRead = deps.liveRead ?? buildLiveReadPreflightSnapshot;
  const live = await liveRead({
    adapters,
    envPresence: deps.envPresence,
    candidateAdminEmails: [input.adminEmail],
  });

  if (live.ok === false) {
    const err = live.error;
    throw new Error(`${err.code}: ${err.message}`);
  }

  return {
    snapshot: live.snapshot,
    snapshotSource: "live",
    inventory: live.inventory,
    globalTemplatesOk: live.globalTemplatesOk,
    missingGlobalTemplates: live.missingGlobalTemplates,
  };
}

/**
 * Run Phase C onboarding CLI logic. Never prints secrets.
 * write adapters are never invoked by this function.
 */
export async function runPhaseCOnboardCli(
  argv: string[],
  deps: PhaseCOnboardCliDeps,
): Promise<PhaseCOnboardCliResult> {
  const input = buildCliInput(argv);
  const snapshotSource = resolveSnapshotSource(argv, input.mode);

  const resolved = await resolveSnapshot({ source: snapshotSource, input, deps });
  const plan = buildProviderOnboardingPlan(input, resolved.snapshot);
  const serialized = serializeProviderOnboardingPlan(plan);

  const localeClassification = classificationForLocale(resolved.inventory, input.locale);
  const writePlanPresent = plan.writePlan.length > 0;
  const rollbackPlanPresent = plan.rollbackPlan.length > 0;

  const common = {
    ...serialized,
    snapshotSource: resolved.snapshotSource,
    writes: 0 as const,
    liveWrites: false,
    passwordPrinted: false,
    secretsRedacted: true,
    globalTemplates:
      resolved.globalTemplatesOk == null
        ? null
        : resolved.globalTemplatesOk
          ? "PASS"
          : "FAIL",
    missingGlobalTemplates: resolved.missingGlobalTemplates,
    slugConflict: plan.blockers.some((b) => b.code === "SLUG_CONFLICT")
      ? "conflict"
      : "none",
    emailConflict: plan.blockers.some((b) => b.code === "ADMIN_EMAIL_CONFLICT")
      ? "conflict"
      : "none",
    writePlanPresent,
    rollbackPlanPresent,
    localeClassificationBeforeOnboarding: localeClassification,
    inventory: resolved.inventory.map((row) => ({
      locale: row.locale,
      classification: row.classification,
      providerExists: row.providerExists,
      providerId: row.providerId,
      providerSlug: row.providerSlug,
      globalSanityTemplatesOk: row.globalSanityTemplatesOk,
    })),
    envPresence: resolved.snapshot.envPresence,
    liveReadEnv: deps.liveReadEnvMeta ?? null,
    exactNextGoPrompt: exactNextGoPrompt(input),
    note:
      resolved.snapshotSource === "live"
        ? "Live-read dryRun only. No provider/org/settings/auth/mirror writes performed."
        : "Fixture snapshot (tests only). Not authoritative for production operator readiness.",
  };

  if (input.mode === "dry_run") {
    return {
      exitCode: plan.ok ? 0 : 1,
      writes: 0,
      body: {
        status: plan.ok ? "DRY_RUN_OK" : "DRY_RUN_BLOCKED",
        ...common,
      },
    };
  }

  // Apply path — still no writes unless confirmation + live flag + live adapters.
  if (input.operatorConfirmationPhrase !== PHASE_C_ONBOARD_CONFIRMATION_PHRASE) {
    return {
      exitCode: 1,
      writes: 0,
      body: {
        status: "APPLY_BLOCKED",
        message: `Missing confirmation phrase ${PHASE_C_ONBOARD_CONFIRMATION_PHRASE}`,
        ...common,
      },
    };
  }

  if (!deps.liveOnboardFlag) {
    return {
      exitCode: 2,
      writes: 0,
      body: {
        status: "APPLY_GATED",
        message:
          "Live onboarding apply is gated. Set PHASE_C_ALLOW_LIVE_ONBOARD=1 only under scoped GO. Plan validated only.",
        confirmationAccepted: true,
        ...common,
      },
    };
  }

  if (!deps.liveAdaptersEnabled || !deps.createLiveWriteAdapters) {
    return {
      exitCode: 3,
      writes: 0,
      body: {
        status: "APPLY_REFUSED_NO_LIVE_ADAPTER",
        message:
          "PHASE_C_ALLOW_LIVE_ONBOARD=1 set, but live apply adapters are not enabled. Scoped GO must wire approved adapters.",
        confirmationAccepted: true,
        ...common,
      },
    };
  }

  if (!plan.ok) {
    return {
      exitCode: 1,
      writes: 0,
      body: {
        status: "APPLY_BLOCKED",
        message: "Onboarding apply blocked by preflight.",
        confirmationAccepted: true,
        ...common,
      },
    };
  }

  const writeAdapters = deps.createLiveWriteAdapters();
  const executed = await executeProviderOnboardingApply({
    input,
    snapshot: resolved.snapshot,
    adapters: writeAdapters,
  });

  return {
    exitCode: executed.ok ? 0 : 1,
    writes: executed.writesPerformed ? 1 : 0,
    body: {
      status: executed.ok ? "APPLY_OK" : "APPLY_FAILED",
      confirmationAccepted: true,
      providerId: executed.providerId,
      stepsCompleted: executed.stepsCompleted,
      writesPerformed: executed.writesPerformed,
      menuDaysCreated: executed.menuDaysCreated,
      published: executed.published,
      sotStarted: executed.sotStarted,
      massExpansionStarted: executed.massExpansionStarted,
      passwordPrinted: executed.passwordPrinted,
      message: executed.message,
      credentialsLocalFileHint:
        ".operator-local/<admin-local-part>-admin.credentials (never commit; never print)",
      ...common,
      writes: executed.writesPerformed ? executed.stepsCompleted.length : 0,
      liveWrites: executed.writesPerformed,
    },
  };
}
