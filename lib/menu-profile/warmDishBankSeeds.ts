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

function phaseDSeedSet(
  profileId: MenuProfileId,
  market: MarketCode,
  locale: string,
  prefix: string,
  titles: readonly string[],
): WarmDishBankSeed[] {
  return titles.map((title, index) =>
    seed(profileId, market, locale, `${prefix}-${index + 1}`, title, {
      tags: ["phase-d-source-only", index === 4 ? "vegetarian" : "office-lunch"],
      dishType: index === 4 ? "vegetarian" : index === 3 ? "fish" : "hot-lunch",
      protein: index === 4 ? "vegetarian" : index === 3 ? "fish" : index === 2 ? "beef" : "chicken",
    }),
  );
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
  seed("uk_office_lunch", "GB", "en-GB", "chicken-pie-mash", "Chicken pie with mash and peas", {
    tags: ["chicken", "classic"],
    dishType: "pie",
    protein: "chicken",
    allergens: ["gluten", "milk"],
  }),
  seed("uk_office_lunch", "GB", "en-GB", "beef-stew-root", "Beef stew with root vegetables", {
    tags: ["beef", "stew"],
    dishType: "stew",
    protein: "beef",
  }),
  seed("uk_office_lunch", "GB", "en-GB", "baked-salmon-potatoes", "Baked salmon with potatoes", {
    tags: ["fish"],
    dishType: "fish",
    protein: "fish",
    allergens: ["fish"],
  }),
  seed("uk_office_lunch", "GB", "en-GB", "macaroni-cheese-salad", "Macaroni cheese with salad", {
    tags: ["pasta", "vegetarian"],
    dishType: "pasta",
    protein: "vegetarian",
    allergens: ["gluten", "milk"],
  }),
  seed(
    "uk_office_lunch",
    "GB",
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

  // Phase D — source-only rich-market profile stubs. These are inert seed-bank entries for
  // deterministic preview/tests only; no provider apply, Sanity write, or publish is implied.
  ...phaseDSeedSet("us_office_lunch", "US", "en-US", "us-office-lunch", [
    "Grilled chicken rice bowl",
    "Turkey chili with cornbread",
    "Beef brisket lunch plate",
    "Salmon with roasted potatoes",
    "Vegetarian mac and greens",
  ]),
  ...phaseDSeedSet("canadian_office_lunch", "CA", "en-CA", "canadian-office-lunch", [
    "Chicken tourtiere-style bowl",
    "Maple turkey with rice",
    "Beef stew with root vegetables",
    "Salmon with dill potatoes",
    "Vegetarian lentil shepherd's pie",
  ]),
  ...phaseDSeedSet("dutch_office_lunch", "NL", "nl-NL", "dutch-office-lunch", [
    "Kipstoof met rijst",
    "Gehaktbal met aardappelpuree",
    "Runderstoof met groenten",
    "Zalm met dilleaardappelen",
    "Vegetarische stamppot",
  ]),
  ...phaseDSeedSet("belgian_dutch_office_lunch", "BE", "nl-BE", "belgian-dutch-office-lunch", [
    "Kip met witloof en aardappelen",
    "Stoofvlees met groenten",
    "Vol-au-vent met rijst",
    "Zalm met prei",
    "Vegetarische groentestoof",
  ]),
  ...phaseDSeedSet("belgian_french_office_lunch", "BE", "fr-BE", "belgian-french-office-lunch", [
    "Poulet aux chicons et pommes de terre",
    "Carbonnade avec légumes",
    "Vol-au-vent avec riz",
    "Saumon aux poireaux",
    "Ragoût végétarien de légumes",
  ]),
  ...phaseDSeedSet("austrian_office_lunch", "AT", "de-AT", "austrian-office-lunch", [
    "Hendlragout mit Reis",
    "Rindsgulasch mit Erdäpfeln",
    "Faschierter Braten mit Gemüse",
    "Forelle mit Petersilienkartoffeln",
    "Vegetarische Krautfleckerl",
  ]),
  ...phaseDSeedSet("swiss_german_office_lunch", "CH", "de-CH", "swiss-german-office-lunch", [
    "Pouletgeschnetzeltes mit Reis",
    "Kalbsragout mit Rösti",
    "Rindsschmorgericht mit Gemüse",
    "Lachs mit Kartoffeln",
    "Vegetarische Älplermagronen",
  ]),
  ...phaseDSeedSet("swiss_french_office_lunch", "CH", "fr-CH", "swiss-french-office-lunch", [
    "Emincé de poulet avec riz",
    "Ragoût de veau avec rösti",
    "Bœuf mijoté aux légumes",
    "Saumon avec pommes de terre",
    "Macaronis alpins végétariens",
  ]),
  ...phaseDSeedSet("irish_office_lunch", "IE", "en-IE", "irish-office-lunch", [
    "Chicken and leek pie",
    "Turkey stew with potatoes",
    "Beef and barley casserole",
    "Baked cod with mash",
    "Vegetarian colcannon bake",
  ]),
  ...phaseDSeedSet("polish_office_lunch", "PL", "pl-PL", "polish-office-lunch", [
    "Kurczak duszony z ryżem",
    "Gulasz wołowy z ziemniakami",
    "Kotlety mielone z warzywami",
    "Łosoś z ziemniakami koperkowymi",
    "Wegetariańskie pierogi z kapustą",
  ]),
  ...phaseDSeedSet("romanian_office_lunch", "RO", "ro-RO", "romanian-office-lunch", [
    "Tocăniță de pui cu orez",
    "Gulaș de vită cu cartofi",
    "Chiftele cu legume",
    "Somon cu cartofi și mărar",
    "Ghiveci vegetarian de legume",
  ]),
  ...phaseDSeedSet("czech_office_lunch", "CZ", "cs-CZ", "czech-office-lunch", [
    "Dušené kuře s rýží",
    "Hovězí guláš s bramborem",
    "Sekaná se zeleninou",
    "Losos s bramborem a koprem",
    "Vegetariánské rizoto se zeleninou",
  ]),
  ...phaseDSeedSet("portuguese_office_lunch", "PT", "pt-PT", "portuguese-office-lunch", [
    "Frango estufado com arroz",
    "Guisado de vaca com batatas",
    "Almôndegas com legumes",
    "Salmão com batatas e endro",
    "Caçarola vegetariana de legumes",
  ]),
  ...phaseDSeedSet("greek_office_lunch", "GR", "el-GR", "greek-office-lunch", [
    "Κοτόπουλο κοκκινιστό με ρύζι",
    "Μοσχάρι στιφάδο με πατάτες",
    "Σουτζουκάκια με λαχανικά",
    "Σολομός με πατάτες και άνηθο",
    "Γεμιστά λαχανικά (χορτοφαγικό)",
  ]),
  ...phaseDSeedSet("luxembourg_office_lunch", "LU", "fr-LU", "luxembourg-office-lunch", [
    "Poulet mijoté avec pommes de terre",
    "Ragoût de dinde au riz",
    "Bœuf braisé aux légumes",
    "Truite avec pommes de terre",
    "Gratin végétarien",
  ]),
  ...phaseDSeedSet("australian_office_lunch", "AU", "en-AU", "australian-office-lunch", [
    "Chicken schnitzel with salad",
    "Beef and pumpkin tray bake",
    "Lamb ragu with pasta",
    "Barramundi with potatoes",
    "Vegetarian pumpkin curry",
  ]),
  ...phaseDSeedSet("singapore_office_lunch", "SG", "en-SG", "singapore-office-lunch", [
    "Chicken rice bowl",
    "Turkey laksa-style noodles",
    "Beef rendang with rice",
    "Fish curry with vegetables",
    "Vegetarian tofu stir-fry",
  ]),
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
  us_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "us_office_lunch"),
  canadian_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "canadian_office_lunch"),
  dutch_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "dutch_office_lunch"),
  belgian_dutch_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "belgian_dutch_office_lunch"),
  belgian_french_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "belgian_french_office_lunch"),
  austrian_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "austrian_office_lunch"),
  swiss_german_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "swiss_german_office_lunch"),
  swiss_french_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "swiss_french_office_lunch"),
  irish_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "irish_office_lunch"),
  polish_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "polish_office_lunch"),
  romanian_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "romanian_office_lunch"),
  czech_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "czech_office_lunch"),
  portuguese_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "portuguese_office_lunch"),
  greek_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "greek_office_lunch"),
  luxembourg_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "luxembourg_office_lunch"),
  australian_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "australian_office_lunch"),
  singapore_office_lunch: WARM_DISH_BANK_SEEDS.filter((s) => s.profileId === "singapore_office_lunch"),
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
