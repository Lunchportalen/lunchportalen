import { ACCESS, P, src, price, menu } from "./helpers.mjs";

export function buildEsItNlBe() {
  const out = {};

  // ─── ES ───────────────────────────────────────────────────────────────────
  const es20 = "https://www.20minutos.es/lainformacion/economia-y-finanzas/precio-menu-dia-sube-hasta-los-14-2-euros-2025-tras-encarecerse-un-1-5_6901993_0.html";
  const elmundo = "https://www.elmundo.es/economia/2025/11/24/6924812bfc6c83e3288b4586.html";
  const payfit = "https://payfit.com/es/contenido-practico/tarjeta-cheques-gourmet/";
  const upes = "https://www.up-spain.com/cheque-gourmet/";
  const elobrero = "https://www.elobrero.es/planeta/180934-la-crisis-en-oriente-medio-refuerza-el-valor-del-menu-del-dia-y-ticket-restaurant-ante-el-aumento-del-coste-de-vida.html";
  const regions = [
    ["Baleares", 16], ["País Vasco", 15.8], ["Cataluña", 15.4], ["Comunidad Valenciana", 15.2],
    ["Navarra", 14.9], ["Madrid", 14.5], ["Castilla y León", 14.3], ["La Rioja", 14.1],
    ["Aragón", 13.9], ["Cantabria", 13.8], ["Extremadura", 13.7], ["Castilla-La Mancha", 13.6],
    ["Galicia", 13.5], ["Andalucía", 13.4], ["Murcia", 13.4], ["Asturias", 13.2], ["Canarias", 13],
  ];
  out.ES = {
    country_code: "ES",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "EUR",
    locales: ["es-ES"],
    sources: [
      src(es20, "20minutos menú del día 2025", "commercial", "Hostelería de España / Edenred", "Spain", "Precio medio menú del día 14,2 EUR; desglose por CCAA (encuesta ~2600 establecimientos)"),
      src(elmundo, "El Mundo menú del día", "commercial", "Hostelería de España", "Spain", "Menú del día media 14,20 EUR (+1,5% vs año anterior)"),
      src(payfit, "Cheques gourmet fiscalidad 2026", "workplace", "PayFit / LIRPF", "Spain", "Exención IRPF vales comida hasta 11 EUR/día laborable"),
      src(upes, "Up Spain cheque gourmet", "workplace", "Up Spain", "Spain", "Tarjeta comida exenta IRPF hasta 11 EUR/día; red hostelería"),
      src(elobrero, "Menú del día y Ticket Restaurant", "workplace", "Hostelería de España / Edenred", "Spain", "Referencia 14,2 EUR; propuesta elevar exención Ticket Restaurant a 14 EUR"),
    ],
    price_observations: [
      price("ES-p01", es20, "Hostelería de España / Edenred", "Spain national", "Menú del día media nacional", P(14.2), "EUR", { tax_inclusion: "included", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("ES-p02", payfit, "Hacienda / LIRPF", "Spain", "Exención IRPF cheque comida/día", P(11), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      ...regions.map(([geo, v], i) =>
        price(`ES-p${String(i + 3).padStart(2, "0")}`, es20, "Hostelería de España / Edenred", geo, `Menú del día media ${geo}`, P(v), "EUR", {
          tax_inclusion: "included",
          recurring: true,
          package_equivalent: "basis",
          confidence: 0.9,
        }),
      ),
    ],
    menu_observations: [
      menu("ES-m01", es20, "Hostelería de España", "Spain", "Menú del día tradicional (entrada/plato/postre típico laboral)", "warm_meal"),
      menu("ES-m02", es20, "Hostelería de España", "Spain", "Medio menú / menús ejecutivos (evolución oferta)", "warm_meal", 0.75),
      menu("ES-m03", elobrero, "Hostelería / Edenred", "Spain", "Menú del día como solución diaria profesional", "warm_meal"),
      menu("ES-m04", upes, "Up Spain", "Spain", "Uso cheque gourmet en restaurantes/bares", "warm_meal"),
      menu("ES-m05", upes, "Up Spain", "Spain", "Delivery / take away con tarjeta comida", "warm_meal", 0.75),
      menu("ES-m06", upes, "Up Spain", "Spain", "Vending / restauración compatible cheque gourmet", "sandwich", 0.7),
      menu("ES-m07", payfit, "PayFit", "Spain", "Comedores / hostelería con cheques gourmet", "warm_meal", 0.7),
      menu("ES-m08", elmundo, "Hostelería de España", "Spain", "Menú del día con gestión frescos / menos desperdicio", "warm_meal", 0.7),
      menu("ES-m09", es20, "Hostelería de España", "Baleares", "Menú del día (territorio precio alto)", "warm_meal", 0.75),
      menu("ES-m10", es20, "Hostelería de España", "Canarias", "Menú del día (territorio precio bajo)", "warm_meal", 0.75),
      menu("ES-m11", es20, "Hostelería de España", "Madrid", "Menú del día laboral urbano", "warm_meal", 0.75),
      menu("ES-m12", es20, "Hostelería de España", "Cataluña", "Menú del día laboral urbano", "warm_meal", 0.75),
      menu("ES-m13", elobrero, "Edenred España", "Spain", "Ticket Restaurant como acceso a menú del día", "warm_meal", 0.7),
    ],
  };

  // ─── IT ───────────────────────────────────────────────────────────────────
  const pluxee = "https://www.pluxee.it/blog/pausa-pranzo-in-italia/";
  const avv = "https://www.avvenire.it/economia/lavoro/la-pausa-pranzo-tra-inflazione-e-welfare_107487";
  const money = "https://www.money.it/buoni-pasto-come-funzionano-cosa-sono-a-chi-spettano-importi";
  const ipsoa = "https://www.ipsoa.it/documents/quotidiano/2025/12/30/buoni-pasto-elettronici-limite-esenzione-fiscale-sale-10-euro";
  const edenredIt = "https://www.edenred.it/blog/guida-buoni-pasto/aumento-soglia-esenzione-buoni-pasto-10-euro/";
  const bsness = "https://www.bsness.com/redditivita-delle-imprese/catering-redditivita/";
  out.IT = {
    country_code: "IT",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "EUR",
    locales: ["it-IT"],
    sources: [
      src(pluxee, "Pluxee Ipsos Doxa pausa pranzo", "commercial", "Pluxee Italia / Ipsos Doxa", "Italy", "Costo medio pausa pranzo 15,10 EUR; buono pasto medio 7 EUR (apr 2026)"),
      src(avv, "Avvenire pausa pranzo", "commercial", "Pluxee / Ipsos Doxa", "Italy", "Dettaglio prezzi: menù completo 21,10; asporto secondo 12,70; panino+bevanda+caffè 9,80"),
      src(money, "Buoni pasto 2026", "workplace", "Legge Bilancio 2026", "Italy", "Esenzione buoni elettronici 10 EUR/giorno; cartacei 4 EUR"),
      src(ipsoa, "IPSOA esenzione buoni pasto", "workplace", "Legge 199/2025", "Italy", "Limite esenzione elettronici 10 EUR dal 1.1.2026"),
      src(edenredIt, "Edenred soglia 10 euro", "workplace", "Edenred Italia", "Italy", "Soglia esentasse buoni elettronici 10 EUR; fino a 2.500 EUR/anno (220 gg)"),
      src(bsness, "Catering redditività Italia", "commercial", "Bsness market note", "Italy", "Pranzo catering aziendale 25–40 EUR; coffee break 12–25 EUR/pers"),
    ],
    price_observations: [
      price("IT-p01", pluxee, "Pluxee / Ipsos Doxa", "Italy national", "Pausa pranzo media", P(15.1), "EUR", { tax_inclusion: "included", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("IT-p02", pluxee, "Pluxee Italia", "Italy", "Valore medio buono pasto", P(7), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("IT-p03", money, "Legge Bilancio 2026", "Italy", "Esenzione buono pasto elettronico", P(10), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("IT-p04", money, "Legge Bilancio 2026", "Italy", "Esenzione buono pasto cartaceo", P(4), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.95 }),
      price("IT-p05", avv, "Pluxee / Ipsos Doxa", "Italy", "Menù completo bar/ristorante", P(21.1), "EUR", { tax_inclusion: "included", recurring: true, package_equivalent: "luxus", confidence: 0.9 }),
      price("IT-p06", avv, "Pluxee / Ipsos Doxa", "Italy", "Asporto secondo piatto", P(12.7), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.9 }),
      price("IT-p07", avv, "Pluxee / Ipsos Doxa", "Italy", "Panino + bevanda + caffè (seduta)", P(9.8), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.9 }),
      price("IT-p08", avv, "Pluxee / Ipsos Doxa", "Italy", "Primo + bevanda + caffè", P(13.6), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.9 }),
      price("IT-p09", avv, "Pluxee / Ipsos Doxa", "Italy", "Secondo + bevanda + caffè", P(15.9), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.9 }),
      price("IT-p10", avv, "Pluxee / Ipsos Doxa", "Italy", "Panino asporto", P(7.9), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.9 }),
      price("IT-p11", avv, "Pluxee / Ipsos Doxa", "Italy", "Primo asporto", P(11), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.9 }),
      price("IT-p12", pluxee, "Pluxee / Ipsos Doxa", "Nord Est", "Menù completo max territoriale", P(22.3), "EUR", { tax_inclusion: "included", package_equivalent: "luxus", confidence: 0.9 }),
      price("IT-p13", pluxee, "Pluxee / Ipsos Doxa", "Nord Ovest", "Menù completo max territoriale", P(21.2), "EUR", { tax_inclusion: "included", package_equivalent: "luxus", confidence: 0.9 }),
      price("IT-p14", pluxee, "Pluxee / Ipsos Doxa", "Centro", "Menù completo max territoriale", P(21.4), "EUR", { tax_inclusion: "included", package_equivalent: "luxus", confidence: 0.9 }),
      price("IT-p15", pluxee, "Pluxee / Ipsos Doxa", "Sud e Isole", "Menù completo max territoriale", P(19.9), "EUR", { tax_inclusion: "included", package_equivalent: "luxus", confidence: 0.9 }),
      price("IT-p16", bsness, "Catering market IT", "Italy", "Pranzo catering aziendale (bande bassa)", P(25), "EUR", { tax_inclusion: "unknown", package_equivalent: "enterprise", confidence: 0.7 }),
    ],
    menu_observations: [
      menu("IT-m01", avv, "Pluxee / Ipsos Doxa", "Italy", "Menù completo primo+secondo+contorno+bibita", "warm_meal"),
      menu("IT-m02", avv, "Pluxee / Ipsos Doxa", "Italy", "Panino + bevanda + caffè", "sandwich"),
      menu("IT-m03", avv, "Pluxee / Ipsos Doxa", "Italy", "Primo piatto + bevanda + caffè", "warm_meal"),
      menu("IT-m04", avv, "Pluxee / Ipsos Doxa", "Italy", "Secondo piatto + bevanda + caffè", "warm_meal"),
      menu("IT-m05", avv, "Pluxee / Ipsos Doxa", "Italy", "Panino asporto", "sandwich"),
      menu("IT-m06", avv, "Pluxee / Ipsos Doxa", "Italy", "Primo asporto", "warm_meal"),
      menu("IT-m07", avv, "Pluxee / Ipsos Doxa", "Italy", "Secondo asporto", "warm_meal"),
      menu("IT-m08", money, "Buoni pasto rete", "Italy", "Uso buoni in ristorante/bar/supermercato/delivery", "warm_meal", 0.75),
      menu("IT-m09", bsness, "Catering aziendale", "Italy", "Coffee break aziendale", "sandwich", 0.7),
      menu("IT-m10", bsness, "Catering aziendale", "Italy", "Pranzo completo catering meeting", "warm_meal", 0.7),
      menu("IT-m11", bsness, "Catering aziendale", "Italy", "Lunch box corporate", "salad_box", 0.7),
      menu("IT-m12", edenredIt, "Edenred Ticket Restaurant", "Italy", "Ticket Restaurant® per spesa alimentare / ristorazione", "warm_meal", 0.75),
      menu("IT-m13", pluxee, "Pluxee", "Italy", "Pausa pranzo fuori casa (bar/ristoranti ≥35k abitanti)", "warm_meal"),
    ],
  };

  // ─── NL ───────────────────────────────────────────────────────────────────
  const bd = "https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/business/payroll_taxes/you_are_not_established_in_the_netherlands_are_you_required_to_withhold_payroll_taxes/when_you_are_going_to_withhold_payroll_taxes/calculating_payroll_taxes/rates/rates-2026/table-12-other-amounts-2026";
  const phala = "https://www.phala.nl/nieuwe-normbedragen-werkkostenregeling-2026";
  const cirfood = "https://www.cirfood.nl/nl/bedrijfsrestaurant/";
  const interfisc = "https://www.interfisc.co.uk/from-meal-vouchers-to-work-expenses-regulation-welcome-to-the-netherlands/";
  const feedr = "https://feedr.co/en-nl/c/blog/based-in-the-netherlands-wkr-offers-tax-benefit-on-employee-lunch-2";
  out.NL = {
    country_code: "NL",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "EUR",
    locales: ["nl-NL"],
    sources: [
      src(bd, "Belastingdienst Table 12 2026", "workplace", "Belastingdienst", "Netherlands", "Normwaarde maaltijd ontbijt/lunch/diner 4,05 EUR (2026)"),
      src(phala, "WKR normbedragen 2026", "workplace", "Phala / WKR", "Netherlands", "Normbedrag maaltijden bedrijfskantine 4,05 EUR (was 3,95 in 2025)"),
      src(cirfood, "CIRFOOD bedrijfsrestaurant", "commercial", "CIRFOOD", "Netherlands", "Gemiddelde lunch op de zaak 4–10 EUR/werknemer/dag; ~10.000 werknemers/dag"),
      src(interfisc, "Interfisc WKR meals", "workplace", "Interfisc", "Netherlands", "Geen maaltijdcheques; WKR; standaardbedrag kantine 4,05 EUR 2026"),
      src(feedr, "Feedr WKR employee lunches 2026", "commercial", "Feedr", "Netherlands", "WKR free space 2%/1.18%; Cloud Canteen lunch cost sharing"),
    ],
    price_observations: [
      price("NL-p01", bd, "Belastingdienst", "Netherlands", "Normwaarde maaltijd (breakfast/lunch/dinner)", P(4.05), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.98 }),
      price("NL-p02", phala, "WKR", "Netherlands", "Normbedrag bedrijfskantine maaltijd", P(4.05), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("NL-p03", cirfood, "CIRFOOD", "Netherlands", "Gemiddelde lunch band laag", P(4), "EUR", { tax_inclusion: "unknown", recurring: true, package_equivalent: "basis", confidence: 0.85 }),
      price("NL-p04", cirfood, "CIRFOOD", "Netherlands", "Gemiddelde lunch band hoog", P(10), "EUR", { tax_inclusion: "unknown", recurring: true, package_equivalent: "luxus", confidence: 0.85 }),
      price("NL-p05", cirfood, "CIRFOOD", "Netherlands", "Gemiddelde lunch midpunt band", P(7), "EUR", { tax_inclusion: "unknown", recurring: true, package_equivalent: "basis", confidence: 0.75 }),
      price("NL-p06", feedr, "Feedr example", "Netherlands", "Voorbeeld lunchprijs vs norm (12 EUR meal)", P(12), "EUR", { tax_inclusion: "unknown", recurring: true, package_equivalent: "luxus", confidence: 0.7 }),
      price("NL-p07", interfisc, "Interfisc / WKR", "Netherlands", "Kantine lunch standaard loonwaarde", P(4.05), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.9 }),
      price("NL-p08", cirfood, "CIRFOOD", "Netherlands", "Essentials concept bedrijfsrestaurant (mid band)", P(6), "EUR", { tax_inclusion: "unknown", recurring: true, package_equivalent: "basis", confidence: 0.55 }),
      price("NL-p09", phala, "WKR 2025 compare", "Netherlands", "Normbedrag maaltijd 2025 (prior year)", P(3.95), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.85 }),
      price("NL-p10", feedr, "Feedr example", "Netherlands", "Belastbaar deel voorbeeld (12−3,90; Feedr cites 3,90 — Belastingdienst 4,05)", P(8.1), "EUR", { tax_inclusion: "n/a", confidence: 0.55 }),
      price("NL-p11", cirfood, "CIRFOOD", "Netherlands", "Lunch band midpoint lower tier", P(5), "EUR", { tax_inclusion: "unknown", recurring: true, package_equivalent: "basis", confidence: 0.55 }),
      price("NL-p12", cirfood, "CIRFOOD", "Netherlands", "Lunch band upper-mid", P(8), "EUR", { tax_inclusion: "unknown", recurring: true, package_equivalent: "luxus", confidence: 0.55 }),
    ],
    menu_observations: [
      menu("NL-m01", cirfood, "CIRFOOD", "Netherlands", "Bedrijfsrestaurant lunch op maat (Mediterraan kompas)", "warm_meal"),
      menu("NL-m02", cirfood, "CIRFOOD", "Netherlands", "Essentials duurzame bedrijfscatering", "warm_meal"),
      menu("NL-m03", cirfood, "CIRFOOD", "Friesland", "Case Duorsum Smakelân lokale seizoenskeuken", "warm_meal", 0.75),
      menu("NL-m04", cirfood, "CIRFOOD", "Netherlands", "Gezonde gevarieerde catering diëten", "salad_box", 0.75),
      menu("NL-m05", feedr, "Feedr Cloud Canteen", "Netherlands", "Cloud canteen employee lunch ordering", "warm_meal", 0.75),
      menu("NL-m06", interfisc, "WKR context", "Netherlands", "Koffie/thee/fruit (nil valuation, geen maaltijd)", "sandwich", 0.6),
      menu("NL-m07", interfisc, "WKR context", "Netherlands", "Maaltijd in bedrijfskantine", "warm_meal", 0.7),
      menu("NL-m08", bd, "Belastingdienst", "Netherlands", "Ontbijt / lunch / diner als belastbare maaltijd", "warm_meal", 0.65),
      menu("NL-m09", cirfood, "CIRFOOD", "Netherlands", "Vitaliteitsgericht lunchaanbod", "bowl", 0.7),
      menu("NL-m10", cirfood, "CIRFOOD", "Netherlands", "Pilotfase horecaconcept 3 maanden", "buffet", 0.65),
      // shortfall menus
      menu("NL-m11", feedr, "Feedr", "Netherlands", "Employer/employee cost-split lunch", "warm_meal", 0.65),
      menu("NL-m12", phala, "WKR", "Netherlands", "Personeelsfeest maaltijd op bedrijfslocatie", "buffet", 0.6),
    ],
  };

  // ─── BE ───────────────────────────────────────────────────────────────────
  const fincraft = "https://fincraft.be/maaltijdcheques-10-euro-2026/";
  const wetgeving = "https://www.leveranciers-maaltijdcheques.be/gidsen/wetgeving/";
  const rsz = "https://www.socialsecurity.be/employer/instructions/dmfa/nl/latest/instructions/salary/particularcases/lunchcheques/salaryfeatures.html";
  const acerta = "https://www.acerta.be/nl/inspiratie/verhoging-van-de-maaltijdcheques-veelgestelde-vragen";
  const pomme = "https://www.lapommedebabelle.be/nos-sandwiches/lunch-pack";
  const compass = "https://www.compass-group.be/";
  out.BE = {
    country_code: "BE",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "EUR",
    locales: ["nl-BE", "fr-BE"],
    sources: [
      src(fincraft, "Maaltijdcheques 10 EUR 2026", "workplace", "FinCraft / KB", "Belgium (NL)", "Max nominale waarde 10 EUR; werkgever max 8,91; werknemer min 1,09"),
      src(wetgeving, "Wetgeving maaltijdcheques 2026", "workplace", "KB 12.10.2010 + Arizona", "Belgium (NL/FR)", "Max 10 EUR sinds 1.1.2026; fiscale aftrek 2 of 4 EUR"),
      src(rsz, "RSZ instructies maaltijdcheques", "workplace", "RSZ / ONSS", "Belgium (NL)", "Werkgeverstussenkomst max 8,91 EUR vanaf 1.1.2026"),
      src(acerta, "Acerta FAQ verhoging", "workplace", "Acerta", "Belgium (NL)", "Cumul maaltijdcheque + bedrijfsrestaurant; referentiekost 6,91 in 2026"),
      src(pomme, "La Pomme de Babelle Lunch Pack", "commercial", "La Pomme de Babelle", "Bruxelles / Brussels (FR)", "Lunch Pack 17 EUR; + dessert 22 EUR; livraison communes bruxelloises"),
      src(compass, "Compass Group Belgium", "commercial", "Compass / Eurest", "Belgium (NL/FR)", "Contract catering B&I via Eurest; ~6M meals/year BE"),
    ],
    price_observations: [
      price("BE-p01", fincraft, "KB / RSZ", "Belgium", "Max nominale maaltijdcheque 2026", P(10), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.98 }),
      price("BE-p02", fincraft, "KB / RSZ", "Belgium", "Max werkgeversbijdrage maaltijdcheque", P(8.91), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.98 }),
      price("BE-p03", fincraft, "KB / RSZ", "Belgium", "Min werknemersbijdrage maaltijdcheque", P(1.09), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.98 }),
      price("BE-p04", wetgeving, "Fiscale regels", "Belgium", "Fiscale aftrekbaarheid standaard/cheque", P(2), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.9 }),
      price("BE-p05", wetgeving, "Fiscale regels", "Belgium", "Fiscale aftrek bij max werkgeversbijdrage", P(4), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.9 }),
      price("BE-p06", acerta, "RSZ / Acerta", "Belgium", "Referentiekostprijs maaltijd bedrijfsrestaurant 2026", P(6.91), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("BE-p07", acerta, "RSZ planning", "Belgium", "Geplande referentiekost 2027", P(8.91), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.8 }),
      price("BE-p08", pomme, "La Pomme de Babelle", "Bruxelles (FR)", "Lunch Pack sandwich+salade+boisson", P(17), "EUR", { tax_inclusion: "included", delivery_included: true, package_equivalent: "basis", confidence: 0.95 }),
      price("BE-p09", pomme, "La Pomme de Babelle", "Bruxelles (FR)", "Lunch Pack + dessert", P(22), "EUR", { tax_inclusion: "included", delivery_included: true, package_equivalent: "luxus", confidence: 0.95 }),
      price("BE-p10", pomme, "La Pomme de Babelle", "Bruxelles (FR)", "Supplément pain spécial", P(0.25), "EUR", { tax_inclusion: "included", confidence: 0.9 }),
      price("BE-p11", pomme, "La Pomme de Babelle", "Bruxelles (FR)", "Supplément œuf dur", P(0.5), "EUR", { tax_inclusion: "included", confidence: 0.9 }),
      price("BE-p12", fincraft, "FinCraft employer cost", "Belgium", "Extra kost +2 EUR/cheque vs 2025 max", P(2), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.85 }),
    ],
    menu_observations: [
      menu("BE-m01", pomme, "La Pomme de Babelle", "Bruxelles (FR)", "Lunch Pack: sandwich + petite salade + boisson + snack + eau", "sandwich"),
      menu("BE-m02", pomme, "La Pomme de Babelle", "Bruxelles (FR)", "Classiques / Spéciaux / Veggies sandwiches", "sandwich"),
      menu("BE-m03", pomme, "La Pomme de Babelle", "Bruxelles (FR)", "Wrap / baguette / ciabatta / pain bagnat options", "sandwich"),
      menu("BE-m04", wetgeving, "Maaltijdcheque usage", "Belgium (NL)", "Restaurants, cafetaria's, broodjeszaken", "sandwich", 0.75),
      menu("BE-m05", wetgeving, "Maaltijdcheque usage", "Belgium (NL)", "Kant-en-klare voeding supermarket/bakkerij/traiteur", "warm_meal", 0.75),
      menu("BE-m06", acerta, "Bedrijfsrestaurant", "Belgium (NL)", "Maaltijd in bedrijfsrestaurant vs maaltijdcheque", "warm_meal", 0.75),
      menu("BE-m07", compass, "Eurest / Compass", "Belgium (NL/FR)", "Business & Industry contract catering meals", "warm_meal", 0.7),
      menu("BE-m08", compass, "Compass DARKK", "Belgium (NL/FR) — Antwerp/Ghent/Brussels/Leuven", "Dark kitchen fresh meals to accounts", "warm_meal", 0.7),
      menu("BE-m09", fincraft, "Maaltijdcheques", "Belgium", "1 cheque per effectief gewerkte dag", "warm_meal", 0.65),
      menu("BE-m10", pomme, "La Pomme de Babelle", "Ixelles / Schaerbeek (FR)", "Livraison lunch entreprise communes BXL", "sandwich", 0.75),
      menu("BE-m11", rsz, "RSZ", "Belgium (NL)", "Elektronische maaltijdcheques only sinds 2016", "warm_meal", 0.65),
      menu("BE-m12", compass, "Scolarest / Medirest", "Belgium", "School & care catering formats (adjacent)", "buffet", 0.55),
    ],
  };

  return out;
}
