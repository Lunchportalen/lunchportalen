/**
 * INERT MENU PROFILE FEATURE FLAG — ADR-019 G1
 *
 * LP_MENU_PROFILE_RESOLVER defaults OFF. Not wired to runtime routes until explicit cutover.
 */

export const LP_MENU_PROFILE_RESOLVER_ENV = "LP_MENU_PROFILE_RESOLVER";
export const LP_MENU_PROFILE_FIXED_CATEGORIES_ENV = "LP_MENU_PROFILE_FIXED_CATEGORIES";
export const LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV = "LP_MENU_PROFILE_WARM_DISH_PREVIEW";
export const LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV =
  "LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL";
export const LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV = "LP_MENU_PROFILE_MAPPING_DRAFT_API";

export type EnvLike = Readonly<Record<string, string | undefined>>;

function envFlagTruthy(raw: string | undefined): boolean {
  const normalized = raw?.trim();
  return normalized === "true" || normalized === "1";
}

/**
 * True only when env is exactly "true" or "1". Never throws. Pure — caller supplies env bag.
 */
export function isMenuProfileResolverEnabled(env: EnvLike = {}): boolean {
  return envFlagTruthy(env[LP_MENU_PROFILE_RESOLVER_ENV]);
}

/**
 * G5b sub-flag — fixed workspace category presentation panel.
 * True only when env is exactly "true" or "1". Default OFF.
 */
export function isMenuProfileFixedCategoriesEnabled(env: EnvLike = {}): boolean {
  return envFlagTruthy(env[LP_MENU_PROFILE_FIXED_CATEGORIES_ENV]);
}

/** G5b panel requires both resolver (G5a) and fixed-categories sub-flag. */
export function isMenuProfileFixedCategoriesPanelEnabled(env: EnvLike = {}): boolean {
  return isMenuProfileResolverEnabled(env) && isMenuProfileFixedCategoriesEnabled(env);
}

/**
 * G5c sub-flag — warm dish bank preview panel.
 * True only when env is exactly "true" or "1". Default OFF.
 */
export function isMenuProfileWarmDishPreviewEnabled(env: EnvLike = {}): boolean {
  return envFlagTruthy(env[LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV]);
}

/** G5c panel requires both resolver (G5a) and warm-dish-preview sub-flag. */
export function isMenuProfileWarmDishPreviewPanelEnabled(env: EnvLike = {}): boolean {
  return isMenuProfileResolverEnabled(env) && isMenuProfileWarmDishPreviewEnabled(env);
}

/**
 * G5d.2 sub-flag — runtime mapping proposal panel (shadow-only).
 * True only when env is exactly "true" or "1". Default OFF.
 */
export function isMenuProfileRuntimeMappingProposalEnabled(env: EnvLike = {}): boolean {
  return envFlagTruthy(env[LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV]);
}

/** G5d.2 panel requires both resolver (G5a) and runtime-mapping-proposal sub-flag. */
export function isMenuProfileRuntimeMappingProposalPanelEnabled(env: EnvLike = {}): boolean {
  return isMenuProfileResolverEnabled(env) && isMenuProfileRuntimeMappingProposalEnabled(env);
}

/**
 * G5d.3d — mapping draft read/write API (shadow-only persistence).
 * True only when env is exactly "true" or "1". Default OFF. Production OFF.
 */
export function isMenuProfileMappingDraftApiEnabled(env: EnvLike = {}): boolean {
  return envFlagTruthy(env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV]);
}
