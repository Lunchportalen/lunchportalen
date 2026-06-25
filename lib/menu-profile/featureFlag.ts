/**
 * INERT MENU PROFILE FEATURE FLAG — ADR-019 G1
 *
 * LP_MENU_PROFILE_RESOLVER defaults OFF. Not wired to runtime routes until explicit cutover.
 */

export const LP_MENU_PROFILE_RESOLVER_ENV = "LP_MENU_PROFILE_RESOLVER";
export const LP_MENU_PROFILE_FIXED_CATEGORIES_ENV = "LP_MENU_PROFILE_FIXED_CATEGORIES";

export type EnvLike = Readonly<Record<string, string | undefined>>;

/**
 * True only when env is exactly "true" or "1". Never throws. Pure — caller supplies env bag.
 */
export function isMenuProfileResolverEnabled(env: EnvLike = {}): boolean {
  const raw = env[LP_MENU_PROFILE_RESOLVER_ENV];
  return raw === "true" || raw === "1";
}

/**
 * G5b sub-flag — fixed workspace category presentation panel.
 * True only when env is exactly "true" or "1". Default OFF.
 */
export function isMenuProfileFixedCategoriesEnabled(env: EnvLike = {}): boolean {
  const raw = env[LP_MENU_PROFILE_FIXED_CATEGORIES_ENV];
  return raw === "true" || raw === "1";
}

/** G5b panel requires both resolver (G5a) and fixed-categories sub-flag. */
export function isMenuProfileFixedCategoriesPanelEnabled(env: EnvLike = {}): boolean {
  return isMenuProfileResolverEnabled(env) && isMenuProfileFixedCategoriesEnabled(env);
}
