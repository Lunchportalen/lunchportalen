/**
 * G5b — Explicit NO profile category → existing runtime key mapping (read-only).
 *
 * Maps MenuProfile profileCategoryKey to today's Category / lunch / order choice keys only.
 * Does not extend Category union or modify menuDayContract.
 */

import type { Category } from "@/lib/cms/menuDayContract";

export type NoCategoryRuntimeMapping = {
  runtimeCategoryKey: Category;
  runtimeLunchCategoryKey: string;
  runtimeOrderChoiceKey: string;
};

const NO_PROFILE_CATEGORY_RUNTIME_MAP: Readonly<Record<string, NoCategoryRuntimeMapping>> = {
  paasmurt: {
    runtimeCategoryKey: "paasmurt",
    runtimeLunchCategoryKey: "paasmurt",
    runtimeOrderChoiceKey: "paasmurt",
  },
  salatboks: {
    runtimeCategoryKey: "salat",
    runtimeLunchCategoryKey: "salatboks",
    runtimeOrderChoiceKey: "salatboks",
  },
  sushi: {
    runtimeCategoryKey: "sushi",
    runtimeLunchCategoryKey: "sushi",
    runtimeOrderChoiceKey: "sushi",
  },
  pokebowl: {
    runtimeCategoryKey: "pokebowl",
    runtimeLunchCategoryKey: "pokebowl",
    runtimeOrderChoiceKey: "pokebowl",
  },
  thaimat: {
    runtimeCategoryKey: "thai",
    runtimeLunchCategoryKey: "thaimat",
    runtimeOrderChoiceKey: "thaimat",
  },
  varmrett: {
    runtimeCategoryKey: "varmrett",
    runtimeLunchCategoryKey: "varmrett",
    runtimeOrderChoiceKey: "varmmat",
  },
};

/** Returns runtime mapping for a NO profile category key, or null when unmapped. */
export function resolveNoCategoryRuntimeMapping(
  profileCategoryKey: string,
): NoCategoryRuntimeMapping | null {
  return NO_PROFILE_CATEGORY_RUNTIME_MAP[profileCategoryKey] ?? null;
}
