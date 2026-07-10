/**
 * Localized generator SOT — MSDI localized mapping policy (default OFF, fail-closed).
 * Pure policy only; does not import materialization or order write-path.
 */

import type { EnvLike } from "@/lib/menu-profile/featureFlag";
import {
  isLocalizedGeneratorSotDryRunEnabled,
  isLocalizedGeneratorSotEligibleForProvider,
  isLocalizedGeneratorSotMsdiLocalizedMappingEnabled,
} from "@/lib/menu-generator/sotFeatureFlag";

export type MsdiLocalizedMappingPolicy = {
  /** Master SOT + allowlist + MSDI mapping flag ON (does not imply serve). */
  msdiMappingFlagOn: boolean;
  /** Dry-run observe-only — materialization must stay legacy. */
  dryRun: boolean;
  /** MSDI sync may use localized mapping (not dry-run, all flags ON). */
  msdiMappingActiveForSync: boolean;
  /** Resolver/reporting: mapping module ready for eligible provider. */
  msdiMappingReady: boolean;
};

export function resolveMsdiLocalizedMappingPolicy(
  providerId: string,
  env: EnvLike = {},
): MsdiLocalizedMappingPolicy {
  const dryRun = isLocalizedGeneratorSotDryRunEnabled(env);
  const sotEligible = isLocalizedGeneratorSotEligibleForProvider(providerId, env);
  const msdiMappingFlagOn = sotEligible && isLocalizedGeneratorSotMsdiLocalizedMappingEnabled(env);
  const msdiMappingReady = msdiMappingFlagOn;
  const msdiMappingActiveForSync = msdiMappingFlagOn && !dryRun;

  return {
    msdiMappingFlagOn,
    dryRun,
    msdiMappingActiveForSync,
    msdiMappingReady,
  };
}
