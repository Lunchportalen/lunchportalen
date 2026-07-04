/**
 * Phase 3B + 4 — Warm dish generation presentation for /leverandor/meny.
 * Active when LP_MENU_PROFILE_RESOLVER ON and profile resolved with bank seeds.
 */

import {
  isMenuProfileWarmDishGenerationEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";
import { buildProfileWarmDishGenerationSuggestions } from "@/lib/menu-profile/profileMenuRuntime";
import type { MenuProfileResolverResult, MenuProfileResolveSource } from "@/lib/menu-profile/types";
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
      activeProfileTitle: string;
      activeProfileSubtitle: string;
      resolveSource: MenuProfileResolveSource;
      fallbackActive: boolean;
      fallbackWarning: string | null;
      bankSuggestions: Array<{ id: string; title: string }>;
      generationEnabled: boolean;
    };

export function buildProviderMenuWarmDishGenerationPresentation(
  resolverResult: MenuProfileResolverResult | null | undefined,
  env: EnvLike = {},
): ProviderMenuWarmDishGenerationPresentation {
  const ctx = resolveProfileWarmDishGenerationContext(resolverResult, env);
  if (!ctx.active) return { active: false };

  const fallbackActive =
    resolverResult?.ok === true &&
    resolverResult.enabled &&
    (resolverResult.source === "market_default" ||
      resolverResult.source === "fallback_no_market" ||
      Boolean(resolverResult.warning));

  const bankSuggestions = buildProfileWarmDishGenerationSuggestions(ctx.profile)
    .slice(0, 5)
    .map((item) => ({ id: item.id, title: item.title }));

  const fallbackWarning = fallbackActive
    ? resolverResult?.ok && resolverResult.enabled
      ? (resolverResult.warning ??
        "Profil løses via markedsfallback — verifiser locale og innstillinger.")
      : null
    : ctx.seedCount === 0
      ? "Profilbank mangler varmrettforslag — manuell utfylling kreves."
      : null;

  return {
    active: true,
    profileId: ctx.profileId,
    profileName: ctx.profile.name,
    market: ctx.profile.market,
    locale: ctx.profile.locale,
    seedCount: ctx.seedCount,
    source: "profile_bank",
    activeProfileTitle: ctx.profile.name,
    activeProfileSubtitle: `${ctx.profileId} · ${ctx.profile.market} · ${ctx.profile.locale}`,
    resolveSource:
      resolverResult?.ok && resolverResult.enabled ? resolverResult.source : "provider_setting",
    fallbackActive,
    fallbackWarning,
    bankSuggestions,
    generationEnabled: isMenuProfileWarmDishGenerationEnabled(env),
  };
}

export function isWarmDishGenerationPresentationActive(
  presentation: ProviderMenuWarmDishGenerationPresentation,
): presentation is Extract<ProviderMenuWarmDishGenerationPresentation, { active: true }> {
  return presentation.active === true;
}
