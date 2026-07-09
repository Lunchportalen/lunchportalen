/**
 * Localized generator SOT feature flags — Gate F0 (default OFF, fail-closed).
 *
 * Does not wire runtime routes. Master OFF ⇒ SOT inert for all providers.
 * Empty allowlist ⇒ SOT inert even when master ON.
 */

import type { EnvLike } from "@/lib/menu-profile/featureFlag";

export const LP_LOCALIZED_GENERATOR_SOT_ENABLED_ENV = "LP_LOCALIZED_GENERATOR_SOT_ENABLED";
export const LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST_ENV =
  "LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST";
export const LP_LOCALIZED_GENERATOR_SOT_DRY_RUN_ENV = "LP_LOCALIZED_GENERATOR_SOT_DRY_RUN";
/** Reserved — separate deferred auto-rollout track; not part of SOT cutover. */
export const LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED_ENV =
  "LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED";

const PROVIDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function envFlagTruthy(raw: string | undefined): boolean {
  const normalized = raw?.trim();
  return normalized === "true" || normalized === "1";
}

/** Master SOT switch. Default OFF. Malformed ⇒ OFF. */
export function isLocalizedGeneratorSotEnabled(env: EnvLike = {}): boolean {
  return envFlagTruthy(env[LP_LOCALIZED_GENERATOR_SOT_ENABLED_ENV]);
}

/** Dry-run observe-only. Default OFF. Requires master ON at resolver layer. */
export function isLocalizedGeneratorSotDryRunEnabled(env: EnvLike = {}): boolean {
  return envFlagTruthy(env[LP_LOCALIZED_GENERATOR_SOT_DRY_RUN_ENV]);
}

/**
 * Reserved auto-rollout flag — always treated as OFF for SOT coupling.
 * Explicit true is ignored by SOT resolver; separate product GO required.
 */
export function isLocalizedGeneratorAutoRolloutEnabled(env: EnvLike = {}): boolean {
  return envFlagTruthy(env[LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED_ENV]);
}

/** Parse comma-separated provider UUID allowlist. Invalid tokens ignored. Empty ⇒ inert. */
export function parseLocalizedGeneratorSotProviderAllowlist(env: EnvLike = {}): string[] {
  const raw = env[LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST_ENV];
  if (typeof raw !== "string" || !raw.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim().toLowerCase();
    if (!id || !PROVIDER_ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function isProviderInLocalizedGeneratorSotAllowlist(
  providerId: string,
  env: EnvLike = {},
): boolean {
  const normalized = providerId.trim().toLowerCase();
  if (!normalized || !PROVIDER_ID_RE.test(normalized)) return false;
  const allowlist = parseLocalizedGeneratorSotProviderAllowlist(env);
  if (allowlist.length === 0) return false;
  return allowlist.includes(normalized);
}

/** Master ON and provider allowlisted. Does not imply serve — resolver remains fail-closed in F0. */
export function isLocalizedGeneratorSotEligibleForProvider(
  providerId: string,
  env: EnvLike = {},
): boolean {
  return isLocalizedGeneratorSotEnabled(env) && isProviderInLocalizedGeneratorSotAllowlist(providerId, env);
}
