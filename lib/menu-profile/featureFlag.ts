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
export const LP_MENU_PROFILE_PUBLISH_SHADOW_ENV = "LP_MENU_PROFILE_PUBLISH_SHADOW";
export const LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV = "LP_MENU_PROFILE_WEEK_SHADOW_READ";
export const LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV = "LP_MENU_PROFILE_COMPATIBILITY_CUTOVER";
export const LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV =
  "LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK";

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
 * Phase 3B — profile warm dish generation in provider workspace.
 * Requires resolver ON and resolved menu_profile_id (checked at call site). Default OFF.
 */
export function isMenuProfileWarmDishGenerationEnabled(env: EnvLike = {}): boolean {
  return isMenuProfileResolverEnabled(env);
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

/**
 * G5d.3e — mapping draft save UI in provider workspace.
 * Requires resolver + runtime mapping proposal + mapping draft API flags. Default OFF.
 */
export function isMenuProfileMappingDraftSaveUiEnabled(env: EnvLike = {}): boolean {
  return (
    isMenuProfileRuntimeMappingProposalPanelEnabled(env) &&
    isMenuProfileMappingDraftApiEnabled(env)
  );
}

/**
 * G5d.4 — publish shadow evaluation (design-only flag, inert until G5d.4c+).
 * True only when env is exactly "true". Default OFF. Production OFF.
 * Not wired to runtime routes in G5d.4b.
 */
export function isMenuProfilePublishShadowEnabled(env: EnvLike = {}): boolean {
  return env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV]?.trim() === "true";
}

/**
 * G5d.5 — /week shadow read evaluation (design-only flag, inert until G5d.5c+).
 * True only when env is exactly "true". Default OFF. Production OFF.
 * Not wired to runtime routes in G5d.5b.
 */
export function isMenuProfileWeekShadowReadEnabled(env: EnvLike = {}): boolean {
  return env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV]?.trim() === "true";
}

/**
 * G5d.6 — compatibility cutover evaluation (design-only flag, inert until G5d.6c+).
 * True only when env is exactly "true". Default OFF. Production OFF.
 * Not wired to runtime routes in G5d.6b.
 */
export function isMenuProfileCompatibilityCutoverEnabled(env: EnvLike = {}): boolean {
  return env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] === "true";
}

/**
 * G5d.7c — Preview-only /week runtime compatibility hook (compare-only, fail-closed to current).
 * True only when env is exactly "true". Default OFF. Production OFF.
 * Not included in client-visible host env bags.
 */
export function isMenuProfileRuntimeCompatibilityHookEnabled(env: EnvLike = {}): boolean {
  return env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV]?.trim() === "true";
}
