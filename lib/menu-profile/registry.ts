/**
 * INERT MENU PROFILE REGISTRY — ADR-019 G0
 *
 * Seed profiles per market. NO profile mirrors current PLAN_CATEGORIES behavior as data only.
 * NOT FOR RUNTIME until G1+ resolver behind feature flag.
 */

import { warmDishDefinitionsForProfile } from "@/lib/menu-profile/warmDishBankSeeds";
import type {
  AutoPublishRuleSet,
  MenuCategoryDefinition,
  MenuProfile,
  MenuProfileId,
  PackageKey,
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

function packageDef(
  key: PackageKey,
  label: string,
  categoryKeys: readonly string[],
  opts?: { enterpriseUpgrade?: boolean },
) {
  const warmDishKeys = categoryKeys.filter((k) => k !== "enterprise_upgrade");
  const includesSharedWarmDish = warmDishKeys.some((k) =>
    [
      "varmrett",
      "varm_lunch",
      "varm_frokost",
      "lammin_lounas",
      "warme_mahlzeit",
      "plat_du_jour",
      "plato_del_dia",
      "hot_lunch",
      "primo_del_giorno",
    ].includes(k),
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
  warmDishBank: warmDishDefinitionsForProfile("norwegian_company_lunch"),
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
  warmDishBank: warmDishDefinitionsForProfile("swedish_lunch"),
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
  warmDishBank: warmDishDefinitionsForProfile("danish_office_lunch"),
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
  warmDishBank: warmDishDefinitionsForProfile("finnish_office_lunch"),
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
  warmDishBank: warmDishDefinitionsForProfile("german_business_lunch"),
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
  warmDishBank: warmDishDefinitionsForProfile("french_dejeuner"),
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
  warmDishBank: warmDishDefinitionsForProfile("spanish_menu_del_dia"),
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Upgrade Enterprise",
    "Mismo plato del día que Luxus — suplemento en plan semanal.",
  ),
};

const UK_OFFICE_LUNCH: MenuProfile = {
  id: "uk_office_lunch",
  market: "GB",
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
  warmDishBank: warmDishDefinitionsForProfile("uk_office_lunch"),
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Enterprise upgrade",
    "Same hot lunch as Luxus with add-ons in the week plan — never a separate hot dish.",
  ),
};

const ITALIAN_OFFICE_LUNCH: MenuProfile = {
  id: "italian_office_lunch",
  market: "IT",
  locale: "it-IT",
  name: "Pranzo aziendale italiano",
  description: "Profilo pranzo ufficio italiano — seed for IT-marked.",
  fixedChoiceCategories: [
    fixedChoice("panini", "Panini"),
    fixedChoice("insalata", "Insalata"),
    warmDishCategory("primo_del_giorno", "Primo del giorno", "Un primo caldo condiviso per giorno di consegna."),
    fixedChoice("bowl", "Bowl"),
    fixedChoice("piatto_freddo", "Piatto freddo"),
    upgradeCategory(
      "Upgrade Enterprise",
      "Supplemento sullo stesso primo del giorno — mai un piatto caldo separato.",
    ),
  ],
  packageModel: {
    basis: packageDef("basis", "Basis", ["panini", "insalata", "primo_del_giorno"]),
    luxus: packageDef("luxus", "Luxus", ["panini", "insalata", "primo_del_giorno", "bowl", "piatto_freddo"]),
    enterprise: packageDef(
      "enterprise",
      "Enterprise",
      ["panini", "insalata", "primo_del_giorno", "bowl", "piatto_freddo", "enterprise_upgrade"],
      { enterpriseUpgrade: true },
    ),
  },
  warmDishBank: warmDishDefinitionsForProfile("italian_office_lunch"),
  warmDishRules: DEFAULT_WARM_DISH_RULES,
  autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
  enterpriseUpgradeModel: enterpriseUpgradeModel(
    "Upgrade Enterprise",
    "Stesso primo del giorno di Luxus con supplementi nel piano settimanale.",
  ),
};

function dormantPhaseDOfficeLunchProfile(input: {
  id: MenuProfileId;
  market: MenuProfile["market"];
  locale: string;
  name: string;
  sandwichLabel: string;
  saladLabel: string;
  warmLunchLabel: string;
  bowlLabel: string;
  flexibleLabel: string;
  enterpriseLabel: string;
  enterpriseDescription: string;
  riskNote: string;
}): MenuProfile {
  const {
    id,
    market,
    locale,
    name,
    sandwichLabel,
    saladLabel,
    warmLunchLabel,
    bowlLabel,
    flexibleLabel,
    enterpriseLabel,
    enterpriseDescription,
    riskNote,
  } = input;

  return {
    id,
    market,
    locale,
    name,
    description: `Phase D source-only dormant profile. ${riskNote} No provider apply, Sanity write, generator apply, publish, SOT, or rollout automation is enabled by this profile.`,
    fixedChoiceCategories: [
      fixedChoice("sandwiches", sandwichLabel),
      fixedChoice("salads", saladLabel),
      warmDishCategory("hot_lunch", warmLunchLabel, "One shared warm lunch per delivery day."),
      fixedChoice("bowls", bowlLabel),
      fixedChoice("flexible_option", flexibleLabel),
      upgradeCategory(enterpriseLabel, enterpriseDescription),
    ],
    packageModel: {
      basis: packageDef("basis", "Basis", ["sandwiches", "salads", "hot_lunch"]),
      luxus: packageDef("luxus", "Luxus", ["sandwiches", "salads", "hot_lunch", "bowls", "flexible_option"]),
      enterprise: packageDef(
        "enterprise",
        "Enterprise",
        ["sandwiches", "salads", "hot_lunch", "bowls", "flexible_option", "enterprise_upgrade"],
        { enterpriseUpgrade: true },
      ),
    },
    warmDishBank: warmDishDefinitionsForProfile(id),
    warmDishRules: DEFAULT_WARM_DISH_RULES,
    autoPublishRules: DEFAULT_AUTO_PUBLISH_RULES,
    enterpriseUpgradeModel: enterpriseUpgradeModel(enterpriseLabel, enterpriseDescription),
  };
}

const US_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "us_office_lunch",
  market: "US",
  locale: "en-US",
  name: "US office lunch",
  sandwichLabel: "Sandwiches",
  saladLabel: "Salads",
  warmLunchLabel: "Hot lunch",
  bowlLabel: "Bowls",
  flexibleLabel: "Flexible option",
  enterpriseLabel: "Enterprise upgrade",
  enterpriseDescription: "Same hot lunch with premium add-ons in the week plan.",
  riskNote: "State/local sales tax and provider-specific timezone must be resolved before apply.",
});

const CANADIAN_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "canadian_office_lunch",
  market: "CA",
  locale: "en-CA",
  name: "Canadian office lunch",
  sandwichLabel: "Sandwiches",
  saladLabel: "Salads",
  warmLunchLabel: "Hot lunch",
  bowlLabel: "Bowls",
  flexibleLabel: "Flexible option",
  enterpriseLabel: "Enterprise upgrade",
  enterpriseDescription: "Same hot lunch with premium add-ons in the week plan.",
  riskNote: "Province tax/timezone review required; fr-CA is not included in this batch.",
});

const DUTCH_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "dutch_office_lunch",
  market: "NL",
  locale: "nl-NL",
  name: "Nederlandse kantoor lunch",
  sandwichLabel: "Broodjes",
  saladLabel: "Salades",
  warmLunchLabel: "Warme lunch",
  bowlLabel: "Bowls",
  flexibleLabel: "Flexibele optie",
  enterpriseLabel: "Enterprise-upgrade",
  enterpriseDescription: "Dezelfde warme lunch met premium toevoegingen in de weekplanning.",
  riskNote: "EU VAT/compliance review required before live provider apply.",
});

const BELGIAN_DUTCH_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "belgian_dutch_office_lunch",
  market: "BE",
  locale: "nl-BE",
  name: "Belgische kantoor lunch (NL)",
  sandwichLabel: "Broodjes",
  saladLabel: "Salades",
  warmLunchLabel: "Warme lunch",
  bowlLabel: "Bowls",
  flexibleLabel: "Flexibele optie",
  enterpriseLabel: "Enterprise-upgrade",
  enterpriseDescription: "Dezelfde warme lunch met premium toevoegingen in de weekplanning.",
  riskNote: "Belgian dual-locale rollout must coordinate nl-BE/fr-BE; EU VAT/compliance review required.",
});

const BELGIAN_FRENCH_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "belgian_french_office_lunch",
  market: "BE",
  locale: "fr-BE",
  name: "Déjeuner bureau belge (FR)",
  sandwichLabel: "Sandwichs",
  saladLabel: "Salades",
  warmLunchLabel: "Plat chaud",
  bowlLabel: "Bowls",
  flexibleLabel: "Option flexible",
  enterpriseLabel: "Upgrade Enterprise",
  enterpriseDescription: "Même plat chaud avec compléments premium dans le planning hebdomadaire.",
  riskNote: "Belgian dual-locale rollout must coordinate fr-BE/nl-BE; EU VAT/compliance review required.",
});

const AUSTRIAN_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "austrian_office_lunch",
  market: "AT",
  locale: "de-AT",
  name: "Österreichischer Bürolunch",
  sandwichLabel: "Belegte Brote",
  saladLabel: "Salate",
  warmLunchLabel: "Warme Mahlzeit",
  bowlLabel: "Bowls",
  flexibleLabel: "Flexible Option",
  enterpriseLabel: "Enterprise-Upgrade",
  enterpriseDescription: "Dieselbe warme Mahlzeit mit Premium-Ergänzungen im Wochenplan.",
  riskNote: "EU VAT/compliance review required before live provider apply.",
});

const SWISS_GERMAN_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "swiss_german_office_lunch",
  market: "CH",
  locale: "de-CH",
  name: "Schweizer Bürolunch (DE)",
  sandwichLabel: "Sandwiches",
  saladLabel: "Salate",
  warmLunchLabel: "Warme Mahlzeit",
  bowlLabel: "Bowls",
  flexibleLabel: "Flexible Option",
  enterpriseLabel: "Enterprise-Upgrade",
  enterpriseDescription: "Dieselbe warme Mahlzeit mit Premium-Ergänzungen im Wochenplan.",
  riskNote: "CHF and multilingual Swiss rollout require de-CH/fr-CH coordination.",
});

const SWISS_FRENCH_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "swiss_french_office_lunch",
  market: "CH",
  locale: "fr-CH",
  name: "Déjeuner bureau suisse (FR)",
  sandwichLabel: "Sandwichs",
  saladLabel: "Salades",
  warmLunchLabel: "Plat chaud",
  bowlLabel: "Bowls",
  flexibleLabel: "Option flexible",
  enterpriseLabel: "Upgrade Enterprise",
  enterpriseDescription: "Même plat chaud avec compléments premium dans le planning hebdomadaire.",
  riskNote: "CHF and multilingual Swiss rollout require fr-CH/de-CH coordination.",
});

const IRISH_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "irish_office_lunch",
  market: "IE",
  locale: "en-IE",
  name: "Irish office lunch",
  sandwichLabel: "Sandwiches",
  saladLabel: "Salads",
  warmLunchLabel: "Hot lunch",
  bowlLabel: "Bowls",
  flexibleLabel: "Flexible option",
  enterpriseLabel: "Enterprise upgrade",
  enterpriseDescription: "Same hot lunch with premium add-ons in the week plan.",
  riskNote: "EU VAT/compliance review required before live provider apply.",
});

const LUXEMBOURG_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "luxembourg_office_lunch",
  market: "LU",
  locale: "fr-LU",
  name: "Déjeuner bureau Luxembourg",
  sandwichLabel: "Sandwichs",
  saladLabel: "Salades",
  warmLunchLabel: "Plat chaud",
  bowlLabel: "Bowls",
  flexibleLabel: "Option flexible",
  enterpriseLabel: "Upgrade Enterprise",
  enterpriseDescription: "Même plat chaud avec compléments premium dans le planning hebdomadaire.",
  riskNote: "Small multilingual enterprise market; EU VAT/compliance review required.",
});

const POLISH_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "polish_office_lunch",
  market: "PL",
  locale: "pl-PL",
  name: "Polski lunch biurowy",
  sandwichLabel: "Kanapki",
  saladLabel: "Sałatki",
  warmLunchLabel: "Ciepły lunch",
  bowlLabel: "Bowle",
  flexibleLabel: "Opcja elastyczna",
  enterpriseLabel: "Ulepszenie Enterprise",
  enterpriseDescription: "Ten sam ciepły lunch z dodatkami premium w planie tygodnia.",
  riskNote: "EU VAT/compliance review required before live provider apply.",
});

const ROMANIAN_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "romanian_office_lunch",
  market: "RO",
  locale: "ro-RO",
  name: "Prânz de birou românesc",
  sandwichLabel: "Sandvișuri",
  saladLabel: "Salate",
  warmLunchLabel: "Prânz cald",
  bowlLabel: "Bowl-uri",
  flexibleLabel: "Opțiune flexibilă",
  enterpriseLabel: "Upgrade Enterprise",
  enterpriseDescription: "Același prânz cald cu adaosuri premium în planul săptămânal.",
  riskNote: "EU VAT/compliance review required before live provider apply.",
});

const CZECH_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "czech_office_lunch",
  market: "CZ",
  locale: "cs-CZ",
  name: "Český kancelářský oběd",
  sandwichLabel: "Sendviče",
  saladLabel: "Saláty",
  warmLunchLabel: "Teplý oběd",
  bowlLabel: "Bowly",
  flexibleLabel: "Flexibilní volba",
  enterpriseLabel: "Enterprise upgrade",
  enterpriseDescription: "Stejný teplý oběd s prémiovými doplňky v týdenním plánu.",
  riskNote: "EU VAT/compliance review required before live provider apply.",
});

const PORTUGUESE_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "portuguese_office_lunch",
  market: "PT",
  locale: "pt-PT",
  name: "Almoço de escritório português",
  sandwichLabel: "Sandes",
  saladLabel: "Saladas",
  warmLunchLabel: "Almoço quente",
  bowlLabel: "Bowls",
  flexibleLabel: "Opção flexível",
  enterpriseLabel: "Upgrade Enterprise",
  enterpriseDescription: "O mesmo almoço quente com extras premium no plano semanal.",
  riskNote: "EU VAT/compliance review required before live provider apply.",
});

const GREEK_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "greek_office_lunch",
  market: "GR",
  locale: "el-GR",
  name: "Ελληνικό γεύμα γραφείου",
  sandwichLabel: "Σάντουιτς",
  saladLabel: "Σαλάτες",
  warmLunchLabel: "Ζεστό γεύμα",
  bowlLabel: "Bowls",
  flexibleLabel: "Ευέλικτη επιλογή",
  enterpriseLabel: "Αναβάθμιση Enterprise",
  enterpriseDescription: "Το ίδιο ζεστό γεύμα με premium προσθήκες στο εβδομαδιαίο πρόγραμμα.",
  riskNote: "EU VAT/compliance review required before live provider apply.",
});

const AUSTRALIAN_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "australian_office_lunch",
  market: "AU",
  locale: "en-AU",
  name: "Australian office lunch",
  sandwichLabel: "Sandwiches",
  saladLabel: "Salads",
  warmLunchLabel: "Hot lunch",
  bowlLabel: "Bowls",
  flexibleLabel: "Flexible option",
  enterpriseLabel: "Enterprise upgrade",
  enterpriseDescription: "Same hot lunch with premium add-ons in the week plan.",
  riskNote: "GST assumptions and provider-specific timezone must be resolved before apply.",
});

const SINGAPORE_OFFICE_LUNCH = dormantPhaseDOfficeLunchProfile({
  id: "singapore_office_lunch",
  market: "SG",
  locale: "en-SG",
  name: "Singapore office lunch",
  sandwichLabel: "Sandwiches",
  saladLabel: "Salads",
  warmLunchLabel: "Hot lunch",
  bowlLabel: "Bowls",
  flexibleLabel: "Flexible option",
  enterpriseLabel: "Enterprise upgrade",
  enterpriseDescription: "Same hot lunch with premium add-ons in the week plan.",
  riskNote: "City-state SGD market; GST/commercial assumptions must be verified before apply.",
});

export const MENU_PROFILE_REGISTRY: Readonly<Record<MenuProfileId, MenuProfile>> = {
  norwegian_company_lunch: NORWEGIAN_COMPANY_LUNCH,
  swedish_lunch: SWEDISH_LUNCH,
  danish_office_lunch: DANISH_OFFICE_LUNCH,
  finnish_office_lunch: FINNISH_OFFICE_LUNCH,
  german_business_lunch: GERMAN_BUSINESS_LUNCH,
  french_dejeuner: FRENCH_DEJEUNER,
  spanish_menu_del_dia: SPANISH_MENU_DEL_DIA,
  uk_office_lunch: UK_OFFICE_LUNCH,
  italian_office_lunch: ITALIAN_OFFICE_LUNCH,
  us_office_lunch: US_OFFICE_LUNCH,
  canadian_office_lunch: CANADIAN_OFFICE_LUNCH,
  dutch_office_lunch: DUTCH_OFFICE_LUNCH,
  belgian_dutch_office_lunch: BELGIAN_DUTCH_OFFICE_LUNCH,
  belgian_french_office_lunch: BELGIAN_FRENCH_OFFICE_LUNCH,
  austrian_office_lunch: AUSTRIAN_OFFICE_LUNCH,
  swiss_german_office_lunch: SWISS_GERMAN_OFFICE_LUNCH,
  swiss_french_office_lunch: SWISS_FRENCH_OFFICE_LUNCH,
  irish_office_lunch: IRISH_OFFICE_LUNCH,
  polish_office_lunch: POLISH_OFFICE_LUNCH,
  romanian_office_lunch: ROMANIAN_OFFICE_LUNCH,
  czech_office_lunch: CZECH_OFFICE_LUNCH,
  portuguese_office_lunch: PORTUGUESE_OFFICE_LUNCH,
  greek_office_lunch: GREEK_OFFICE_LUNCH,
  luxembourg_office_lunch: LUXEMBOURG_OFFICE_LUNCH,
  australian_office_lunch: AUSTRALIAN_OFFICE_LUNCH,
  singapore_office_lunch: SINGAPORE_OFFICE_LUNCH,
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
