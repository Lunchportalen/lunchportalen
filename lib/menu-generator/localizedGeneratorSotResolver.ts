/**
 * Gate F1 — Pure localized generator SOT resolver (not wired to /week or orders).
 *
 * Computes eligibility, dry-run intent, and MSDI localized mapping readiness.
 * Always fail-closed to legacy runtime output until a separate scoped cutover GO
 * wires authoritative serving.
 */

import type { EnvLike } from "@/lib/menu-profile/featureFlag";
import {
  isLocalizedGeneratorAutoRolloutEnabled,
  isLocalizedGeneratorSotDryRunEnabled,
  isLocalizedGeneratorSotEnabled,
  isProviderInLocalizedGeneratorSotAllowlist,
} from "@/lib/menu-generator/sotFeatureFlag";
import {
  buildMsdiLocalizedMappingDryRunPreview,
  LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE,
} from "@/lib/menu-generator/sotMsdiItemMapping";
import { resolveMsdiLocalizedMappingPolicy } from "@/lib/menu-generator/sotMsdiMappingPolicy";

export const LOCALIZED_GENERATOR_SOT_PHASE = "F1" as const;

/** Legacy v1: global tier-product catalog snapshots (flags OFF). */
export const LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE = "tier_products_global_catalog" as const;

export type LocalizedGeneratorSotMsdiSnapshotMode =
  | typeof LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE
  | typeof LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE;

export type LocalizedGeneratorSotSelectedSource = "legacy";

export type LocalizedGeneratorSotDecisionReason =
  | "f0_hook_not_wired"
  | "sot_master_flag_off"
  | "provider_not_in_allowlist"
  | "empty_allowlist"
  | "dry_run_observe_only"
  | "invalid_provider_id"
  | "kill_switch_off"
  | "auto_rollout_forbidden"
  | "would_select_generated_when_wired"
  | "msdi_v1_tier_products_global_boundary"
  | "msdi_localized_mapping_flag_off"
  | "msdi_localized_mapping_ready_not_wired";

export type LocalizedGeneratorSotDryRunMsdiPreview = {
  snapshotMode: typeof LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE;
  providerId: string;
  countryCode: string;
  currency: string;
  tier: "BASIS" | "LUXUS" | "ENTERPRISE";
  sampleVarmrett:
    | {
        productNameSnapshot: string;
        offeredPriceCentsExVat: number;
        vatRateSnapshot: number;
        currency: string;
      }
    | { blocker: string };
};

export type LocalizedGeneratorSotDecision = {
  phase: typeof LOCALIZED_GENERATOR_SOT_PHASE;
  selectedSource: LocalizedGeneratorSotSelectedSource;
  canServeGeneratedAsAuthoritative: false;
  sourceOfTruthChanged: false;
  autoRollout: false;
  hasMutationIntent: false;
  sotMasterEnabled: boolean;
  providerAllowlisted: boolean;
  dryRun: boolean;
  /** Master ON + valid provider in allowlist. */
  sotEligible: boolean;
  /** True when eligible and not dry-run — reports future authoritative path only. */
  wouldSelectGenerated: boolean;
  msdiSnapshotMode: LocalizedGeneratorSotMsdiSnapshotMode;
  /** False when MSDI localized mapping flag ON for eligible provider. */
  msdiLocalizedMappingBlocked: boolean;
  /** True when MSDI mapping module is ready (flag ON + eligible). */
  wouldUseMsdiLocalizedMapping: boolean;
  /** Populated in dry-run when MSDI mapping ready — observe-only, no mutation. */
  dryRunMsdiMappingPreview: LocalizedGeneratorSotDryRunMsdiPreview | null;
  reasons: LocalizedGeneratorSotDecisionReason[];
  messages: string[];
};

export type LocalizedGeneratorSotResolverInput = {
  providerId: string;
  env?: EnvLike;
  /** Optional generated menuDay projection for dry-run MSDI preview. */
  varmrettProjection?: {
    mealTitle?: string | null;
    meal?: {
      title?: string | null;
      description?: string | null;
      allergens?: string[] | null;
    } | null;
  } | null;
  /** Provider market for dry-run preview (no DB fetch in resolver). */
  dryRunMarket?: { countryCode: string; currency: string };
};

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidProviderId(providerId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    providerId,
  );
}

const BASE_MESSAGES = [
  "Gate F1 SOT hook — not wired to employee runtime authoritative serve path",
  "Fail-closed to legacy authoritative source",
  "No source-of-truth switch",
  "No auto-rollout",
] as const;

export function resolveLocalizedGeneratorSotDecision(
  input: LocalizedGeneratorSotResolverInput,
): LocalizedGeneratorSotDecision {
  const env = input.env ?? {};
  const providerId = safeTrim(input.providerId);
  const reasons: LocalizedGeneratorSotDecisionReason[] = [];
  const messages: string[] = [...BASE_MESSAGES];

  if (isLocalizedGeneratorAutoRolloutEnabled(env)) {
    reasons.push("auto_rollout_forbidden");
    messages.push("Auto-rollout flag must remain OFF — SOT resolver ignores it");
  }

  const sotMasterEnabled = isLocalizedGeneratorSotEnabled(env);
  if (!sotMasterEnabled) {
    reasons.push("kill_switch_off", "sot_master_flag_off");
    messages.push("SOT master flag OFF — legacy runtime unchanged");
    return buildDecision({
      sotMasterEnabled: false,
      providerAllowlisted: false,
      dryRun: isLocalizedGeneratorSotDryRunEnabled(env),
      sotEligible: false,
      wouldSelectGenerated: false,
      msdiPolicy: resolveMsdiLocalizedMappingPolicy(providerId, env),
      dryRunMarket: input.dryRunMarket,
      varmrettProjection: input.varmrettProjection,
      providerId,
      reasons,
      messages,
    });
  }

  if (!providerId || !isValidProviderId(providerId)) {
    reasons.push("invalid_provider_id");
    messages.push("Invalid or missing providerId — SOT path inert");
    return buildDecision({
      sotMasterEnabled: true,
      providerAllowlisted: false,
      dryRun: isLocalizedGeneratorSotDryRunEnabled(env),
      sotEligible: false,
      wouldSelectGenerated: false,
      msdiPolicy: resolveMsdiLocalizedMappingPolicy(providerId, env),
      dryRunMarket: input.dryRunMarket,
      varmrettProjection: input.varmrettProjection,
      providerId,
      reasons,
      messages,
    });
  }

  const providerAllowlisted = isProviderInLocalizedGeneratorSotAllowlist(providerId, env);
  if (!providerAllowlisted) {
    reasons.push("provider_not_in_allowlist");
    messages.push("Provider not in SOT allowlist — legacy runtime for this provider");
    return buildDecision({
      sotMasterEnabled: true,
      providerAllowlisted: false,
      dryRun: isLocalizedGeneratorSotDryRunEnabled(env),
      sotEligible: false,
      wouldSelectGenerated: false,
      msdiPolicy: resolveMsdiLocalizedMappingPolicy(providerId, env),
      dryRunMarket: input.dryRunMarket,
      varmrettProjection: input.varmrettProjection,
      providerId,
      reasons,
      messages,
    });
  }

  const dryRun = isLocalizedGeneratorSotDryRunEnabled(env);
  const sotEligible = true;
  const msdiPolicy = resolveMsdiLocalizedMappingPolicy(providerId, env);

  if (msdiPolicy.msdiMappingReady) {
    reasons.push("msdi_localized_mapping_ready_not_wired");
    messages.push(
      `MSDI localized mapping ready — snapshot mode ${LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE}`,
    );
  } else {
    reasons.push("msdi_localized_mapping_flag_off", "msdi_v1_tier_products_global_boundary");
    messages.push(
      `MSDI v1 boundary: ${LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE} (localized mapping flag OFF)`,
    );
  }

  if (dryRun) {
    reasons.push("dry_run_observe_only", "would_select_generated_when_wired");
    messages.push("Dry-run ON — would select generated localized content when wired; no serve, no mutation");
    return buildDecision({
      sotMasterEnabled: true,
      providerAllowlisted: true,
      dryRun: true,
      sotEligible,
      wouldSelectGenerated: true,
      msdiPolicy,
      dryRunMarket: input.dryRunMarket,
      varmrettProjection: input.varmrettProjection,
      providerId,
      reasons,
      messages,
    });
  }

  reasons.push("f0_hook_not_wired", "would_select_generated_when_wired");
  messages.push(
    "SOT eligible but hook not wired — legacy serve path unchanged",
    "Future cutover GO required before generated content becomes authoritative",
  );

  return buildDecision({
    sotMasterEnabled: true,
    providerAllowlisted: true,
    dryRun: false,
    sotEligible,
    wouldSelectGenerated: true,
    msdiPolicy,
    dryRunMarket: input.dryRunMarket,
    varmrettProjection: input.varmrettProjection,
    providerId,
    reasons,
    messages,
  });
}

function buildDecision(input: {
  sotMasterEnabled: boolean;
  providerAllowlisted: boolean;
  dryRun: boolean;
  sotEligible: boolean;
  wouldSelectGenerated: boolean;
  msdiPolicy: ReturnType<typeof resolveMsdiLocalizedMappingPolicy>;
  dryRunMarket?: { countryCode: string; currency: string };
  varmrettProjection?: LocalizedGeneratorSotResolverInput["varmrettProjection"];
  providerId: string;
  reasons: LocalizedGeneratorSotDecisionReason[];
  messages: string[];
}): LocalizedGeneratorSotDecision {
  const msdiLocalizedMappingBlocked = !input.msdiPolicy.msdiMappingReady;
  const wouldUseMsdiLocalizedMapping = input.msdiPolicy.msdiMappingReady;
  const msdiSnapshotMode = wouldUseMsdiLocalizedMapping
    ? LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE
    : LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE;

  let dryRunMsdiMappingPreview: LocalizedGeneratorSotDryRunMsdiPreview | null = null;
  if (input.dryRun && wouldUseMsdiLocalizedMapping && input.dryRunMarket) {
    const preview = buildMsdiLocalizedMappingDryRunPreview({
      providerId: input.providerId,
      countryCode: input.dryRunMarket.countryCode,
      currency: input.dryRunMarket.currency,
      tier: "BASIS",
      varmrettProjection: input.varmrettProjection ?? null,
    });
    dryRunMsdiMappingPreview = {
      snapshotMode: preview.snapshotMode,
      providerId: preview.providerId,
      countryCode: preview.countryCode,
      currency: preview.currency,
      tier: preview.tier,
      sampleVarmrett: preview.sampleVarmrett,
    };
  }

  return {
    phase: LOCALIZED_GENERATOR_SOT_PHASE,
    selectedSource: "legacy",
    canServeGeneratedAsAuthoritative: false,
    sourceOfTruthChanged: false,
    autoRollout: false,
    hasMutationIntent: false,
    sotMasterEnabled: input.sotMasterEnabled,
    providerAllowlisted: input.providerAllowlisted,
    dryRun: input.dryRun,
    sotEligible: input.sotEligible,
    wouldSelectGenerated: input.wouldSelectGenerated,
    msdiSnapshotMode,
    msdiLocalizedMappingBlocked,
    wouldUseMsdiLocalizedMapping,
    dryRunMsdiMappingPreview,
    reasons: input.reasons,
    messages: input.messages,
  };
}

export function toLocalizedGeneratorSotOpsLogPayload(decision: LocalizedGeneratorSotDecision) {
  return {
    phase: decision.phase,
    selectedSource: decision.selectedSource,
    sotMasterEnabled: decision.sotMasterEnabled,
    providerAllowlisted: decision.providerAllowlisted,
    dryRun: decision.dryRun,
    sotEligible: decision.sotEligible,
    wouldSelectGenerated: decision.wouldSelectGenerated,
    sourceOfTruthChanged: decision.sourceOfTruthChanged,
    autoRollout: decision.autoRollout,
    hasMutationIntent: decision.hasMutationIntent,
    msdiSnapshotMode: decision.msdiSnapshotMode,
    msdiLocalizedMappingBlocked: decision.msdiLocalizedMappingBlocked,
    wouldUseMsdiLocalizedMapping: decision.wouldUseMsdiLocalizedMapping,
    hasDryRunMsdiPreview: decision.dryRunMsdiMappingPreview !== null,
    reasonCount: decision.reasons.length,
  };
}
