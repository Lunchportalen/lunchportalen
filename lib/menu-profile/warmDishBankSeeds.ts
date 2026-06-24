/**
 * INERT WARM DISH BANK SEEDS — ADR-019 G0.2
 *
 * Canonical seed data per menu profile/market. Not published menuDay documents.
 * Sanity materialization (mealIdea / profile-scoped bank) is a later G-phase — do not
 * import from app/, publish, auto-rollout, or Golden Path until explicit cutover.
 */

import type { MarketCode, MenuProfileId, WarmDishBankSeed, WarmDishDefinition } from "@/lib/menu-profile/types";

function seed(
  profileId: MenuProfileId,
  market: MarketCode,
  locale: string,
  key: string,
  title: string,
  opts?: Omit<WarmDishBankSeed, "key" | "profileId" | "market" | "locale" | "title">,
): WarmDishBankSeed {
  return {
    key,
    profileId,
    market,
    locale,
    title,
    suitableForAutoPublish: true,
    ...opts,
  };
}

export const WARM_DISH_BANK_SEEDS: readonly WarmDishBankSeed[] = [
  // NO — norwegian_company_lunch
  seed("norwegian_company_lunch", "NO", "nb-NO", "kjottkaker-med-potetmos", "Kjøttkaker med potetmos", {
    tags: ["beef", "classic"],
    dishType: "stew",
    protein: "beef",
  }),
  seed("norwegian_company_lunch", "NO", "nb-NO", "kyllinggryte-med-ris", "Kyllinggryte med ris", {
    tags: ["chicken"],
    dishType: "stew",
    protein: "chicken",
  }),
  seed("norwegian_company_lunch", "NO", "nb-NO", "fiskekaker-med-rakost", "Fiskekaker med råkost", {
    tags: ["fish"],
    dishType: "fish",
    protein: "fish",
  }),
  seed("norwegian_company_lunch", "NO", "nb-NO", "pastaform-med-gronnsaker", "Pastaform med grønnsaker", {
    tags: ["pasta", "vegetarian"],
    dishType: "pasta",
    protein: "vegetarian",
  }),
  seed("norwegian_company_lunch", "NO", "nb-NO", "lapskaus", "Lapskaus", {
    tags: ["stew", "classic"],
    dishType: "stew",
    protein: "pork",
  }),

  // SE — swedish_lunch
  seed("swedish_lunch", "SE", "sv-SE", "kottbullar-med-potatismos", "Köttbullar med potatismos", {
    tags: ["beef", "classic"],
    dishType: "classic",
    protein: "beef",
  }),
  seed("swedish_lunch", "SE", "sv-SE", "kycklinggryta-med-ris", "Kycklinggryta med ris", {
    tags: ["chicken"],
    dishType: "stew",
    protein: "chicken",
  }),
  seed("swedish_lunch", "SE", "sv-SE", "lax-med-dillpotatis", "Lax med dillpotatis", {
    tags: ["fish"],
    dishType: "fish",
    protein: "fish",
  }),
  seed("swedish_lunch", "SE", "sv-SE", "vegetarisk-pytt", "Vegetarisk pytt", {
    tags: ["vegetarian"],
    dishType: "hash",
    protein: "vegetarian",
  }),
  seed("swedish_lunch", "SE", "sv-SE", "pasta-med-kramig-sas", "Pasta med krämig sås", {
    tags: ["pasta"],
    dishType: "pasta",
    protein: "chicken",
  }),

  // DK — danish_office_lunch
  seed("danish_office_lunch", "DK", "da-DK", "frikadeller-med-kartofler", "Frikadeller med kartofler", {
    tags: ["pork", "classic"],
    dishType: "classic",
    protein: "pork",
  }),
  seed("danish_office_lunch", "DK", "da-DK", "kylling-i-karry", "Kylling i karry", {
    tags: ["chicken", "curry"],
    dishType: "curry",
    protein: "chicken",
  }),
  seed("danish_office_lunch", "DK", "da-DK", "fiskefrikadeller-med-remoulade", "Fiskefrikadeller med remoulade", {
    tags: ["fish"],
    dishType: "fish",
    protein: "fish",
  }),
  seed("danish_office_lunch", "DK", "da-DK", "varm-pastaret", "Varm pastaret", {
    tags: ["pasta"],
    dishType: "pasta",
    protein: "vegetarian",
  }),
  seed("danish_office_lunch", "DK", "da-DK", "grontsagsgryde", "Grøntsagsgryde", {
    tags: ["vegetarian", "stew"],
    dishType: "stew",
    protein: "vegetarian",
  }),

  // FI — finnish_office_lunch
  seed("finnish_office_lunch", "FI", "fi-FI", "lohikeitto", "Lohikeitto", {
    tags: ["fish", "soup"],
    dishType: "soup",
    protein: "fish",
  }),
  seed("finnish_office_lunch", "FI", "fi-FI", "lihapullat-ja-perunamuusi", "Lihapullat ja perunamuusi", {
    tags: ["beef", "classic"],
    dishType: "classic",
    protein: "beef",
  }),
  seed("finnish_office_lunch", "FI", "fi-FI", "broilerikastike-ja-riisi", "Broilerikastike ja riisi", {
    tags: ["chicken"],
    dishType: "stew",
    protein: "chicken",
  }),
  seed("finnish_office_lunch", "FI", "fi-FI", "kasviskiusaus", "Kasviskiusaus", {
    tags: ["vegetarian", "stew"],
    dishType: "stew",
    protein: "vegetarian",
  }),
  seed("finnish_office_lunch", "FI", "fi-FI", "pastavuoka", "Pastavuoka", {
    tags: ["pasta"],
    dishType: "bake",
    protein: "vegetarian",
  }),

  // DE — german_business_lunch
  seed("german_business_lunch", "DE", "de-DE", "eintopf-mit-gemuese", "Eintopf mit Gemüse", {
    tags: ["stew", "vegetarian"],
    dishType: "stew",
    protein: "vegetarian",
  }),
  seed("german_business_lunch", "DE", "de-DE", "haehnchen-curry-mit-reis", "Hähnchen-Curry mit Reis", {
    tags: ["chicken", "curry"],
    dishType: "curry",
    protein: "chicken",
  }),
  seed("german_business_lunch", "DE", "de-DE", "kartoffelgericht-mit-salat", "Kartoffelgericht mit Salat", {
    tags: ["potato"],
    dishType: "potato",
    protein: "vegetarian",
  }),
  seed("german_business_lunch", "DE", "de-DE", "pasta-mit-gemuese", "Pasta mit Gemüse", {
    tags: ["pasta", "vegetarian"],
    dishType: "pasta",
    protein: "vegetarian",
  }),
  seed("german_business_lunch", "DE", "de-DE", "vegetarische-bowl", "Vegetarische Bowl", {
    tags: ["bowl", "vegetarian"],
    dishType: "bowl",
    protein: "vegetarian",
  }),

  // FR — french_dejeuner
  seed("french_dejeuner", "FR", "fr-FR", "quiche-lorraine", "Quiche lorraine", {
    tags: ["classic"],
    dishType: "quiche",
    protein: "pork",
  }),
  seed("french_dejeuner", "FR", "fr-FR", "poulet-basquaise", "Poulet basquaise", {
    tags: ["chicken"],
    dishType: "stew",
    protein: "chicken",
  }),
  seed("french_dejeuner", "FR", "fr-FR", "gratin-de-legumes", "Gratin de légumes", {
    tags: ["vegetarian"],
    dishType: "gratin",
    protein: "vegetarian",
  }),
  seed("french_dejeuner", "FR", "fr-FR", "ratatouille-avec-riz", "Ratatouille avec riz", {
    tags: ["vegetarian"],
    dishType: "stew",
    protein: "vegetarian",
  }),
  seed("french_dejeuner", "FR", "fr-FR", "salade-complete-chaude", "Salade complète chaude", {
    tags: ["salad"],
    dishType: "salad",
    protein: "chicken",
  }),

  // ES — spanish_menu_del_dia
  seed("spanish_menu_del_dia", "ES", "es-ES", "tortilla-espanola", "Tortilla española", {
    tags: ["classic"],
    dishType: "egg",
    protein: "egg",
  }),
  seed("spanish_menu_del_dia", "ES", "es-ES", "pollo-al-ajillo", "Pollo al ajillo", {
    tags: ["chicken"],
    dishType: "stew",
    protein: "chicken",
  }),
  seed("spanish_menu_del_dia", "ES", "es-ES", "lentejas-estofadas", "Lentejas estofadas", {
    tags: ["stew", "vegetarian"],
    dishType: "stew",
    protein: "vegetarian",
  }),
  seed("spanish_menu_del_dia", "ES", "es-ES", "arroz-con-verduras", "Arroz con verduras", {
    tags: ["rice", "vegetarian"],
    dishType: "rice",
    protein: "vegetarian",
  }),
  seed("spanish_menu_del_dia", "ES", "es-ES", "ensalada-templada", "Ensalada templada", {
    tags: ["salad"],
    dishType: "salad",
    protein: "fish",
  }),

  // UK — uk_office_lunch
  seed("uk_office_lunch", "UK", "en-GB", "chicken-curry-with-rice", "Chicken curry with rice", {
    tags: ["chicken", "curry"],
    dishType: "curry",
    protein: "chicken",
  }),
  seed("uk_office_lunch", "UK", "en-GB", "cottage-pie", "Cottage pie", {
    tags: ["beef", "classic"],
    dishType: "pie",
    protein: "beef",
  }),
  seed("uk_office_lunch", "UK", "en-GB", "jacket-potato-lunch", "Jacket potato lunch", {
    tags: ["potato"],
    dishType: "potato",
    protein: "vegetarian",
  }),
  seed("uk_office_lunch", "UK", "en-GB", "pasta-bake", "Pasta bake", {
    tags: ["pasta"],
    dishType: "bake",
    protein: "vegetarian",
  }),
  seed("uk_office_lunch", "UK", "en-GB", "soup-and-roll", "Soup and roll", {
    tags: ["soup"],
    dishType: "soup",
    protein: "vegetarian",
  }),

  // IT — italian_office_lunch
  seed("italian_office_lunch", "IT", "it-IT", "pasta-al-pomodoro", "Pasta al pomodoro", {
    tags: ["pasta", "vegetarian"],
    dishType: "pasta",
    protein: "vegetarian",
  }),
  seed("italian_office_lunch", "IT", "it-IT", "lasagne-vegetale", "Lasagne vegetale", {
    tags: ["pasta", "vegetarian"],
    dishType: "bake",
    protein: "vegetarian",
  }),
  seed("italian_office_lunch", "IT", "it-IT", "risotto-ai-funghi", "Risotto ai funghi", {
    tags: ["rice", "vegetarian"],
    dishType: "risotto",
    protein: "vegetarian",
  }),
  seed("italian_office_lunch", "IT", "it-IT", "pollo-alla-cacciatora", "Pollo alla cacciatora", {
    tags: ["chicken"],
    dishType: "stew",
    protein: "chicken",
  }),
  seed("italian_office_lunch", "IT", "it-IT", "minestrone", "Minestrone", {
    tags: ["soup", "vegetarian"],
    dishType: "soup",
    protein: "vegetarian",
  }),
] as const;

const SEEDS_BY_PROFILE: Readonly<Record<MenuProfileId, readonly WarmDishBankSeed[]>> = {
  norwegian_company_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "norwegian_company_lunch"),
  swedish_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "swedish_lunch"),
  danish_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "danish_office_lunch"),
  finnish_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "finnish_office_lunch"),
  german_business_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "german_business_lunch"),
  french_dejeuner: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "french_dejeuner"),
  spanish_menu_del_dia: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "spanish_menu_del_dia"),
  uk_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "uk_office_lunch"),
  italian_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "italian_office_lunch"),
};

export function toWarmDishDefinition(seedEntry: WarmDishBankSeed): WarmDishDefinition {
  return {
    key: seedEntry.key,
    title: seedEntry.title,
    tags: seedEntry.tags,
    allergens: seedEntry.allergens,
    profileId: seedEntry.profileId,
  };
}

export function warmDishDefinitionsForProfile(profileId: MenuProfileId): readonly WarmDishDefinition[] {
  return getWarmDishBankSeedsForProfile(profileId).map(toWarmDishDefinition);
}

export function listWarmDishBankSeeds(): readonly WarmDishBankSeed[] {
  return WARM_DISH_BANK_SEEDS;
}

export function getWarmDishBankSeedsForProfile(profileId: MenuProfileId): readonly WarmDishBankSeed[] {
  return SEEDS_BY_PROFILE[profileId] ?? [];
}

export function getWarmDishBankSeedsForMarket(market: MarketCode): readonly WarmDishBankSeed[] {
  return WARM_DISH_BANK_SEEDS.filter((s) => s.market === market);
}

export function assertWarmDishBankSeed(key: string): WarmDishBankSeed {
  const found = WARM_DISH_BANK_SEEDS.find((s) => s.key === key);
  if (!found) {
    throw new Error(`Unknown warm dish bank seed: ${String(key ?? "").trim() || "(empty)"}`);
  }
  return found;
}
