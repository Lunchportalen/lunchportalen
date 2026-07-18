import { ACCESS, P, src, price, menu } from "./helpers.mjs";

export function buildPlRoCzPtGr() {
  const out = {};

  // ─── PL ───────────────────────────────────────────────────────────────────
  const stare = "https://starekinoevents.pl/ile-kosztuje-catering-firmowy-ceny-i-wycena/";
  const cena = "https://cenauslug.pl/przewodnik/catering-dla-firm";
  const chandon = "https://chandonwaller.pl/benefit-zywieniowy-2025-rozliczenie-benefity/";
  const bi = "https://businessinsider.com.pl/finanse/karta-lunchowa-jako-benefit-pracowniczy-jak-firmy-moga-wspierac-pracownikow-i/eckb13c";
  const handex = "https://www.handelextra.pl/prawo/news/zmiany-zus-zatwierdzil-standardy-branzowe-dotyczace-korzystania-z-kart-zywieniowych-276578";
  out.PL = {
    country_code: "PL",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "PLN",
    locales: ["pl-PL"],
    sources: [
      src(stare, "Stare Kino Events catering firmowy", "commercial", "Stare Kino Events", "Łódź / Poland", "Lunch box 40–70 PLN; lunch bufet 55–95; śniadanie 35–65; kawa 25–70"),
      src(cena, "Cennik catering dla firm 2026", "commercial", "cenaUslug.pl", "Poland", "Dostawa lunch boxu ~38 PLN; catering lunchowy bufet ~75 PLN"),
      src(chandon, "Benefit żywieniowy ZUS", "workplace", "Chandon Waller", "Poland", "Limit zwolnienia ZUS do 450 PLN/mies. na posiłki"),
      src(bi, "Edenred karta lunchowa", "workplace", "Edenred Polska", "Poland", "450 PLN/mies. bez składek ZUS; karta w >55 tys. punktów"),
      src(handex, "ZUS standardy kart żywieniowych", "workplace", "ZUS / Pluxee", "Poland", "Karty żywieniowe tylko w sieci partnerskiej MID/MCC"),
    ],
    price_observations: [
      price("PL-p01", chandon, "ZUS", "Poland", "Miesięczny limit zwolnienia ZUS na posiłki", P(450), "PLN", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("PL-p02", stare, "Stare Kino Events", "Poland", "Lunch box (pasmo niskie)", P(40), "PLN", { tax_inclusion: "unknown", package_equivalent: "basis", confidence: 0.85 }),
      price("PL-p03", stare, "Stare Kino Events", "Poland", "Lunch box (pasmo wysokie)", P(70), "PLN", { tax_inclusion: "unknown", package_equivalent: "luxus", confidence: 0.85 }),
      price("PL-p04", stare, "Stare Kino Events", "Poland", "Lunch bufet (pasmo niskie)", P(55), "PLN", { tax_inclusion: "unknown", package_equivalent: "basis", confidence: 0.85 }),
      price("PL-p05", stare, "Stare Kino Events", "Poland", "Lunch bufet (pasmo wysokie)", P(95), "PLN", { tax_inclusion: "unknown", package_equivalent: "enterprise", confidence: 0.85 }),
      price("PL-p06", stare, "Stare Kino Events", "Poland", "Śniadanie firmowe (pasmo niskie)", P(35), "PLN", { tax_inclusion: "unknown", confidence: 0.85 }),
      price("PL-p07", stare, "Stare Kino Events", "Poland", "Śniadanie firmowe (pasmo wysokie)", P(65), "PLN", { tax_inclusion: "unknown", confidence: 0.85 }),
      price("PL-p08", stare, "Stare Kino Events", "Poland", "Przerwa kawowa podstawowa (niski)", P(25), "PLN", { tax_inclusion: "unknown", confidence: 0.85 }),
      price("PL-p09", stare, "Stare Kino Events", "Poland", "Przerwa kawowa rozszerzona (wysoki)", P(70), "PLN", { tax_inclusion: "unknown", confidence: 0.8 }),
      price("PL-p10", cena, "cenaUslug.pl", "Poland", "Dostawa lunch boxu dla pracownika", P(38), "PLN", { tax_inclusion: "unknown", delivery_included: true, package_equivalent: "basis", confidence: 0.8 }),
      price("PL-p11", cena, "cenaUslug.pl", "Poland", "Catering lunchowy bufet", P(75), "PLN", { tax_inclusion: "unknown", package_equivalent: "luxus", confidence: 0.8 }),
      price("PL-p12", bi, "Edenred Polska", "Poland", "Efektywna kwota karty przy limicie 450 (netto wykorzystanie przykład 396)", P(396), "PLN", { tax_inclusion: "n/a", recurring: true, confidence: 0.75 }),
      price("PL-p13", stare, "Stare Kino Events", "Poland", "Finger food zimny bufet (niski)", P(60), "PLN", { tax_inclusion: "unknown", package_equivalent: "luxus", confidence: 0.8 }),
    ],
    menu_observations: [
      menu("PL-m01", stare, "Stare Kino Events", "Poland", "Lunch box do biura", "salad_box"),
      menu("PL-m02", stare, "Stare Kino Events", "Poland", "Lunch w formie bufetu", "buffet"),
      menu("PL-m03", stare, "Stare Kino Events", "Poland", "Śniadanie firmowe", "sandwich"),
      menu("PL-m04", stare, "Stare Kino Events", "Poland", "Przerwa kawowa z poczęstunkiem", "sandwich"),
      menu("PL-m05", stare, "Stare Kino Events", "Poland", "Finger food / zimny bufet", "buffet"),
      menu("PL-m06", cena, "Catering firmowy", "Poland", "Lunch box dostawa pracownik", "salad_box"),
      menu("PL-m07", bi, "Edenred", "Poland", "Gastronomia / piekarnie / bary z kartą lunchową", "warm_meal", 0.75),
      menu("PL-m08", bi, "Edenred", "Poland", "Zamawianie jedzenia online kartą", "warm_meal", 0.7),
      menu("PL-m09", chandon, "Benefit żywieniowy", "Poland", "Catering / stołówka / owoce w biurze", "warm_meal", 0.7),
      menu("PL-m10", chandon, "Benefit żywieniowy", "Poland", "Bony do restauracji lub sklepów spożywczych", "warm_meal", 0.7),
      menu("PL-m11", handex, "Pluxee Lunch", "Poland", "Karta żywieniowa sieć partnerska", "warm_meal", 0.7),
      menu("PL-m12", stare, "Stare Kino Events", "Łódź", "Serwis konferencyjny szkolenie całodniowe", "buffet", 0.7),
    ],
  };

  // ─── RO ───────────────────────────────────────────────────────────────────
  const calc = "https://calculatorfiscal.ro/blog/tichete-de-masa-2026";
  const csid = "https://www.csid.ro/stiri/tichete-de-masa-2026-cine-mai-primeste-in-acest-an-si-care-e-valoarea-lor-legea-s-a-schimbat-la-finalul-lui-2025-21057204/";
  const folos = "https://folositor.ro/ghid/bonuri-masa-tichete-valoare";
  const protv = "https://stirileprotv.ro/divers/tichete-de-masa-cat-valoreaza-si-cine-le-primeste-in-2026.html";
  const ziar = "https://www.ziarulprofit.ro/tichete-de-masa-2026-s-a-aprobat-in-guvern-cine-sunt-bugetarii-care-mai-primesc-bonuri-in-acest-an/";
  out.RO = {
    country_code: "RO",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "RON",
    locales: ["ro-RO"],
    sources: [
      src(calc, "Tichete de masă 2026 calculator", "workplace", "Legea 201/2025", "Romania", "Valoare maximă 45 RON/zi lucrătoare"),
      src(csid, "CSID tichete masă 2026", "workplace", "Legea 201/2025", "Romania", "Plafon 45 lei; aplicabil pe parcursul 2026"),
      src(folos, "Folositor.ro bonuri masă", "workplace", "Legea 165/2018 + 201/2025", "Romania", "45 lei/tichet; CASS 10% reținut; max ~990 lei/lună la 22 zile"),
      src(protv, "ProTV tichete masă", "workplace", "Legea 201/2025", "Romania", "Support electronic; supermarket/restaurante/cantine"),
      src("https://alacatering.ro/meniuri/meniu-office/", "à la Catering Meniu Office", "commercial", "à la Catering", "București / Ilfov", "Meniu complet de la 30 lei/pers: ciorbă+fel principal+salată+pâine; meniu zilnic birou"),
      src("https://bucateperoate.ro/", "Bucate pe Roate catering", "commercial", "Bucate pe Roate", "București", "Business lunch / platouri corporate (ex. sandwich focaccia 128 lei/platou)"),
    ],
    price_observations: [
      price("RO-p01", calc, "Legea 201/2025", "Romania", "Valoare maximă tichet de masă/zi", P(45), "RON", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.98 }),
      price("RO-p02", calc, "Calculator fiscal", "Romania", "Max lunar ~21 zile", P(945), "RON", { tax_inclusion: "n/a", recurring: true, confidence: 0.9 }),
      price("RO-p03", folos, "Folositor.ro", "Romania", "Max lunar 22 zile", P(990), "RON", { tax_inclusion: "n/a", recurring: true, confidence: 0.9 }),
      price("RO-p04", folos, "Folositor.ro", "Romania", "Net după CASS 10% pe tichet 45", P(40.5), "RON", { tax_inclusion: "n/a", recurring: true, confidence: 0.85 }),
      price("RO-p05", folos, "Angajator exemplu", "Romania", "Tichet angajator 30 RON × 22", P(660), "RON", { tax_inclusion: "n/a", recurring: true, confidence: 0.8 }),
      price("RO-p06", folos, "Angajator exemplu", "Romania", "Tichet angajator 20 RON × 22", P(440), "RON", { tax_inclusion: "n/a", recurring: true, confidence: 0.8 }),
      price("RO-p07", csid, "Legea 201/2025", "Romania", "Plafon anterior 40,18 RON (context)", P(40.18), "RON", { tax_inclusion: "n/a", confidence: 0.85 }),
      price("RO-p08", "https://alacatering.ro/meniuri/meniu-office/", "à la Catering", "București / Ilfov", "Meniu office complet de la", P(30), "RON", { tax_inclusion: "unknown", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("RO-p09", "https://bucateperoate.ro/", "Bucate pe Roate", "București", "Platou sandwich focaccia", P(128), "RON", { tax_inclusion: "unknown", package_equivalent: "luxus", confidence: 0.9 }),
      price("RO-p10", "https://bucateperoate.ro/", "Bucate pe Roate", "București", "Platou bruschete", P(118), "RON", { tax_inclusion: "unknown", confidence: 0.9 }),
      price("RO-p11", "https://bucateperoate.ro/", "Bucate pe Roate", "București", "Platou pachetele vegane", P(76), "RON", { tax_inclusion: "unknown", confidence: 0.9 }),
      price("RO-p12", "https://bucateperoate.ro/", "Bucate pe Roate", "București", "Platou cald finger food", P(206), "RON", { tax_inclusion: "unknown", package_equivalent: "enterprise", confidence: 0.9 }),
      price("RO-p13", protv, "Lege", "Romania", "Valoare nominală maximă zilnică", P(45), "RON", { tax_inclusion: "n/a", recurring: true, confidence: 0.9 }),
    ],
    menu_observations: [
      menu("RO-m01", "https://alacatering.ro/meniuri/meniu-office/", "à la Catering", "București", "Ciorbă/supă + fel principal + salată + pâine (meniu complet)", "warm_meal"),
      menu("RO-m02", "https://alacatering.ro/meniuri/meniu-office/", "à la Catering", "București", "Shaorma cu cartofi / aripioare pui / chifteluțe legume (luni)", "warm_meal"),
      menu("RO-m03", "https://alacatering.ro/meniuri/meniu-office/", "à la Catering", "București", "Gulyas de vită cu mămăliguță / pizza (marți)", "warm_meal"),
      menu("RO-m04", "https://alacatering.ro/meniuri/meniu-office/", "à la Catering", "București", "Șnițel de pui cu piure / iahnie de fasole (miercuri)", "warm_meal"),
      menu("RO-m05", "https://alacatering.ro/meniuri/meniu-office/", "à la Catering", "București", "Friptură porc / piept pui sos cașcaval (joi)", "warm_meal"),
      menu("RO-m06", "https://alacatering.ro/meniuri/meniu-office/", "à la Catering", "București", "Paste: spaghetti aglio olio / penne prosciutto / boscaiola", "warm_meal"),
      menu("RO-m07", "https://alacatering.ro/meniuri/meniu-office/", "à la Catering", "București", "Salate starter: vinete pane / siciliană / bulgărească", "salad_box"),
      menu("RO-m08", "https://bucateperoate.ro/", "Bucate pe Roate", "București", "Business lunch / coffee break corporate", "warm_meal"),
      menu("RO-m09", "https://bucateperoate.ro/", "Bucate pe Roate", "București", "Platou sandwich focaccia", "sandwich"),
      menu("RO-m10", calc, "Tichete rețea", "Romania", "Restaurante / cantine / supermarket cu tichete", "warm_meal", 0.75),
      menu("RO-m11", protv, "Tichete", "Romania", "Aplicații de livrare partenere", "warm_meal", 0.7),
      menu("RO-m12", ziar, "Tichete", "Romania", "Cantine-restaurant / bufete", "buffet", 0.7),
    ],
  };

  // ─── CZ ───────────────────────────────────────────────────────────────────
  const kurzy = "https://zpravy.kurzy.cz/842885-optimalni-hodnota-stravenky-vzrostla-v-roce-2026-na-235-korun-navysovani-prispevku-nahravaji-ceny/";
  const positiv = "https://positiv.cz/hr-a-kariera/nabor-a-benefity/nejvyhodnejsi-stravenka-pro-rok-2026-ma-hodnotu-235-korun-firmy-jeji-potencial-stale-nevyuzivaji/";
  const upcz = "https://www.upcz.cz/optimalni-hodnota-stravenky-pro-rok-2026-je-235-kc/";
  const estr = "https://www.estravenka.cz/idealni-hodnota-stravenky-pro-rok-2026/";
  const csob = "https://www.pruvodcepodnikanim.cz/clanek/stravovani-zamestnancu/";
  out.CZ = {
    country_code: "CZ",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "CZK",
    locales: ["cs-CZ"],
    sources: [
      src(kurzy, "Kurzy.cz stravenka 2026", "workplace", "MPSV / Pluxee", "Czechia", "Optimální stravenka 235 Kč; příspěvek zaměstnavatele 129,50 Kč"),
      src(positiv, "POSITIV stravenka 2026", "economics", "Pluxee market data", "Czechia", "Průměr obědového menu ~200 Kč; dražší regiony 212–215 Kč"),
      src(upcz, "Up Benefity stravenka", "workplace", "Up Benefity", "Czechia", "Optimální hodnota 235 Kč; eStravenka síť"),
      src(estr, "eStravenka ideální hodnota", "commercial", "eStravenka / Up", "Czechia", "Polední menu nad 200 Kč; ČSÚ stravování +4–5% 2025"),
      src(csob, "ČSOB stravování 2026", "workplace", "ČSOB / zákon o daních", "Czechia", "Osvobození příspěvku do 129,50 Kč; stravné horní 185 Kč"),
    ],
    price_observations: [
      price("CZ-p01", kurzy, "MPSV model", "Czechia", "Optimální nominální hodnota stravenky", P(235), "CZK", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.95 }),
      price("CZ-p02", kurzy, "MPSV", "Czechia", "Daňově osvobozený příspěvek zaměstnavatele (70% stravného)", P(129.5), "CZK", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.98 }),
      price("CZ-p03", kurzy, "Model 55/45", "Czechia", "Podíl zaměstnance na stravence 235", P(105.5), "CZK", { tax_inclusion: "n/a", recurring: true, confidence: 0.95 }),
      price("CZ-p04", csob, "MPSV", "Czechia", "Horní hranice stravného 5–12 h", P(185), "CZK", { tax_inclusion: "n/a", confidence: 0.95 }),
      price("CZ-p05", csob, "MPSV", "Czechia", "Dolní pásmo stravného 5–12 h", P(155), "CZK", { tax_inclusion: "n/a", confidence: 0.9 }),
      price("CZ-p06", positiv, "Pluxee data", "Czechia", "Průměrná cena obědového menu", P(200), "CZK", { tax_inclusion: "included", recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("CZ-p07", positiv, "Pluxee data", "Czechia drahé regiony", "Obědové menu region high (band low)", P(212), "CZK", { tax_inclusion: "included", package_equivalent: "luxus", confidence: 0.85 }),
      price("CZ-p08", positiv, "Pluxee data", "Czechia drahé regiony", "Obědové menu region high (band high)", P(215), "CZK", { tax_inclusion: "included", package_equivalent: "luxus", confidence: 0.85 }),
      price("CZ-p09", kurzy, "Prior year compare", "Czechia", "Optimální stravenka 2025 (+10 Kč context → 225)", P(225), "CZK", { tax_inclusion: "n/a", confidence: 0.8 }),
      price("CZ-p10", kurzy, "2025 employer share", "Czechia", "Osvobozený příspěvek 2025 (123,90)", P(123.9), "CZK", { tax_inclusion: "n/a", confidence: 0.85 }),
      price("CZ-p11", estr, "ČSÚ context", "Czechia", "Polední menu nad hranicí", P(200), "CZK", { tax_inclusion: "included", confidence: 0.85 }),
      price("CZ-p12", upcz, "Up Benefity", "Czechia", "Doporučená stravenka 235", P(235), "CZK", { tax_inclusion: "n/a", recurring: true, confidence: 0.9 }),
    ],
    menu_observations: [
      menu("CZ-m01", positiv, "Pluxee", "Czechia", "Obědové menu v restauraci", "warm_meal"),
      menu("CZ-m02", estr, "eStravenka", "Czechia", "Polední menu / meníčka", "warm_meal"),
      menu("CZ-m03", upcz, "Up Benefity", "Czechia", "eStravenka v gastronomii (Apple/Google Pay)", "warm_meal", 0.75),
      menu("CZ-m04", upcz, "Up Benefity", "Czechia", "Bageterie Boulevard menu promo (app Můj Up)", "sandwich", 0.7),
      menu("CZ-m05", csob, "Stravování zaměstnanců", "Czechia", "Stravenky na směnu", "warm_meal", 0.7),
      menu("CZ-m06", csob, "Stravenkový paušál", "Czechia", "Peněžitý příspěvek na stravování", "warm_meal", 0.65),
      menu("CZ-m07", kurzy, "Pluxee", "Czechia", "Restaurace – růst cen poledních menu", "warm_meal", 0.7),
      menu("CZ-m08", positiv, "Pluxee", "Czechia", "Běžný oběd pokrytý stravenkou 235", "warm_meal", 0.75),
      menu("CZ-m09", estr, "Up", "Czechia", "Síť >32 000 provozoven eStravenka", "warm_meal", 0.7),
      menu("CZ-m10", upcz, "Up", "Czechia", "Moderní gastronomie benefit", "bowl", 0.65),
      menu("CZ-m11", kurzy, "Trh", "Czechia", "Polední menu ve městech", "warm_meal", 0.7),
      menu("CZ-m12", csob, "Zaměstnavatel", "Czechia", "Závodní stravování / příspěvek", "warm_meal", 0.65),
    ],
  };

  // ─── PT ───────────────────────────────────────────────────────────────────
  const cap = "https://www.calculadoracapital.pt/educacao/como-funciona-o-subsidio-de-refeicao";
  const simula = "https://simula.pt/simuladores/simulador_subsidio_refeicao";
  const contas = "https://contaspoupanca.pt/impostos/2026-01-22-isencao-de-irs-do-subsidio-de-refeicao-pago-em-cartao-sobe-para-10455-euros-fad06ad3";
  const padaria = "https://encomendas.apadariaportuguesa.pt/produto/pack-almoco-corporativo/";
  const zaask = "https://www.zaask.pt/quanto-custa/catering";
  const nicolau = "https://catering.ilovenicolau.com/product/nicolau-lunch-box";
  out.PT = {
    country_code: "PT",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "EUR",
    locales: ["pt-PT"],
    sources: [
      src(cap, "Subsídio de refeição 2026", "workplace", "IRS / Portaria 51-B/2026", "Portugal", "Isenção 6,15 EUR dinheiro; 10,455 EUR cartão/vale"),
      src(simula, "Simulador subsídio refeição", "workplace", "Código IRS", "Portugal", "Limites legais exactos 6,15 / 10,455 EUR"),
      src(contas, "Contas Poupança isenção cartão", "workplace", "Governo / IRS", "Portugal", "Cartão refeição isento até 10,455 EUR"),
      src(padaria, "A Padaria Portuguesa almoço corporativo", "commercial", "A Padaria Portuguesa", "Portugal / Lisboa area", "Pack Almoço Corporativo 29,99 EUR (4 meias sandes/snacks + salgados + brownie)"),
      src(zaask, "Zaask custo catering", "commercial", "Zaask marketplace", "Portugal", "Catering médio ~25 EUR/pessoa; lunch box típico 12–18 EUR"),
      src(nicolau, "I Love Nicolau Lunch Box", "commercial", "Catering do Nicolau", "Lisboa", "Lunch Box 220 EUR para 8–10 pessoas"),
    ],
    price_observations: [
      price("PT-p01", cap, "Portaria / IRS", "Portugal", "Subsídio refeição isento (dinheiro)", P(6.15), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.98 }),
      price("PT-p02", cap, "Código IRS", "Portugal", "Subsídio refeição isento (cartão/vale)", P(10.455), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.98 }),
      price("PT-p03", padaria, "A Padaria Portuguesa", "Portugal", "Pack Almoço Corporativo (grupo ~4)", P(29.99), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.95 }),
      price("PT-p04", padaria, "A Padaria Portuguesa", "Portugal", "Pack corporativo por pessoa (~4 pax)", P(7.5), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.8 }),
      price("PT-p05", zaask, "Zaask", "Portugal", "Catering médio por pessoa", P(25), "EUR", { tax_inclusion: "unknown", package_equivalent: "luxus", confidence: 0.8 }),
      price("PT-p06", zaask, "Zaask", "Portugal", "Catering banda baixa", P(12), "EUR", { tax_inclusion: "unknown", package_equivalent: "basis", confidence: 0.75 }),
      price("PT-p07", zaask, "Zaask", "Portugal", "Catering banda alta", P(45), "EUR", { tax_inclusion: "unknown", package_equivalent: "enterprise", confidence: 0.75 }),
      price("PT-p08", nicolau, "Catering do Nicolau", "Lisboa", "Lunch Box total 8–10 pax", P(220), "EUR", { tax_inclusion: "unknown", delivery_included: false, minimum_order: 8, package_equivalent: "luxus", confidence: 0.9 }),
      price("PT-p09", nicolau, "Catering do Nicolau", "Lisboa", "Lunch Box por pessoa (~9 pax)", P(24.44), "EUR", { tax_inclusion: "unknown", minimum_order: 8, package_equivalent: "luxus", confidence: 0.8 }),
      price("PT-p10", contas, "IRS", "Portugal", "Exemplo subsídio 11 EUR cartão (isenção 10,455)", P(11), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.85 }),
      price("PT-p11", simula, "IRS", "Portugal", "Limite cartão exacto", P(10.455), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.95 }),
      price("PT-p12", zaask, "Zaask lunch box tip", "Portugal", "Lunch box corporativo típico mid", P(15), "EUR", { tax_inclusion: "unknown", package_equivalent: "basis", confidence: 0.7 }),
    ],
    menu_observations: [
      menu("PT-m01", padaria, "A Padaria Portuguesa", "Portugal", "Snack Salada de Grão e Atum", "salad_box"),
      menu("PT-m02", padaria, "A Padaria Portuguesa", "Portugal", "Snack Salada de Massa e Pistachio", "salad_box"),
      menu("PT-m03", padaria, "A Padaria Portuguesa", "Portugal", "Sandes Mozzarella búfala e pesto", "sandwich"),
      menu("PT-m04", padaria, "A Padaria Portuguesa", "Portugal", "Sandes Salmão fumado e queijo creme", "sandwich"),
      menu("PT-m05", padaria, "A Padaria Portuguesa", "Portugal", "Sandes Atum molho tártaro", "sandwich"),
      menu("PT-m06", padaria, "A Padaria Portuguesa", "Portugal", "Croquete de Carne / Empada de Galinha / Pastel de Bacalhau", "warm_meal"),
      menu("PT-m07", padaria, "A Padaria Portuguesa", "Portugal", "Croquete Vegetariano de Espinafres / Rissol de Camarão", "warm_meal"),
      menu("PT-m08", padaria, "A Padaria Portuguesa", "Portugal", "Brownie bites", "premium"),
      menu("PT-m09", nicolau, "Catering do Nicolau", "Lisboa", "Lunch Box completa grupo (pratos+talheres)", "warm_meal"),
      menu("PT-m10", zaask, "Catering PT", "Portugal", "Serviço catering evento/empresa", "buffet", 0.7),
      menu("PT-m11", cap, "Cartão refeição", "Portugal", "Uso em restaurante/supermercado/café", "warm_meal", 0.7),
      menu("PT-m12", contas, "Cartão refeição", "Portugal", "Pagamento alimentação com cartão pré-pago", "warm_meal", 0.7),
    ],
  };

  // ─── GR ───────────────────────────────────────────────────────────────────
  const uph = "https://uphellas.gr/proionta/cheque-dejeuner";
  const ups = "https://uphellas.gr/paroxes/sitisi";
  const edengr = "https://www.edenred.gr/el-GR/Special-Pages/Landing-Pages/Direct/Ticket-Restaurant-Card/Ticket-Restaurant";
  const ief = "https://www.iefimerida.gr/oikonomia/oi-diataktikes-sitisis-epistrefoyn-stin-atzenta-pos-orio-ton-eu6-epireazei-ergazomenoys";
  const picnic = "https://picnicathens.gr/";
  const eco = "https://cateringcatering.gr/lunch-eco-bag-menu";
  out.GR = {
    country_code: "GR",
    access_date: ACCESS,
    real_citations_only: true,
    currency: "EUR",
    locales: ["el-GR"],
    sources: [
      src(uph, "Up Hellas Chèque Déjeuner", "workplace", "Up Hellas", "Greece", "Αφορολόγητο έως 1.452 EUR/έτος ανά εργαζόμενο; δίκτυο σούπερ μάρκετ/εστίαση"),
      src(ups, "Up Hellas παροχές σίτισης", "workplace", "Up Hellas", "Greece", "Κάρτες/κουπόνια σίτισης· 50.000+ σημεία για κάρτα"),
      src(edengr, "Edenred Ticket Restaurant GR", "workplace", "Edenred Greece", "Greece", "Έως 1.452 EUR/έτος· δίκτυο >10.000 καταστήματα"),
      src(ief, "Ιefimerida διατακτικές σίτισης", "workplace", "ΓΣΕΒΕΕ / press", "Greece", "Αφορολόγητο όριο 6 EUR/ημέρα· πρόταση αύξησης στα 10 EUR"),
      src(eco, "Petit Catering Lunch Eco Bag", "commercial", "Petit Catering", "Athens", "Lunch Eco Bag 11,90 EUR/άτομο χωρίς ΦΠΑ· σαλάτα+πίτα κοτόπουλο+φρούτο+γλυκό+νερό"),
      src(picnic, "Picnic Athens lunchboxes", "commercial", "Picnic Athens / Greek & Yummy", "Athens", "Lunchboxes 12–27 EUR/άτομο (breakfast/vegan/extraordinary/kids)"),
    ],
    price_observations: [
      price("GR-p01", uph, "Up Hellas / tax", "Greece", "Ετήσιο αφορολόγητο όριο σίτισης", P(1452), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("GR-p02", ief, "Φορολογία", "Greece", "Ημερήσιο αφορολόγητο όριο διατακτικών", P(6), "EUR", { tax_inclusion: "n/a", recurring: true, package_equivalent: "basis", confidence: 0.9 }),
      price("GR-p03", ief, "ΓΣΕΒΕΕ πρόταση", "Greece", "Προτεινόμενο ημερήσιο όριο", P(10), "EUR", { tax_inclusion: "n/a", confidence: 0.7 }),
      price("GR-p04", edengr, "Edenred", "Greece", "Ετήσιο όριο Ticket Restaurant", P(1452), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.9 }),
      price("GR-p05", eco, "Petit Catering", "Athens", "Lunch Eco Bag Menu", P(11.9), "EUR", { tax_inclusion: "excluded", package_equivalent: "basis", confidence: 0.95 }),
      price("GR-p06", picnic, "Picnic Athens", "Athens", "Menu 1 Greek breakfast lunchbox", P(19), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.95 }),
      price("GR-p07", picnic, "Picnic Athens", "Athens", "Menu 2 Vegan lunchbox", P(22), "EUR", { tax_inclusion: "included", package_equivalent: "luxus", confidence: 0.95 }),
      price("GR-p08", picnic, "Picnic Athens", "Athens", "Menu 3 Extraordinary lunchbox", P(27), "EUR", { tax_inclusion: "included", package_equivalent: "enterprise", confidence: 0.95 }),
      price("GR-p09", picnic, "Picnic Athens", "Athens", "Menu 4 kids lunchbox", P(12), "EUR", { tax_inclusion: "included", package_equivalent: "basis", confidence: 0.9 }),
      price("GR-p10", picnic, "Picnic Athens", "Athens", "Menu 5 sweet lunchbox", P(18), "EUR", { tax_inclusion: "included", confidence: 0.9 }),
      price("GR-p11", uph, "Up Hellas", "Greece", "Implied daily from 1452/242 workdays", P(6), "EUR", { tax_inclusion: "n/a", recurring: true, confidence: 0.75 }),
      price("GR-p12", eco, "Petit Catering", "Athens", "Corporate office lunch eco bag (ex VAT)", P(11.9), "EUR", { tax_inclusion: "excluded", package_equivalent: "basis", confidence: 0.9 }),
    ],
    menu_observations: [
      menu("GR-m01", eco, "Petit Catering", "Athens", "Μικροσαλάτα + σάντουιτς κοτόπουλο σε αραβική πίτα + μπανάνα + σοκολατόπιτα + νερό", "salad_box"),
      menu("GR-m02", picnic, "Picnic Athens", "Athens", "Greek breakfast: koulouri + spinach pies + cream pie + granola", "sandwich"),
      menu("GR-m03", picnic, "Picnic Athens", "Athens", "Vegan: grilled veg sandwich + houmous flatbread + kinoa salad", "sandwich"),
      menu("GR-m04", picnic, "Picnic Athens", "Athens", "Extraordinary: chicken flatbread + zucchini pies + potato salad", "warm_meal"),
      menu("GR-m05", uph, "Up Hellas", "Greece", "Chèque Déjeuner σε σούπερ μάρκετ (ΑΒ, Σκλαβενίτης, Μασούτης, MyMarket)", "warm_meal", 0.75),
      menu("GR-m06", uph, "Up Hellas", "Greece", "Εστιατόρια & σημεία εστίασης", "warm_meal", 0.75),
      menu("GR-m07", ups, "Up Hellas", "Greece", "Κάρτα σίτισης Apple Pay / Google Pay", "warm_meal", 0.7),
      menu("GR-m08", edengr, "Edenred", "Greece", "Ticket Restaurant® σε Σκλαβενίτη / My Market", "warm_meal", 0.75),
      menu("GR-m09", edengr, "Edenred", "Greece", "Συνεργαζόμενα καταστήματα εστίασης", "warm_meal", 0.75),
      menu("GR-m10", ief, "Διατακτικές", "Greece", "Καθημερινό γεύμα εργαζομένων (πλαίσιο ορίου 6€)", "warm_meal", 0.65),
      menu("GR-m11", picnic, "Picnic Athens", "Athens", "Company picnic events catering", "buffet", 0.7),
      menu("GR-m12", eco, "Petit Catering", "Athens", "Εταιρικό catering στο γραφείο (eco pack)", "sandwich", 0.8),
    ],
  };

  return out;
}
