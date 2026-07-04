/**
 * Phase 3B — Warm dish generation presentation for /leverandor/meny.
 * Active when LP_MENU_PROFILE_RESOLVER ON and profile resolved with bank seeds.
 */

import {
  isMenuProfileWarmDishGenerationEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";
import type { MenuProfileResolverResult } from "@/lib/menu-profile/types";
import { resolveProfileWarmDishGenerationContext } from "@/lib/provider-menu/profileWarmDishGeneration";

export type ProviderMenuWarmDishGenerationPresentation =
  | { active: false }
  | {
      active: true;
      profileId: string;
      profileName: string;
      market: string;
      locale: string;
      seedCount: number;
      source: "profile_bank";
    };

export function buildProviderMenuWarmDishGenerationPresentation(
  resolverResult: MenuProfileResolverResult | null | undefined,
  env: EnvLike = {},
): ProviderMenuWarmDishGenerationPresentation {
  const ctx = resolveProfileWarmDishGenerationContext(resolverResult, env);
  if (!ctx.active) return { active: false };

  return {
    active: true,
    profileId: ctx.profileId,
    profileName: ctx.profile.name,
    market: ctx.profile.market,
    locale: ctx.profile.locale,
    seedCount: ctx.seedCount,
    source: "profile_bank",
  };
}

export function isWarmDishGenerationPresentationActive(
  presentation: ProviderMenuWarmDishGenerationPresentation,
): presentation is Extract<ProviderMenuWarmDishGenerationPresentation, { active: true }> {
  return presentation.active === true;
}
