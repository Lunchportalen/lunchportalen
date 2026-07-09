/**
 * Gate F0 — Pure localized generator SOT resolver (not wired to /week, webhook, or orders).
 *
 * Computes eligibility and dry-run intent only. Always fail-closed to legacy runtime output
 * until a separate scoped cutover GO wires authoritative serving.
 *
 * MSDI v1 boundary (Option A): item snapshots remain global tier-product catalog via existing sync.
 * Localized msdi mapping requires a separate PR before cutover — see msdiLocalizedMappingBlocked.
 */

import type { EnvLike } from "@/lib/menu-profile/featureFlag";
import {
  isLocalizedGeneratorAutoRolloutEnabled,
  isLocalizedGeneratorSotDryRunEnabled,
  isLocalizedGeneratorSotEnabled,
  isProviderInLocalizedGeneratorSotAllowlist,
} from "@/lib/menu-generator/sotFeatureFlag";

export const LOCALIZED_GENERATOR_SOT_PHASE = "F0" as const;

/** SOT v1: menu_service_day_items continue global tier-product snapshots (visibility proof #471). */
export const LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE = "tier_products_global_catalog" as const;

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
  | "msdi_v1_tier_products_global_boundary";

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
  msdiSnapshotMode: typeof LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE;
  /** Localized msdi item mapping is blocked until separate implementation PR (Option B). */
  msdiLocalizedMappingBlocked: true;
  reasons: LocalizedGeneratorSotDecisionReason[];
  messages: string[];
};

export type LocalizedGeneratorSotResolverInput = {
  providerId: string;
  env?: EnvLike;
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
  "Gate F0 SOT hook — not wired to employee runtime or materialization serve path",
  "Fail-closed to legacy authoritative source",
  "No source-of-truth switch",
  "No auto-rollout",
  `MSDI v1 boundary: ${LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE} (localized item mapping deferred)`,
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
      reasons,
      messages,
    });
  }

  const dryRun = isLocalizedGeneratorSotDryRunEnabled(env);
  const sotEligible = true;

  if (dryRun) {
    reasons.push("dry_run_observe_only", "would_select_generated_when_wired");
    messages.push("Dry-run ON — would select generated localized content when wired; no serve, no mutation");
    return buildDecision({
      sotMasterEnabled: true,
      providerAllowlisted: true,
      dryRun: true,
      sotEligible,
      wouldSelectGenerated: true,
      reasons,
      messages,
    });
  }

  reasons.push("f0_hook_not_wired", "would_select_generated_when_wired", "msdi_v1_tier_products_global_boundary");
  messages.push(
    "SOT eligible but F0 hook not wired — legacy serve path unchanged",
    "Future cutover GO required before generated content becomes authoritative",
  );

  return buildDecision({
    sotMasterEnabled: true,
    providerAllowlisted: true,
    dryRun: false,
    sotEligible,
    wouldSelectGenerated: true,
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
  reasons: LocalizedGeneratorSotDecisionReason[];
  messages: string[];
}): LocalizedGeneratorSotDecision {
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
    msdiSnapshotMode: LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE,
    msdiLocalizedMappingBlocked: true,
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
    reasonCount: decision.reasons.length,
  };
}
