/**
 * Localized fixed menu generator — behind LP_LOCALIZED_FIXED_MENU_GENERATOR (default OFF).
 * Requires LP_MENU_PROFILE_RESOLVER for provider UI wiring.
 */

import {
  isMenuProfileResolverEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";

export const LP_LOCALIZED_FIXED_MENU_GENERATOR_ENV = "LP_LOCALIZED_FIXED_MENU_GENERATOR";

function envFlagTruthy(raw: string | undefined): boolean {
  const normalized = raw?.trim();
  return normalized === "true" || normalized === "1";
}

export function isLocalizedFixedMenuGeneratorEnabled(env: EnvLike = {}): boolean {
  return envFlagTruthy(env[LP_LOCALIZED_FIXED_MENU_GENERATOR_ENV]);
}

/** Provider preview panel — resolver + generator sub-flag. Default OFF. */
export function isLocalizedFixedMenuGeneratorPanelEnabled(env: EnvLike = {}): boolean {
  return isMenuProfileResolverEnabled(env) && isLocalizedFixedMenuGeneratorEnabled(env);
}
