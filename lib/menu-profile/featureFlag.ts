/**
 * INERT MENU PROFILE FEATURE FLAG — ADR-019 G1
 *
 * LP_MENU_PROFILE_RESOLVER defaults OFF. Not wired to runtime routes until explicit cutover.
 */

export const LP_MENU_PROFILE_RESOLVER_ENV = "LP_MENU_PROFILE_RESOLVER";

type EnvLike = Readonly<Record<string, string | undefined>>;

/**
 * True only when env is exactly "true" or "1". Never throws. Pure — caller supplies env bag.
 */
export function isMenuProfileResolverEnabled(env: EnvLike = {}): boolean {
  const raw = env[LP_MENU_PROFILE_RESOLVER_ENV];
  return raw === "true" || raw === "1";
}
