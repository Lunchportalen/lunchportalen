/**
 * Phase 3B — Profile-scoped warm dish week generation (provider workspace only).
 *
 * Deterministic selection from in-code warm dish bank seeds. Does not import menu-profile
 * into lib/menu-publish/ and does not touch order write-path or cron rollout.
 */

import { addDaysISO } from "@/lib/date/oslo";
import {
  getWeekdayCategoryPin,
  mulberry32,
} from "@/lib/menu-publish/generateWeekMenu";
import type { WarmDishBankSeed } from "@/lib/menu-profile/types";

function hashStringToUint32(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type ProfileWarmDishMealSource = "profile_bank";

export type ProfileWarmDishMeal = {
  seedKey: string;
  title: string;
  description: string;
  allergens: readonly string[];
  tags: readonly string[];
  source: ProfileWarmDishMealSource;
};

export type GenerateProfileWarmDishWeekResult = {
  weekMondayIso: string;
  dates: string[];
  /** Index 0 = Monday … 4 = Friday; null = skipped/blocked day. */
  days: (ProfileWarmDishMeal | null)[];
};

export function buildProfileWeekSelectionSeed(
  providerId: string,
  weekMondayIso: string,
  profileId: string,
): string {
  return `${String(providerId ?? "").trim()}\0${String(weekMondayIso ?? "").trim()}\0${String(profileId ?? "").trim()}`;
}

function seedMatchesPin(seed: WarmDishBankSeed, pin: string): boolean {
  const tags = seed.tags ?? [];
  if (pin === "fisk") {
    return seed.protein === "fish" || tags.some((t) => t.toLowerCase() === "fish" || t === "fisk");
  }
  if (pin === "suppe") {
    return seed.dishType === "soup" || tags.some((t) => t.toLowerCase() === "soup" || t === "suppe");
  }
  if (pin === "fredagskos") {
    return tags.some((t) => t.toLowerCase() === "fredagskos");
  }
  return tags.some((t) => t.toLowerCase() === pin.toLowerCase());
}

function scoreSeedForDay(seed: WarmDishBankSeed, dayIndex: number, selectionSeed: string): number {
  let score = 0;
  const pin = getWeekdayCategoryPin(dayIndex);
  if (pin && seedMatchesPin(seed, pin)) score += 100;
  const prng = mulberry32(hashStringToUint32(`${selectionSeed}:${dayIndex}:${seed.key}`));
  score += prng() * 10;
  return score;
}

function seedToMeal(seed: WarmDishBankSeed): ProfileWarmDishMeal {
  return {
    seedKey: seed.key,
    title: seed.title,
    description: String(seed.description ?? seed.title).trim(),
    allergens: seed.allergens ?? [],
    tags: seed.tags ?? [],
    source: "profile_bank",
  };
}

/**
 * Deterministic Mon–Fri warm dish plan from profile bank seeds.
 * Skips blocked day indices; never mutates existing provider-authored slots.
 */
export function generateProfileWarmDishWeek(input: {
  seeds: readonly WarmDishBankSeed[];
  weekMondayIso: string;
  selectionSeed: string;
  blockedDayIndices?: ReadonlySet<number>;
}): GenerateProfileWarmDishWeekResult {
  const dates = [0, 1, 2, 3, 4].map((offset) => addDaysISO(input.weekMondayIso, offset));
  const usedKeys = new Set<string>();
  const days: (ProfileWarmDishMeal | null)[] = [];

  for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
    if (input.blockedDayIndices?.has(dayIndex)) {
      days.push(null);
      continue;
    }

    if (!input.seeds.length) {
      days.push(null);
      continue;
    }

    const ranked = [...input.seeds]
      .filter((seed) => !usedKeys.has(seed.key))
      .sort(
        (a, b) =>
          scoreSeedForDay(b, dayIndex, input.selectionSeed) -
          scoreSeedForDay(a, dayIndex, input.selectionSeed),
      );

    let pick = ranked[0];
    if (!pick) {
      pick = [...input.seeds].sort(
        (a, b) =>
          scoreSeedForDay(b, dayIndex, input.selectionSeed) -
          scoreSeedForDay(a, dayIndex, input.selectionSeed),
      )[0];
    }

    if (!pick) {
      days.push(null);
      continue;
    }

    usedKeys.add(pick.key);
    days.push(seedToMeal(pick));
  }

  return {
    weekMondayIso: input.weekMondayIso,
    dates,
    days,
  };
}
