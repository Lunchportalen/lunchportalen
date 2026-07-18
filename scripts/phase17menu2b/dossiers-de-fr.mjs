import { ACCESS, P, src, price, menu } from "./helpers.mjs";

export function buildDeFr() {
  const out = {};
  const fuhr = "https://fuhr-catering.de/wp-content/uploads/2026/01/Fuhr_Catering_Business_Catering_2026.pdf";
  const fein = "https://feinbeisser.de/wp-content/uploads/2025/05/feinbeisser_office_lunch.pdf";
  const sodexo = "https://gastrospiegel.de/news/37-branchen-news/2909-sodexo-deutschland-essverhalten-zwischen-geschmack-und-preisdruck";
  const aok = "https://www.aok.de/fk/sozialversicherung/beitraege-zur-sozialversicherung/beitragspflichtiges-entgelt-lohnarten/mahlzeiten-dienstreisen/";
  const silber = "https://www.silberloeffel-catering.de/downloads/Lunch_Buffets_2026.pdf";
  const apetito = "https://www.apetito.de/betriebe";
  out.DE = {
    country_code: "DE",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "EUR",
    locales: ["de-DE"],
    sources: [
      src(sodexo, "Sodexo/Yougov Betriebsrestaurant Preisgrenze", "workplace", "Sodexo Deutschland", "Germany", "Schmerzgrenze Mittagessen Betriebsrestaurant 6,99 EUR (Yougov Apr 2026, n=1009)"),
      src(aok, "AOK Sachbezugswerte Mahlzeiten 2026", "workplace", "AOK", "Germany", "Sachbezug Mittagessen 4,57 EUR; Essenszuschuss 3,10 EUR/Arbeitstag 2026"),
      src(fuhr, "Fuhr Catering Business Catering 2026", "commercial", "Fuhr Catering", "Germany", "Business-Menüs 13,50–15,50 EUR/Person; Suppen 9,80 EUR; min 10 Personen"),
      src(fein, "Feinbeisser Officelunch", "commercial", "Feinbeisser Event & Catering", "Hamburg", "Officelunch Hauptgericht/vegetarisch 11,90 EUR zzgl. MwSt; Beilagensalat 4,50 EUR; ab 10 Personen"),
      src(silber, "Silberlöffel Lunch Büffets 2026", "commercial", "Silberlöffel Catering", "Hamburg", "Lunch-Büffets ca. 27,90–29,90 EUR/Person zzgl. MwSt; ab 10 Personen"),
      src(apetito, "apetito Betriebsverpflegung", "commercial", "apetito", "Germany", "Betriebliche Mittagsverpflegung / Menükomponenten für Firmenkantinen"),
    ],
    price_observations: [
      price("DE-p01", sodexo, "Sodexo Deutschland", "Germany", "Betriebsrestaurant Mittagessen Akzeptanzgrenze", P(6.99), "EUR", { tax_inclusion: "unknown", recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("DE-p02", aok, "AOK / SVEV", "Germany", "Amtlicher Sachbezugswert Mittagessen 2026", P(4.57), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("DE-p03", aok, "AOK / SVEV", "Germany", "Steuerfreier Essenszuschuss 2026", P(3.1), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("DE-p04", aok, "AOK / SVEV", "Germany", "Max. steuerbegünstigter Mittagszuschuss (Sachbezug+Zuschuss)", P(7.67), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("DE-p05", aok, "AOK / SVEV", "Germany", "Sachbezug Frühstück 2026", P(2.37), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.9 }),
      price("DE-p06", fuhr, "Fuhr Catering", "Germany", "Business-Menü warm", P(15.5), "EUR", { tax_inclusion: "excluded", delivery_included: false, minimum_order: 10, package_equivalent: "luxus", confidence: 0.95 }),
      price("DE-p07", fuhr, "Fuhr Catering", "Germany", "Business-Menü Standard", P(13.5), "EUR", { tax_inclusion: "excluded", delivery_included: false, minimum_order: 10, package_equivalent: "basis", confidence: 0.95 }),
      price("DE-p08", fuhr, "Fuhr Catering", "Germany", "Vegetarische Suppe + Brötchen", P(9.8), "EUR", { tax_inclusion: "excluded", delivery_included: false, minimum_order: 10, package_equivalent: "basis", confidence: 0.95 }),
      price("DE-p09", fuhr, "Fuhr Catering", "Germany", "Ciabatta-Schnitte", P(3.8), "EUR", { tax_inclusion: "excluded", minimum_order: 8, package_equivalent: "basis", confidence: 0.9 }),
      price("DE-p10", fuhr, "Fuhr Catering", "Germany", "Hausgemachter Wrap klein", P(4.2), "EUR", { tax_inclusion: "excluded", minimum_order: 8, package_equivalent: "basis", confidence: 0.9 }),
      price("DE-p11", fein, "Feinbeisser", "Hamburg", "Officelunch Hauptgericht", P(11.9), "EUR", { tax_inclusion: "excluded", delivery_included: false, minimum_order: 10, recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("DE-p12", fein, "Feinbeisser", "Hamburg", "Officelunch vegetarisch", P(11.9), "EUR", { tax_inclusion: "excluded", delivery_included: false, minimum_order: 10, recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("DE-p13", fein, "Feinbeisser", "Hamburg", "Beilagensalat", P(4.5), "EUR", { tax_inclusion: "excluded", minimum_order: 10, confidence: 0.9 }),
      price("DE-p14", silber, "Silberlöffel Catering", "Hamburg", "Lunch Büffet N0 2", P(27.9), "EUR", { tax_inclusion: "excluded", delivery_included: false, minimum_order: 10, package_equivalent: "enterprise", confidence: 0.9 }),
      price("DE-p15", silber, "Silberlöffel Catering", "Hamburg", "Lunch Büffet N0 1", P(29.9), "EUR", { tax_inclusion: "excluded", delivery_included: false, minimum_order: 10, package_equivalent: "enterprise", confidence: 0.9 }),
    ],
    menu_observations: [
      menu("DE-m01", fuhr, "Fuhr Catering", "Germany", "Geflügelgeschnetzeltes Gyros-Art | Gemüsereis | Krautsalat", "warm_meal"),
      menu("DE-m02", fuhr, "Fuhr Catering", "Germany", "Hähnchenbrustfilet Mandelblättchen | Thymian-Rosmarin-Kartöffelchen", "warm_meal"),
      menu("DE-m03", fuhr, "Fuhr Catering", "Germany", "Schnitzel Hähnchen | Kartoffelgratin | Jägersauce", "warm_meal"),
      menu("DE-m04", fuhr, "Fuhr Catering", "Germany", "Lachsfilet | Bandnudeln | Blattspinat", "warm_meal"),
      menu("DE-m05", fuhr, "Fuhr Catering", "Germany", "Indisches Gemüsecurry Kokosmilch | Basmatireis", "warm_meal"),
      menu("DE-m06", fuhr, "Fuhr Catering", "Germany", "Lasagne Bolognese | frischer Salat", "warm_meal"),
      menu("DE-m07", fuhr, "Fuhr Catering", "Germany", "Chili sin Carne | ofenfrisches Brötchen", "warm_meal"),
      menu("DE-m08", fuhr, "Fuhr Catering", "Germany", "Blumenkohlcremesuppe | Brötchen", "soup"),
      menu("DE-m09", fuhr, "Fuhr Catering", "Germany", "Ciabatta Mozzarella | Tomaten | Basilikum-Pesto", "sandwich"),
      menu("DE-m10", fuhr, "Fuhr Catering", "Germany", "Wrap Hummus | gebratene Antipasti | Salat", "sandwich"),
      menu("DE-m11", fein, "Feinbeisser", "Hamburg", "Tages-Hauptgericht Officelunch (öko)", "warm_meal"),
      menu("DE-m12", fein, "Feinbeisser", "Hamburg", "Vegetarisches Tagesgericht Officelunch", "warm_meal"),
      menu("DE-m13", fein, "Feinbeisser", "Hamburg", "Kleiner Beilagensalat", "salad_box"),
      menu("DE-m14", sodexo, "Sodexo Deutschland", "Germany", "Betriebsrestaurant: Pizza/Snacks/Komfortgerichte", "warm_meal", 0.7),
      menu("DE-m15", apetito, "apetito", "Germany", "Menükomponenten / TK-Menüs inkl. veganer Angebote", "warm_meal", 0.75),
    ],
  };

  const jur = "https://www.juristique.org/paie/regles-tickets-restaurant-2026";
  const erisay = "https://boutique.erisay-traiteur.fr/wp-content/uploads/2026/06/erisay-brochure-plateaux-repas-ete-2026-bd.pdf";
  const ensuite = "https://www.ensuite.fr/content/64-plateaux-repas";
  const plateya = "https://www.plateya.fr/blog/detail/prix-traiteur-evenement-entreprise-paris-2026-guide-tarifs";
  const twenty = "https://twentypeas.fr/traiteur-entreprise-paris-tarifs-formules-guide/";
  const montr = "https://montraiteurfrance.fr/traiteur-dejeuner";
  out.FR = {
    country_code: "FR",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "EUR",
    locales: ["fr-FR"],
    sources: [
      src(jur, "Titres-restaurant règles 2026", "workplace", "URSSAF / Juristique", "France", "Plafond exonération part patronale 7,32 EUR; valeur faciale optimale 12,20–14,64 EUR"),
      src("https://hayot-expertise.fr/blog/tickets-restaurants-2026", "Hayot Expertise tickets restaurants 2026", "workplace", "Hayot Expertise / URSSAF", "France", "Plafond exonération 7,32 EUR; part employeur 50–60%; usage élargi GMS jusqu’au 31.12.2026"),
      src(erisay, "Érisay plateaux repas Été 2026", "commercial", "Érisay Réceptions", "France / Paris region", "Plateaux Essentiels 18 EUR HT; Bistrots chics 25 EUR HT; Prestiges 35 EUR HT; Bowls 13 EUR HT"),
      src(ensuite, "Ensuite plateaux repas entreprise", "commercial", "Ensuite Traiteur", "Paris / Île-de-France", "Sandwichs dès 12 EUR HT; livraison Paris 22 EUR HT"),
      src(plateya, "Prix traiteur événement entreprise Paris 2026", "commercial", "Plateya market guide", "Paris", "Plateau repas standard 17–22 EUR; premium 25–35 EUR; gastronomique 36–45 EUR/pers"),
      src(twenty, "Twenty Peas traiteur entreprise Paris", "commercial", "Twenty Peas", "Paris / Île-de-France", "Plateau repas 18–45 EUR; buffet déjeuner 25–60 EUR/pers"),
      src(montr, "MonTraiteurFrance déjeuner", "commercial", "MonTraiteurFrance marketplace", "Paris / Île-de-France", "Plateau classique 18–22 EUR HT; gourmet 25–32; premium 35–45"),
    ],
    price_observations: [
      price("FR-p01", jur, "URSSAF", "France", "Plafond exonération part employeur titre-restaurant 2026", P(7.32), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("FR-p02", jur, "URSSAF", "France", "Valeur faciale TR max exonération (60% employeur)", P(12.2), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("FR-p03", jur, "URSSAF", "France", "Valeur faciale TR max exonération (50% employeur)", P(14.64), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "luxus", confidence: 0.95 }),
      price("FR-p04", jur, "CNTR / règlement", "France", "Plafond d'usage quotidien titres-restaurant", P(25), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.9 }),
      price("FR-p05", erisay, "Érisay Réceptions", "France", "Plateau repas Les essentiels", P(18), "EUR", { tax_inclusion: "excluded", package_equivalent: "basis", confidence: 0.95 }),
      price("FR-p06", erisay, "Érisay Réceptions", "France", "Plateau repas Les bistrots chics", P(25), "EUR", { tax_inclusion: "excluded", package_equivalent: "luxus", confidence: 0.95 }),
      price("FR-p07", erisay, "Érisay Réceptions", "France", "Plateau repas Les prestiges", P(35), "EUR", { tax_inclusion: "excluded", package_equivalent: "enterprise", confidence: 0.95 }),
      price("FR-p08", erisay, "Érisay Réceptions", "France", "Poke / Buddha bowl", P(13), "EUR", { tax_inclusion: "excluded", package_equivalent: "basis", confidence: 0.95 }),
      price("FR-p09", ensuite, "Ensuite Traiteur", "Paris", "Formule sandwichs plateau", P(12), "EUR", { tax_inclusion: "excluded", delivery_included: false, package_equivalent: "basis", confidence: 0.9 }),
      price("FR-p10", plateya, "Paris traiteur market", "Paris", "Plateau repas standard (bande basse)", P(17), "EUR", { tax_inclusion: "unknown", package_equivalent: "basis", confidence: 0.8 }),
      price("FR-p11", plateya, "Paris traiteur market", "Paris", "Plateau repas standard (bande haute)", P(22), "EUR", { tax_inclusion: "unknown", package_equivalent: "basis", confidence: 0.8 }),
      price("FR-p12", plateya, "Paris traiteur market", "Paris", "Plateau repas premium (bande basse)", P(25), "EUR", { tax_inclusion: "unknown", package_equivalent: "luxus", confidence: 0.8 }),
      price("FR-p13", montr, "MonTraiteurFrance", "Paris / Île-de-France", "Plateau classique midpoint 18–22", P(20), "EUR", { tax_inclusion: "excluded", package_equivalent: "basis", confidence: 0.75 }),
      price("FR-p14", twenty, "Twenty Peas", "Paris", "Buffet déjeuner (bande basse)", P(25), "EUR", { tax_inclusion: "unknown", package_equivalent: "luxus", confidence: 0.75 }),
    ],
    menu_observations: [
      menu("FR-m01", erisay, "Érisay Réceptions", "France", "Essentiels avec viande (entrée+plat+dessert)", "warm_meal"),
      menu("FR-m02", erisay, "Érisay Réceptions", "France", "Essentiels avec poisson", "warm_meal"),
      menu("FR-m03", erisay, "Érisay Réceptions", "France", "Essentiels végétariens", "warm_meal"),
      menu("FR-m04", erisay, "Érisay Réceptions", "France", "Bistrots chics viande", "premium"),
      menu("FR-m05", erisay, "Érisay Réceptions", "France", "Bistrots chics poisson", "premium"),
      menu("FR-m06", erisay, "Érisay Réceptions", "France", "Bistrots chics végétariens & végans", "warm_meal"),
      menu("FR-m07", erisay, "Érisay Réceptions", "France", "Prestiges viande / poisson", "premium"),
      menu("FR-m08", erisay, "Érisay Réceptions", "France", "Poke bowls", "bowl"),
      menu("FR-m09", erisay, "Érisay Réceptions", "France", "Buddha bowls végétariens et végans", "bowl"),
      menu("FR-m10", ensuite, "Ensuite Traiteur", "Paris", "Plateaux-repas chauds et froids entreprise", "warm_meal"),
      menu("FR-m11", ensuite, "Ensuite Traiteur", "Paris", "Sandwichs traiteur bureau", "sandwich"),
      menu("FR-m12", jur, "Titre-restaurant réseau", "France", "Usage TR: restaurants, boulangeries, traiteurs, GMS denrées", "warm_meal", 0.7),
      menu("FR-m13", montr, "MonTraiteurFrance", "Paris", "Plateau entrée froide + plat + dessert + pain + eau", "warm_meal", 0.75),
      menu("FR-m14", twenty, "Twenty Peas", "Paris", "Buffet déjeunatoire équipes 15–100", "buffet", 0.75),
    ],
  };
  return out;
}
