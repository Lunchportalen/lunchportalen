/**
 * Phase 3B — Profile warm dish generation orchestration (provider workspace).
 *
 * Behind LP_MENU_PROFILE_RESOLVER when provider has resolved menu_profile_id.
 * Fail-closed to legacy/manual flow when resolver OFF or profile bank empty.
 */

import {
  isMenuProfileWarmDishGenerationEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";
import { getWarmDishBankSeedsForProfile } from "@/lib/menu-profile/warmDishBankSeeds";
import type { MenuProfile, MenuProfileId, MenuProfileResolverResult } from "@/lib/menu-profile/types";
import {
  buildProfileWeekSelectionSeed,
  generateProfileWarmDishWeek,
  type GenerateProfileWarmDishWeekResult,
  type ProfileWarmDishMeal,
} from "@/lib/provider-menu/generateWeekMenu";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import {
  collectBlockedDayIndicesForGeneration,
  dayCanReceiveProfileGeneration,
} from "@/lib/provider-menu/varmrettSharedRead";
import type { ProviderOrderLockState } from "@/lib/provider-menu/providerMenuOrderLock";
import { addDaysISO } from "@/lib/date/oslo";

export type ProfileWarmDishGenerationContext =
  | { active: false; reason: "flag_off" | "resolver_disabled" | "empty_bank" }
  | {
      active: true;
      profileId: MenuProfileId;
      profile: MenuProfile;
      seedCount: number;
    };

export type ProfileWarmDishDaySuggestion = {
  date: string;
  dayIndex: number;
  meal: ProfileWarmDishMeal;
  canApply: boolean;
};

export type ProfileWarmDishWeekSuggestions = {
  weekMondayIso: string;
  profileId: MenuProfileId;
  market: string;
  locale: string;
  source: "profile_bank";
  suggestions: ProfileWarmDishDaySuggestion[];
  skippedDates: string[];
};

export function resolveProfileWarmDishGenerationContext(
  resolverResult: MenuProfileResolverResult | null | undefined,
  env: EnvLike = {},
): ProfileWarmDishGenerationContext {
  if (!isMenuProfileWarmDishGenerationEnabled(env)) {
    return { active: false, reason: "flag_off" };
  }
  if (!resolverResult?.ok || !resolverResult.enabled) {
    return { active: false, reason: "resolver_disabled" };
  }

  const profile = resolverResult.profile;
  const seeds = getWarmDishBankSeedsForProfile(profile.id);
  if (!seeds.length) {
    return { active: false, reason: "empty_bank" };
  }

  return {
    active: true,
    profileId: profile.id,
    profile,
    seedCount: seeds.length,
  };
}

export function buildProfileWarmDishWeekSuggestions(input: {
  providerId: string;
  weekMondayIso: string;
  profileId: MenuProfileId;
  profile: MenuProfile;
  slots: Record<string, ResolvedProviderMenuSlot>;
  lockState: ProviderOrderLockState;
}): ProfileWarmDishWeekSuggestions {
  const seeds = getWarmDishBankSeedsForProfile(input.profileId);
  const dates = [0, 1, 2, 3, 4].map((offset) => addDaysISO(input.weekMondayIso, offset));

  const blocked = collectBlockedDayIndicesForGeneration(input.slots, dates, input.lockState);
  const plan = generateProfileWarmDishWeek({
    seeds,
    weekMondayIso: input.weekMondayIso,
    selectionSeed: buildProfileWeekSelectionSeed(input.providerId, input.weekMondayIso, input.profileId),
    blockedDayIndices: blocked,
  });

  const suggestions: ProfileWarmDishDaySuggestion[] = [];
  const skippedDates: string[] = [];

  plan.dates.forEach((date, dayIndex) => {
    const meal = plan.days[dayIndex];
    const canApply = dayCanReceiveProfileGeneration(input.slots, date, input.lockState);
    if (!canApply || !meal) {
      if (!canApply) skippedDates.push(date);
      return;
    }
    suggestions.push({ date, dayIndex, meal, canApply: true });
  });

  return {
    weekMondayIso: input.weekMondayIso,
    profileId: input.profileId,
    market: input.profile.market,
    locale: input.profile.locale,
    source: "profile_bank",
    suggestions,
    skippedDates,
  };
}

export function suggestionForDate(
  weekPlan: ProfileWarmDishWeekSuggestions,
  date: string,
): ProfileWarmDishDaySuggestion | null {
  return weekPlan.suggestions.find((s) => s.date === date) ?? null;
}

export function buildProfileWarmDishWeekPlanForTests(input: {
  providerId: string;
  weekMondayIso: string;
  profileId: MenuProfileId;
}): GenerateProfileWarmDishWeekResult {
  const seeds = getWarmDishBankSeedsForProfile(input.profileId);
  return generateProfileWarmDishWeek({
    seeds,
    weekMondayIso: input.weekMondayIso,
    selectionSeed: buildProfileWeekSelectionSeed(
      input.providerId,
      input.weekMondayIso,
      input.profileId,
    ),
  });
}
