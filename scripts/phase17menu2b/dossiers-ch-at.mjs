import { ACCESS, P, src, price, menu } from "./helpers.mjs";

export function buildChAt() {
  const out = {};
  const blick = "https://www.blick.ch/wirtschaft/swiss-re-erhoeht-menuepreise-per-mai-was-kostet-eigentlich-ein-essen-im-personalrestaurant-id20829850.html";
  const zfv = "https://www.zfv.ch/sites/default/files/2026-05/uzh-zentrum_cateringkarte_a4_de_2026-01.pdf";
  const sv = "https://next-corpcom.sv-group.ch/de/gastronomie-schweiz/angebot/mitarbeitendenrestaurants";
  const svnews = "https://sv-group.com/de/medien/erfolgreiches-2025-fuer-sv-wachstum-neuer-markenauftritt-und-gruppenweiter";
  out.CH = {
    country_code: "CH",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "CHF",
    locales: ["de-CH", "fr-CH", "it-CH"],
    sources: [
      src(blick, "Blick Kantinen Preisvergleich", "workplace", "Blick / Swiss Re et al.", "Zürich / Switzerland (DE)", "Swiss Re Menü 19 CHF; Schnitt Personalrestaurant ~10 CHF; Trainee 12 / Lehrling 8 CHF"),
      src(zfv, "ZFV UZH Zentrum Cateringkarte 2026", "commercial", "ZFV", "Zürich (DE)", "Lunch Bon Small 11.80 / Medium 14.80 CHF; Brown Bags 11.50–16.50; Buffet mains 15.50–22.50"),
      src(sv, "SV Group Mitarbeitendenrestaurants", "commercial", "SV Group", "Switzerland (DE/FR/IT)", ">250 Unternehmensrestaurants; Free Choice Buffet / Menülinien"),
      src(svnews, "SV Group 2025 Resultate", "commercial", "SV Group", "Switzerland / Germany", "~26M Hauptmahlzeiten 2025; >60% vegetarisch/vegan Rezepte"),
      src("https://www.zfv.ch/", "ZFV Unternehmungen", "workplace", "ZFV", "Switzerland (DE)", "~180 Betriebe inkl. Business Personalrestaurants (SBB, ABB u.a.)"),
    ],
    price_observations: [
      price("CH-p01", blick, "Swiss Re", "Zürich / Adliswil (DE)", "Personalrestaurant All-you-can-combine Menü", P(19), "CHF", { tax_inclusion: "included", recurring: true, package_equivalent: "enterprise", confidence: 0.95 }),
      price("CH-p02", blick, "Swiss Re", "Zürich (DE)", "Trainee Menüpreis", P(12), "CHF", { tax_inclusion: "included", recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("CH-p03", blick, "Swiss Re", "Zürich (DE)", "Lehrlinge Menüpreis", P(8), "CHF", { tax_inclusion: "included", recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("CH-p04", blick, "Blick survey", "Switzerland", "Durchschnitt günstigstes Personalrestaurant-Menü", P(10), "CHF", { tax_inclusion: "included", recurring: true, package_equivalent: "basis", confidence: 0.85 }),
      price("CH-p05", blick, "SV Group", "Switzerland", "Menüpreisband Obergrenze Kantinen", P(25), "CHF", { tax_inclusion: "included", recurring: true, package_equivalent: "enterprise", confidence: 0.85 }),
      price("CH-p06", zfv, "ZFV UZH", "Zürich (DE)", "Lunch Bon Small Menü 1-3", P(11.8), "CHF", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.95 }),
      price("CH-p07", zfv, "ZFV UZH", "Zürich (DE)", "Lunch Bon Medium + Getränk", P(14.8), "CHF", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.95 }),
      price("CH-p08", zfv, "ZFV UZH", "Zürich (DE)", "Easy Bag sandwich lunch", P(11.5), "CHF", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.95 }),
      price("CH-p09", zfv, "ZFV UZH", "Zürich (DE)", "Regular Bag", P(12.5), "CHF", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.95 }),
      price("CH-p10", zfv, "ZFV UZH", "Zürich (DE)", "Full Bag", P(16.5), "CHF", { tax_inclusion: "included", package_equivalent: "luxus", confidence: 0.95 }),
      price("CH-p11", zfv, "ZFV UZH", "Zürich (DE)", "Nasi-Goreng Hauptspeise Buffet", P(15.5), "CHF", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.95 }),
      price("CH-p12", zfv, "ZFV UZH", "Zürich (DE)", "Stroganoff Rind Buffet", P(19.5), "CHF", { tax_inclusion: "included", package_equivalent: "luxus", confidence: 0.95 }),
      price("CH-p13", zfv, "ZFV UZH", "Zürich (DE)", "Zürcher Geschnetzeltes Kalb", P(22.5), "CHF", { tax_inclusion: "included", package_equivalent: "enterprise", confidence: 0.95 }),
      price("CH-p14", zfv, "ZFV UZH", "Zürich (DE)", "Kaffeepause Budget", P(8.5), "CHF", { tax_inclusion: "included", minimum_order: 10, confidence: 0.9 }),
      price("CH-p15", zfv, "ZFV UZH", "Zürich (DE)", "Apéro Easy package", P(14.5), "CHF", { tax_inclusion: "included", minimum_order: 10, package_equivalent: "basis", confidence: 0.9 }),
    ],
    menu_observations: [
      menu("CH-m01", blick, "Swiss Re", "Zürich (DE)", "Gegrilltes Angus-Beef / Spätzli Spargeln / thailändischer Salat (4 Theken)", "warm_meal"),
      menu("CH-m02", blick, "Swiss Re", "Zürich (DE)", "Salatbuffet + Suppe + Kaffee + Dessert inklusive", "buffet"),
      menu("CH-m03", blick, "Swiss Re", "Zürich (DE)", "Schnitzel mit Pommes (Renner)", "warm_meal"),
      menu("CH-m04", zfv, "ZFV UZH", "Zürich (DE)", "Easy Bag: Sandwich Hummus/Grillgemüse + Apfel + Mineral", "sandwich"),
      menu("CH-m05", zfv, "ZFV UZH", "Zürich (DE)", "Nasi-Goreng Asia Gemüse + Tofu/Pouletspiesschen", "warm_meal"),
      menu("CH-m06", zfv, "ZFV UZH", "Zürich (DE)", "Gehacktes mit Hörnli Apfelmus", "warm_meal"),
      menu("CH-m07", zfv, "ZFV UZH", "Zürich (DE)", "Geschnetzeltes Zürcher Art mit Rösti", "warm_meal"),
      menu("CH-m08", zfv, "ZFV UZH", "Zürich (DE)", "Menüsalat / Griechischer Salat", "salad_box"),
      menu("CH-m09", zfv, "ZFV UZH", "Zürich (DE)", "Tiramisù / Panna Cotta / Toblerone-Mousse", "premium"),
      menu("CH-m10", sv, "SV Group", "Zürich Nexus (DE)", "Free Choice Buffet + Mini Market + 4 Menülinien", "buffet"),
      menu("CH-m11", sv, "SV Group", "Genève / Lausanne area (FR)", "Campus/Unternehmensrestaurants SV (sprachregion FR)", "warm_meal", 0.7),
      menu("CH-m12", sv, "SV Group", "Ticino / Tessin (IT)", "SV Standortgastronomie (sprachregion IT)", "warm_meal", 0.65),
      menu("CH-m13", svnews, "SV Group", "Switzerland", "Über 60% vegetarische/vegane Rezepte 2025", "warm_meal", 0.75),
      menu("CH-m14", blick, "SV Group", "Switzerland", "Sparmenüs / vegetarisch / vegan / Bowls Bandbreite", "bowl", 0.75),
    ],
  };

  const wko = "https://www.wko.at/lohnverrechnung/freie-oder-verbilligte-mahlzeiten";
  const probonio = "https://probonio.at/blog/essenszuschuss-2026";
  const mittags = "https://www.mittagsmarken.com/r/essenszuschuss-oesterreich/";
  const topf = "https://topfdeckel.at/office-catering";
  const fresh = "https://freshcatering.at/mittagessen-fuer-firmen/";
  const salad = "https://www.saladjungle.at/catering-wien/";
  out.AT = {
    country_code: "AT",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "EUR",
    locales: ["de-AT"],
    sources: [
      src(wko, "WKO freie/verbilligte Mahlzeiten", "workplace", "WKO", "Austria", "Essensgutscheine steuerfrei bis 8 EUR/Arbeitstag Gaststätte; 2 EUR Lebensmittel"),
      src(probonio, "Probonio Essenszuschuss 2026", "workplace", "Probonio", "Austria", "Bis 8 EUR/Tag Mahlzeiten; 2 EUR Lebensmittel; digital"),
      src(mittags, "Mittagsmarken Essenszuschuss", "workplace", "Mittagsmarken", "Austria", "8 EUR Gaststätten / 2 EUR Lebensmittel 2026 unverändert"),
      src(topf, "Topf & Deckel Office Catering Wien", "commercial", "Topf & Deckel", "Wien", "Großes Hauptgericht 12,90 EUR; kleine Portion 8,50; Pakete ab 9,90; min 15 Portionen/Tag"),
      src(fresh, "FreshCatering Firmenlunch", "commercial", "FreshCatering", "Wien", "Lunch ab 4,49 EUR Club-Preis; Lieferungen ins Büro"),
      src(salad, "Salad Jungle Catering Wien", "commercial", "Salad Jungle", "Wien", "Wraps ~9 EUR; bowls 9–14 EUR; Meetingboxen 42–82 EUR"),
    ],
    price_observations: [
      price("AT-p01", wko, "WKO / Finanz", "Austria", "Steuerfreier Essenszuschuss Gaststätte/Tag", P(8), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.98 }),
      price("AT-p02", wko, "WKO / Finanz", "Austria", "Steuerfreier Zuschuss Lebensmittel/Tag", P(2), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.98 }),
      price("AT-p03", topf, "Topf & Deckel", "Wien", "Großes Hauptgericht Office Lunch", P(12.9), "EUR", { tax_inclusion: "unknown", delivery_included: true, minimum_order: 15, recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("AT-p04", topf, "Topf & Deckel", "Wien", "Kleine Portion Hauptgericht", P(8.5), "EUR", { tax_inclusion: "unknown", delivery_included: true, minimum_order: 15, recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("AT-p05", topf, "Topf & Deckel", "Wien", "Paketpreis ab / Person Tag", P(9.9), "EUR", { tax_inclusion: "unknown", delivery_included: true, recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("AT-p06", fresh, "FreshCatering", "Wien", "Lunch Club-Preis ab", P(4.49), "EUR", { tax_inclusion: "unknown", delivery_included: true, recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("AT-p07", salad, "Salad Jungle", "Wien", "Lunch Wrap", P(9), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.9 }),
      price("AT-p08", salad, "Salad Jungle", "Wien", "Bowl Standard ~11", P(11), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.85 }),
      price("AT-p09", salad, "Salad Jungle", "Wien", "Fish Bowl", P(14), "EUR", { tax_inclusion: "included", package_equivalent: "luxus", confidence: 0.9 }),
      price("AT-p10", salad, "Salad Jungle", "Wien", "Rainbow Cup Box (share)", P(42), "EUR", { tax_inclusion: "included", package_equivalent: "enterprise", confidence: 0.9 }),
      price("AT-p11", salad, "Salad Jungle", "Wien", "Vegan Wrap Meetingbox", P(78), "EUR", { tax_inclusion: "included", package_equivalent: "enterprise", confidence: 0.9 }),
      price("AT-p12", salad, "Salad Jungle", "Wien innere Bezirke", "Liefergebühr innere Bezirke", P(8), "EUR", { tax_inclusion: "included", delivery_included: false, confidence: 0.9 }),
      price("AT-p13", salad, "Salad Jungle", "Wien äußere Bezirke", "Liefergebühr äußere Bezirke", P(20), "EUR", { tax_inclusion: "included", delivery_included: false, confidence: 0.9 }),
      price("AT-p14", salad, "Salad Jungle", "Wien", "Single Cup snack", P(3.8), "EUR", { tax_inclusion: "included", confidence: 0.85 }),
    ],
    menu_observations: [
      menu("AT-m01", topf, "Topf & Deckel", "Wien", "Täglich frisch gekochte Office-Hauptgerichte (4 Gerichte/Tag)", "warm_meal"),
      menu("AT-m02", fresh, "FreshCatering", "Wien", "Frisch gelieferte Mittagsgerichte Bestellplattform", "warm_meal"),
      menu("AT-m03", salad, "Salad Jungle", "Wien", "Lunch Wraps", "sandwich"),
      menu("AT-m04", salad, "Salad Jungle", "Wien", "Chicken Bowls", "bowl"),
      menu("AT-m05", salad, "Salad Jungle", "Wien", "Fish Bowls", "bowl"),
      menu("AT-m06", salad, "Salad Jungle", "Wien", "Vegan Wrap Meetingbox", "sandwich"),
      menu("AT-m07", salad, "Salad Jungle", "Wien", "Tramezzini Boxes", "sandwich"),
      menu("AT-m08", salad, "Salad Jungle", "Wien", "Bagel Boxes", "sandwich"),
      menu("AT-m09", salad, "Salad Jungle", "Wien", "Warm Buffet Stations", "buffet"),
      menu("AT-m10", wko, "WKO", "Austria", "Kantine / Werksküche Mahlzeiten", "warm_meal", 0.7),
      menu("AT-m11", wko, "WKO", "Austria", "Gaststätten-Einlösung Essensgutschein", "warm_meal", 0.7),
      menu("AT-m12", mittags, "Mittagsmarken", "Austria", "Lieferservice-Einlösung Essenszuschuss", "warm_meal", 0.7),
      menu("AT-m13", "https://inbox-meal.at/", "INBOX Meal", "Wien", "Tägliche Büro-Menülieferung Kühlschrank", "warm_meal", 0.7),
    ],
  };
  out.AT.sources.push(src("https://inbox-meal.at/", "INBOX Meal Büroverpflegung", "commercial", "INBOX", "Wien", "Min. ~50 MA; Lieferung 07:30–10:30; steuerfreier Zuschuss bis 8 EUR erwähnt"));
  return out;
}
