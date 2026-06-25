/**
 * INERT WARM DISH BANK SEEDS — ADR-019 G0.2 / G5c preview
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
  seed(
    "norwegian_company_lunch",
    "NO",
    "nb-NO",
    "kjottkaker-brun-saus",
    "Kjøttkaker med brun saus, poteter og ertestuing",
    { tags: ["beef", "classic"], dishType: "stew", protein: "beef", allergens: ["gluten", "melk"] },
  ),
  seed(
    "norwegian_company_lunch",
    "NO",
    "nb-NO",
    "kyllinggryte-ris-gronnsaker",
    "Kyllinggryte med ris og grønnsaker",
    { tags: ["chicken"], dishType: "stew", protein: "chicken" },
  ),
  seed(
    "norwegian_company_lunch",
    "NO",
    "nb-NO",
    "ovnsbakt-laks",
    "Ovnsbakt laks med poteter og agurksalat",
    { tags: ["fish"], dishType: "fish", protein: "fish", allergens: ["fisk"] },
  ),
  seed("norwegian_company_lunch", "NO", "nb-NO", "lasagne-med-salat", "Lasagne med salat", {
    tags: ["pasta"],
    dishType: "pasta",
    protein: "beef",
    allergens: ["gluten", "melk", "egg"],
  }),
  seed(
    "norwegian_company_lunch",
    "NO",
    "nb-NO",
    "vegetarisk-gryte-rotgronnsaker",
    "Vegetarisk gryte med rotgrønnsaker og byggryn",
    { tags: ["vegetarian", "stew"], dishType: "stew", protein: "vegetarian", allergens: ["gluten"] },
  ),

  // SE — swedish_lunch
  seed(
    "swedish_lunch",
    "SE",
    "sv-SE",
    "kottbullar-lingon",
    "Köttbullar med potatismos och lingon",
    { tags: ["beef", "classic"], dishType: "classic", protein: "beef", allergens: ["gluten", "mjölk"] },
  ),
  seed("swedish_lunch", "SE", "sv-SE", "kycklinggryta-med-ris", "Kycklinggryta med ris", {
    tags: ["chicken"],
    dishType: "stew",
    protein: "chicken",
  }),
  seed("swedish_lunch", "SE", "sv-SE", "ugnsbakad-lax-dillpotatis", "Ugnsbakad lax med dillpotatis", {
    tags: ["fish"],
    dishType: "fish",
    protein: "fish",
    allergens: ["fisk"],
  }),
  seed("swedish_lunch", "SE", "sv-SE", "pasta-kramig-svampsas", "Pasta med krämig svampsås", {
    tags: ["pasta", "vegetarian"],
    dishType: "pasta",
    protein: "vegetarian",
    allergens: ["gluten", "mjölk"],
  }),
  seed("swedish_lunch", "SE", "sv-SE", "vegetarisk-pytt-rodbeetor", "Vegetarisk pytt med rödbetor", {
    tags: ["vegetarian"],
    dishType: "hash",
    protein: "vegetarian",
  }),

  // DK — danish_office_lunch
  seed(
    "danish_office_lunch",
    "DK",
    "da-DK",
    "frikadeller-brun-sovs",
    "Frikadeller med kartofler og brun sovs",
    { tags: ["pork", "classic"], dishType: "classic", protein: "pork", allergens: ["gluten", "mælk"] },
  ),
  seed("danish_office_lunch", "DK", "da-DK", "kylling-i-karry", "Kylling i karry med ris", {
    tags: ["chicken", "curry"],
    dishType: "curry",
    protein: "chicken",
  }),
  seed(
    "danish_office_lunch",
    "DK",
    "da-DK",
    "stegt-fisk-remoulade",
    "Stegt fisk med remoulade og kartofler",
    { tags: ["fish"], dishType: "fish", protein: "fish", allergens: ["fisk", "æg"] },
  ),
  seed("danish_office_lunch", "DK", "da-DK", "boller-i-karry", "Boller i karry", {
    tags: ["beef", "curry"],
    dishType: "curry",
    protein: "beef",
    allergens: ["gluten", "mælk"],
  }),
  seed("danish_office_lunch", "DK", "da-DK", "vegetarisk-grontsagsgryde", "Vegetarisk grøntsagsgryde", {
    tags: ["vegetarian", "stew"],
    dishType: "stew",
    protein: "vegetarian",
  }),

  // FI — finnish_office_lunch
  seed(
    "finnish_office_lunch",
    "FI",
    "fi-FI",
    "lihapullat-tyttebaer",
    "Lihapullat med potetmos og tyttebær",
    { tags: ["beef", "classic"], dishType: "classic", protein: "beef", allergens: ["gluteeni", "maito"] },
  ),
  seed("finnish_office_lunch", "FI", "fi-FI", "lohikeitto", "Lohikeitto / kremet laksesuppe", {
    tags: ["fish", "soup"],
    dishType: "soup",
    protein: "fish",
    allergens: ["kala", "maito"],
  }),
  seed("finnish_office_lunch", "FI", "fi-FI", "kyllinggryte-ris", "Kyllinggryte med ris", {
    tags: ["chicken"],
    dishType: "stew",
    protein: "chicken",
  }),
  seed("finnish_office_lunch", "FI", "fi-FI", "makaronilaatikko", "Makaronilaatikko / makaroniform", {
    tags: ["pasta"],
    dishType: "bake",
    protein: "beef",
    allergens: ["gluteeni", "maito", "kananmuna"],
  }),
  seed(
    "finnish_office_lunch",
    "FI",
    "fi-FI",
    "vegetarisk-rotgronnsaksgryte",
    "Vegetarisk rotgrønnsaksgryte",
    { tags: ["vegetarian", "stew"], dishType: "stew", protein: "vegetarian" },
  ),

  // DE — german_business_lunch
  seed(
    "german_business_lunch",
    "DE",
    "de-DE",
    "haehnchengeschnetzeltes-reis",
    "Hähnchengeschnetzeltes mit Reis",
    { tags: ["chicken"], dishType: "stew", protein: "chicken", allergens: ["Milch"] },
  ),
  seed(
    "german_business_lunch",
    "DE",
    "de-DE",
    "rinderfrikadellen-kartoffelpuree",
    "Rinderfrikadellen mit Kartoffelpüree",
    { tags: ["beef", "classic"], dishType: "classic", protein: "beef", allergens: ["Gluten", "Milch", "Ei"] },
  ),
  seed(
    "german_business_lunch",
    "DE",
    "de-DE",
    "gebackener-fisch-kartoffelsalat",
    "Gebackener Fisch mit Kartoffelsalat",
    { tags: ["fish"], dishType: "fish", protein: "fish", allergens: ["Fisch", "Ei"] },
  ),
  seed(
    "german_business_lunch",
    "DE",
    "de-DE",
    "pasta-pilzrahmsauce",
    "Pasta mit Pilzrahmsauce",
    { tags: ["pasta", "vegetarian"], dishType: "pasta", protein: "vegetarian", allergens: ["Gluten", "Milch"] },
  ),
  seed(
    "german_business_lunch",
    "DE",
    "de-DE",
    "vegetarischer-linseneintopf",
    "Vegetarischer Linseneintopf",
    { tags: ["stew", "vegetarian"], dishType: "stew", protein: "vegetarian" },
  ),

  // FR — french_dejeuner
  seed("french_dejeuner", "FR", "fr-FR", "poulet-basquaise-ris", "Poulet basquaise med ris", {
    tags: ["chicken"],
    dishType: "stew",
    protein: "chicken",
  }),
  seed(
    "french_dejeuner",
    "FR",
    "fr-FR",
    "boeuf-bourguignon",
    "Boeuf bourguignon med potetpuré",
    { tags: ["beef", "classic"], dishType: "stew", protein: "beef", allergens: ["gluten"] },
  ),
  seed("french_dejeuner", "FR", "fr-FR", "gratin-de-legumes", "Gratin de légumes", {
    tags: ["vegetarian"],
    dishType: "gratin",
    protein: "vegetarian",
    allergens: ["lait"],
  }),
  seed("french_dejeuner", "FR", "fr-FR", "saumon-rot-haricots", "Saumon rôti med grønne bønner", {
    tags: ["fish"],
    dishType: "fish",
    protein: "fish",
    allergens: ["poisson"],
  }),
  seed("french_dejeuner", "FR", "fr-FR", "ratatouille-linser", "Ratatouille med linser", {
    tags: ["vegetarian"],
    dishType: "stew",
    protein: "vegetarian",
  }),

  // ES — spanish_menu_del_dia
  seed("spanish_menu_del_dia", "ES", "es-ES", "pollo-al-ajillo-ris", "Pollo al ajillo med ris", {
    tags: ["chicken"],
    dishType: "stew",
    protein: "chicken",
  }),
  seed("spanish_menu_del_dia", "ES", "es-ES", "albondigas-tomatsaus", "Albóndigas i tomatsaus", {
    tags: ["beef"],
    dishType: "stew",
    protein: "beef",
    allergens: ["gluten", "huevo"],
  }),
  seed("spanish_menu_del_dia", "ES", "es-ES", "tortilla-espanola-salat", "Tortilla española med salat", {
    tags: ["classic"],
    dishType: "egg",
    protein: "egg",
    allergens: ["huevo"],
  }),
  seed("spanish_menu_del_dia", "ES", "es-ES", "paella-verduras", "Paella de verduras", {
    tags: ["rice", "vegetarian"],
    dishType: "rice",
    protein: "vegetarian",
  }),
  seed("spanish_menu_del_dia", "ES", "es-ES", "merluza-poteter-sitron", "Merluza med poteter og sitron", {
    tags: ["fish"],
    dishType: "fish",
    protein: "fish",
    allergens: ["pescado"],
  }),

  // UK — uk_office_lunch
  seed("uk_office_lunch", "UK", "en-GB", "chicken-pie-mash", "Chicken pie with mash and peas", {
    tags: ["chicken", "classic"],
    dishType: "pie",
    protein: "chicken",
    allergens: ["gluten", "milk"],
  }),
  seed("uk_office_lunch", "UK", "en-GB", "beef-stew-root", "Beef stew with root vegetables", {
    tags: ["beef", "stew"],
    dishType: "stew",
    protein: "beef",
  }),
  seed("uk_office_lunch", "UK", "en-GB", "baked-salmon-potatoes", "Baked salmon with potatoes", {
    tags: ["fish"],
    dishType: "fish",
    protein: "fish",
    allergens: ["fish"],
  }),
  seed("uk_office_lunch", "UK", "en-GB", "macaroni-cheese-salad", "Macaroni cheese with salad", {
    tags: ["pasta", "vegetarian"],
    dishType: "pasta",
    protein: "vegetarian",
    allergens: ["gluten", "milk"],
  }),
  seed(
    "uk_office_lunch",
    "UK",
    "en-GB",
    "vegetarian-shepherds-pie",
    "Vegetarian shepherd's pie",
    { tags: ["vegetarian", "pie"], dishType: "pie", protein: "vegetarian" },
  ),

  // IT — italian_office_lunch
  seed("italian_office_lunch", "IT", "it-IT", "lasagne-al-forno", "Lasagne al forno med salat", {
    tags: ["pasta"],
    dishType: "bake",
    protein: "beef",
    allergens: ["glutine", "latte", "uova"],
  }),
  seed(
    "italian_office_lunch",
    "IT",
    "it-IT",
    "pollo-alla-cacciatora-poteter",
    "Pollo alla cacciatora med poteter",
    { tags: ["chicken"], dishType: "stew", protein: "chicken" },
  ),
  seed("italian_office_lunch", "IT", "it-IT", "pasta-al-ragu", "Pasta al ragù", {
    tags: ["pasta"],
    dishType: "pasta",
    protein: "beef",
    allergens: ["glutine"],
  }),
  seed("italian_office_lunch", "IT", "it-IT", "risotto-ai-funghi", "Risotto ai funghi", {
    tags: ["rice", "vegetarian"],
    dishType: "risotto",
    protein: "vegetarian",
    allergens: ["latte"],
  }),
  seed(
    "italian_office_lunch",
    "IT",
    "it-IT",
    "parmigiana-melanzane",
    "Parmigiana di melanzane",
    { tags: ["vegetarian"], dishType: "bake", protein: "vegetarian", allergens: ["latte"] },
  ),
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
