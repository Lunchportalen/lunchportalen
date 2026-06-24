/**
 * INERT MENU PROFILE REGISTRY — ADR-019 G0
 *
 * Seed profiles per market. NO profile mirrors current PLAN_CATEGORIES behavior as data only.
 * NOT FOR RUNTIME until G1+ resolver behind feature flag.
 */

import type {
  AutoPublishRuleSet,
  MenuCategoryDefinition,
  MenuProfile,
  MenuProfileId,
  PackageKey,
  WarmDishDefinition,
  WarmDishRuleSet,
} from "@/lib/menu-profile/types";

const DEFAULT_AUTO_PUBLISH_RULES: AutoPublishRuleSet = {
  requireCompleteWeek: true,
  requireWarmDishForDeliveryDays: true,
  requireValidProviderAgreement: true,
  requireCurrency: true,
  requirePackagePrices: true,
  requireMenuProfile: true,
};

const DEFAULT_WARM_DISH_RULES: WarmDishRuleSet = {
  requireOneSharedWarmDishPerDeliveryDay: true,
  avoidRepeatedProtein: true,
  avoidRepeatedDishType: true,
  maxFishDaysPerWeek: 2,
  maxSoupDaysPerWeek: 1,
};

function fixedChoice(
  key: string,
  label: string,
  description?: string,
): MenuCategoryDefinition {
  return { key, label, description, kind: "fixed_choice", providerEditable: true };
}

function warmDishCategory(
  key: string,
  label: string,
  description?: string,
): MenuCategoryDefinition {
  return { key, label, description, kind: "warm_dish", providerEditable: true };
}

function upgradeCategory(label: string, description: string): MenuCategoryDefinition {
  return {
    key: "enterprise_upgrade",
    label,
    description,
    kind: "upgrade",
    providerEditable: false,
  };
}

function warmDish(
  profileId: MenuProfileId,
  key: string,
  title: string,
  tags?: readonly string[],
): WarmDishDefinition {
  return { key, title, tags, profileId };
}

function packageDef(
  key: PackageKey,
  label: string,
  categoryKeys: readonly string[],
  opts?: { enterpriseUpgrade?: boolean },
) {
  const warmDishKeys = categoryKeys.filter((k) => k !== "enterprise_upgrade");
  const includesSharedWarmDish = warmDishKeys.some((k) =>
    ["varmrett", "varm_lunch", "varm_frokost", "lammin_lounas", "warme_mahlzeit", "plat_du_jour", "plato_del_dia", "hot_lunch"].includes(k),
  );
  return {
    key,
    label,
    categoryKeys,
    includesSharedWarmDish,
    enterpriseUpgrade: opts?.enterpriseUpgrade ?? false,
  };
}

function enterpriseUpgradeModel(label: string, description: string) {
  return { enabled: true, label, description };
}

const NORWEGIAN_COMPANY_LUNCH: MenuProfile = {
  id: "norwegian_company_lunch",
  market: "NO",
  locale: "nb-NO",
  name: "Norsk firmalunsj",
  description: "Norsk lunsjprofil — speiler dagens NO-pilot som seed, ikke global runtime-sannhet.",
  fixedChoiceCategories: [
    fixedChoice("paasmurt", "Påsmurt"),
    fixedChoice("salatboks", "Salatboks"),
    warmDishCategory("varmrett", "Varmrett", "Én felles varmrett per leveringsdag."),
    fixedChoice("sushi", "Sushi"),
    fixedChoice("pokebowl", "Pokébowl"),
    fixedChoice("thaimat", "Thaimat"),
    upgradeCategory(
      "Enterprise-oppgradering",
      "Tillegg på samme varmrett — ikke egen varmrett.",
    ),
  ],
  packageModel: {
    basis: packageDef("basis", "Basis", ["paasmurt", "salatboks", "varmrett"]),
    luxus: packageDef("luxus", "Luxus", [
      "paasmurt",
      "salatboks",
      "varmrett",
      "sushi",
      "pokebowl",
      "thaimat",
    ]),
    enterprise: packageDef(
      "enterprise",
      "Enterprise",
      ["paasmurt", "salatboks", "varmrett", "sushi", "pokebowl", "thaimat", "enterprise_upgrade"],
      { enterpriseUpgrade: true },
    ),
  },
  warmDishBank: [
    warmDish("norwegian_company_lunch", "kjottkaker", "Kjøttkaker", ["classic"]),
    warmDish("norwegian_company_lunch", "lapskaus", "Lapskaus", ["classic"]),
    warmDish("norwegian_company_lunch", "kyllinggryte", "Kyllinggryte", ["poultry"]),
    warmDish("norwegian_company_lunch", "fiskekaker", "Fiskekaker", ["fish"]),
    warmDish("norwegian_company_lunch", "pastaform", "Pastaform", ["pasta"]),
    warmDish("norwegian_company_lunch", "thai-gryte", "Thai-inspirert gryte", ["asian"]),
  ],
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Enterprise-oppgradering",
    "Samme varmrett som Luxus med tillegg/oppgradering i ukeplan — aldri egen varmrett.",
  ),
};

const SWEDISH_LUNCH: MenuProfile = {
  id: "swedish_lunch",
  market: "SE",
  locale: "sv-SE",
  name: "Svensk lunch",
  description: "Svensk kontorslunch — seed for SE-marked.",
  fixedChoiceCategories: [
    fixedChoice("smorgas", "Smörgås"),
    fixedChoice("sallad", "Sallad"),
    warmDishCategory("varm_lunch", "Varm lunch"),
    fixedChoice("bowl", "Bowl"),
    fixedChoice("wrap", "Wrap"),
    upgradeCategory("Enterprise-uppgradering", "Tillägg på samma varmrätt."),
  ],
  packageModel: {
    basis: packageDef("basis", "Basis", ["smorgas", "sallad", "varm_lunch"]),
    luxus: packageDef("luxus", "Luxus", ["smorgas", "sallad", "varm_lunch", "bowl", "wrap"]),
    enterprise: packageDef(
      "enterprise",
      "Enterprise",
      ["smorgas", "sallad", "varm_lunch", "bowl", "wrap", "enterprise_upgrade"],
      { enterpriseUpgrade: true },
    ),
  },
  warmDishBank: [
    warmDish("swedish_lunch", "kottbullar", "Köttbullar"),
    warmDish("swedish_lunch", "pytt-i-panna", "Pytt i panna"),
    warmDish("swedish_lunch", "fisksoppa", "Fisksoppa", ["fish", "soup"]),
    warmDish("swedish_lunch", "pasta-bolognese", "Pasta bolognese"),
  ],
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Enterprise-uppgradering",
    "Samma varmrätt som Luxus med tillägg i veckoplan.",
  ),
};

const DANISH_OFFICE_LUNCH: MenuProfile = {
  id: "danish_office_lunch",
  market: "DK",
  locale: "da-DK",
  name: "Dansk kontorfrokost",
  description: "Dansk frokost/lunsj — seed for DK-marked.",
  fixedChoiceCategories: [
    fixedChoice("smorrebrod", "Smørrebrød"),
    fixedChoice("salat", "Salat"),
    warmDishCategory("varm_frokost", "Varm frokost"),
    fixedChoice("bowl", "Bowl"),
    fixedChoice("sandwich", "Sandwich"),
    upgradeCategory("Enterprise-opgradering", "Tillæg på samme varm ret."),
  ],
  packageModel: {
    basis: packageDef("basis", "Basis", ["smorrebrod", "salat", "varm_frokost"]),
    luxus: packageDef("luxus", "Luxus", [
      "smorrebrod",
      "salat",
      "varm_frokost",
      "bowl",
      "sandwich",
    ]),
    enterprise: packageDef(
      "enterprise",
      "Enterprise",
      ["smorrebrod", "salat", "varm_frokost", "bowl", "sandwich", "enterprise_upgrade"],
      { enterpriseUpgrade: true },
    ),
  },
  warmDishBank: [
    warmDish("danish_office_lunch", "frikadeller", "Frikadeller"),
    warmDish("danish_office_lunch", "stegt-flaesk", "Stegt flæsk"),
    warmDish("danish_office_lunch", "gullasch", "Gullasch"),
    warmDish("danish_office_lunch", "fiskefilet", "Fiskefilet", ["fish"]),
  ],
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Enterprise-opgradering",
    "Samme varme ret som Luxus med tillæg i ugeplan.",
  ),
};

const FINNISH_OFFICE_LUNCH: MenuProfile = {
  id: "finnish_office_lunch",
  market: "FI",
  locale: "fi-FI",
  name: "Finnish office lunch",
  description: "Suomalainen toimistolounas — seed for FI-marked.",
  fixedChoiceCategories: [
    fixedChoice("voileipa", "Voileipä"),
    fixedChoice("salaatti", "Salaatti"),
    warmDishCategory("lammin_lounas", "Lämmin lounas"),
    fixedChoice("bowl", "Bowl"),
    fixedChoice("kasvisvaihtoehto", "Kasvisvaihtoehto"),
    upgradeCategory("Enterprise-päivitys", "Lisä samalle lämpimälle lounaalle."),
  ],
  packageModel: {
    basis: packageDef("basis", "Basis", ["voileipa", "salaatti", "lammin_lounas"]),
    luxus: packageDef("luxus", "Luxus", [
      "voileipa",
      "salaatti",
      "lammin_lounas",
      "bowl",
      "kasvisvaihtoehto",
    ]),
    enterprise: packageDef(
      "enterprise",
      "Enterprise",
      ["voileipa", "salaatti", "lammin_lounas", "bowl", "kasvisvaihtoehto", "enterprise_upgrade"],
      { enterpriseUpgrade: true },
    ),
  },
  warmDishBank: [
    warmDish("finnish_office_lunch", "lihapullat", "Lihapullat"),
    warmDish("finnish_office_lunch", "lohikeitto", "Lohikeitto", ["fish", "soup"]),
    warmDish("finnish_office_lunch", "pasta", "Pasta"),
    warmDish("finnish_office_lunch", "kasvispata", "Kasvispata", ["vegetarian"]),
  ],
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Enterprise-päivitys",
    "Sama lämmin lounas kuin Luxus — päivitys viikkosuunnitelmassa.",
  ),
};

const GERMAN_BUSINESS_LUNCH: MenuProfile = {
  id: "german_business_lunch",
  market: "DE",
  locale: "de-DE",
  name: "German business lunch",
  description: "Deutsches Business-Lunch-Profil — seed for DE-marked.",
  fixedChoiceCategories: [
    fixedChoice("belegte_broetchen", "Belegte Brötchen"),
    fixedChoice("salat", "Salat"),
    warmDishCategory("warme_mahlzeit", "Warme Mahlzeit"),
    fixedChoice("bowl", "Bowl"),
    fixedChoice("vegetarische_option", "Vegetarische Option"),
    upgradeCategory("Enterprise-Upgrade", "Zusatz zur gleichen warmen Mahlzeit."),
  ],
  packageModel: {
    basis: packageDef("basis", "Basis", ["belegte_broetchen", "salat", "warme_mahlzeit"]),
    luxus: packageDef("luxus", "Luxus", [
      "belegte_broetchen",
      "salat",
      "warme_mahlzeit",
      "bowl",
      "vegetarische_option",
    ]),
    enterprise: packageDef(
      "enterprise",
      "Enterprise",
      [
        "belegte_broetchen",
        "salat",
        "warme_mahlzeit",
        "bowl",
        "vegetarische_option",
        "enterprise_upgrade",
      ],
      { enterpriseUpgrade: true },
    ),
  },
  warmDishBank: [
    warmDish("german_business_lunch", "eintopf", "Eintopf", ["stew"]),
    warmDish("german_business_lunch", "kartoffelgericht", "Kartoffelgericht"),
    warmDish("german_business_lunch", "pasta-lunch", "Pasta lunch"),
    warmDish("german_business_lunch", "schnitzel-style", "Schnitzel-style lunch"),
    warmDish("german_business_lunch", "vegetarische-bowl", "Vegetarische bowl", ["vegetarian"]),
  ],
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Enterprise-Upgrade",
    "Gleiche warme Mahlzeit wie Luxus — Upgrade im Wochenplan.",
  ),
};

const FRENCH_DEJEUNER: MenuProfile = {
  id: "french_dejeuner",
  market: "FR",
  locale: "fr-FR",
  name: "French déjeuner",
  description: "Profil déjeuner d'entreprise — seed for FR-marked.",
  fixedChoiceCategories: [
    fixedChoice("sandwich_baguette", "Sandwich baguette"),
    fixedChoice("salade", "Salade"),
    warmDishCategory("plat_du_jour", "Plat du jour"),
    fixedChoice("quiche_tarte", "Quiche / tarte"),
    fixedChoice("dessert_option", "Option dessert"),
    upgradeCategory("Upgrade Enterprise", "Supplément sur le même plat du jour."),
  ],
  packageModel: {
    basis: packageDef("basis", "Basis", ["sandwich_baguette", "salade", "plat_du_jour"]),
    luxus: packageDef("luxus", "Luxus", [
      "sandwich_baguette",
      "salade",
      "plat_du_jour",
      "quiche_tarte",
      "dessert_option",
    ]),
    enterprise: packageDef(
      "enterprise",
      "Enterprise",
      [
        "sandwich_baguette",
        "salade",
        "plat_du_jour",
        "quiche_tarte",
        "dessert_option",
        "enterprise_upgrade",
      ],
      { enterpriseUpgrade: true },
    ),
  },
  warmDishBank: [
    warmDish("french_dejeuner", "quiche-lorraine", "Quiche lorraine"),
    warmDish("french_dejeuner", "gratin", "Gratin"),
    warmDish("french_dejeuner", "poulet-basquaise", "Poulet basquaise"),
    warmDish("french_dejeuner", "ratatouille", "Ratatouille", ["vegetarian"]),
    warmDish("french_dejeuner", "salade-complete", "Salade complète"),
  ],
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Upgrade Enterprise",
    "Même plat du jour que Luxus — supplément dans le plan hebdomadaire.",
  ),
};

const SPANISH_MENU_DEL_DIA: MenuProfile = {
  id: "spanish_menu_del_dia",
  market: "ES",
  locale: "es-ES",
  name: "Spanish menú del día",
  description: "Perfil menú del día — seed for ES-marked.",
  fixedChoiceCategories: [
    warmDishCategory("plato_del_dia", "Plato del día"),
    fixedChoice("ensalada", "Ensalada"),
    fixedChoice("bocadillo", "Bocadillo"),
    fixedChoice("bowl", "Bowl"),
    fixedChoice("tapas_style_option", "Opción estilo tapas"),
    upgradeCategory("Upgrade Enterprise", "Suplemento en el mismo plato del día."),
  ],
  packageModel: {
    basis: packageDef("basis", "Basis", ["plato_del_dia", "ensalada", "bocadillo"]),
    luxus: packageDef("luxus", "Luxus", [
      "plato_del_dia",
      "ensalada",
      "bocadillo",
      "bowl",
      "tapas_style_option",
    ]),
    enterprise: packageDef(
      "enterprise",
      "Enterprise",
      ["plato_del_dia", "ensalada", "bocadillo", "bowl", "tapas_style_option", "enterprise_upgrade"],
      { enterpriseUpgrade: true },
    ),
  },
  warmDishBank: [
    warmDish("spanish_menu_del_dia", "tortilla-espanola", "Tortilla española"),
    warmDish("spanish_menu_del_dia", "pollo-al-ajillo", "Pollo al ajillo"),
    warmDish("spanish_menu_del_dia", "arroz", "Arroz"),
    warmDish("spanish_menu_del_dia", "lentejas", "Lentejas"),
    warmDish("spanish_menu_del_dia", "ensalada-mixta", "Ensalada mixta"),
  ],
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Upgrade Enterprise",
    "Mismo plato del día que Luxus — suplemento en plan semanal.",
  ),
};

const UK_OFFICE_LUNCH: MenuProfile = {
  id: "uk_office_lunch",
  market: "UK",
  locale: "en-GB",
  name: "UK office lunch",
  description: "UK office lunch profile — seed for UK market.",
  fixedChoiceCategories: [
    fixedChoice("sandwiches", "Sandwiches"),
    fixedChoice("salads", "Salads"),
    warmDishCategory("hot_lunch", "Hot lunch"),
    fixedChoice("bowls", "Bowls"),
    fixedChoice("wraps", "Wraps"),
    upgradeCategory("Enterprise upgrade", "Add-on to the same hot lunch — not a separate hot dish."),
  ],
  packageModel: {
    basis: packageDef("basis", "Basis", ["sandwiches", "salads", "hot_lunch"]),
    luxus: packageDef("luxus", "Luxus", ["sandwiches", "salads", "hot_lunch", "bowls", "wraps"]),
    enterprise: packageDef(
      "enterprise",
      "Enterprise",
      ["sandwiches", "salads", "hot_lunch", "bowls", "wraps", "enterprise_upgrade"],
      { enterpriseUpgrade: true },
    ),
  },
  warmDishBank: [
    warmDish("uk_office_lunch", "cottage-pie", "Cottage pie"),
    warmDish("uk_office_lunch", "chicken-curry", "Chicken curry"),
    warmDish("uk_office_lunch", "jacket-potato", "Jacket potato lunch"),
    warmDish("uk_office_lunch", "pasta-bake", "Pasta bake"),
    warmDish("uk_office_lunch", "roast-vegetable-tray", "Roast vegetable tray", ["vegetarian"]),
    warmDish("uk_office_lunch", "soup-and-roll", "Soup and roll", ["soup"]),
  ],
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Enterprise upgrade",
    "Same hot lunch as Luxus with add-ons in the week plan — never a separate hot dish.",
  ),
};

export const MENU_PROFILE_REGISTRY: Readonly<Record<MenuProfileId, MenuProfile>> = {
  norwegian_company_lunch: NORWEGIAN_COMPANY_LUNCH,
  swedish_lunch: SWEDISH_LUNCH,
  danish_office_lunch: DANISH_OFFICE_LUNCH,
  finnish_office_lunch: FINNISH_OFFICE_LUNCH,
  german_business_lunch: GERMAN_BUSINESS_LUNCH,
  french_dejeuner: FRENCH_DEJEUNER,
  spanish_menu_del_dia: SPANISH_MENU_DEL_DIA,
  uk_office_lunch: UK_OFFICE_LUNCH,
};

export function isSupportedMenuProfile(profileId: string): profileId is MenuProfileId {
  return Object.prototype.hasOwnProperty.call(MENU_PROFILE_REGISTRY, profileId);
}

export function getMenuProfile(profileId: MenuProfileId): MenuProfile {
  return MENU_PROFILE_REGISTRY[profileId];
}

export function listMenuProfiles(): readonly MenuProfile[] {
  return Object.values(MENU_PROFILE_REGISTRY);
}

export function assertMenuProfile(profileId: string): MenuProfile {
  if (!isSupportedMenuProfile(profileId)) {
    throw new Error(`Unknown menu profile: ${String(profileId ?? "").trim() || "(empty)"}`);
  }
  return getMenuProfile(profileId);
}
