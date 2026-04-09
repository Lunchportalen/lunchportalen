import type {
  AiMotorDemoObjectiveSlice,
  AiMotorDemoTotalsSlice,
  DecisionExplanationPayload,
} from "@/components/ai-motor/AiMotorDemoShared";

/** Heilt fiktive, konsistente tall — ingen kundedata. */
export const PUBLIC_AI_DEMO_PERIOD = "2025-02";

export const PUBLIC_AI_DEMO_OBJECTIVE: AiMotorDemoObjectiveSlice = {
  score: 0.71,
  stress: 0.34,
  strategy_mode: "balance",
  strategy_forced: false,
  strategy_override_source: null,
  margin_gap_stress: 0.22,
  growth_gap_stress: 0.18,
  margin_gap_base: 0.14,
  growth_gap_base: 0.11,
  targets: { target_margin_usd: 420, target_growth_rel: 0.08 },
  achieved_growth_rel: 0.062,
  checkpoint_period: "2025-01",
};

export const PUBLIC_AI_DEMO_TOTALS: AiMotorDemoTotalsSlice = {
  margin_usd: 385.5,
  revenue_partial: false,
};

export const PUBLIC_AI_DEMO_DECISION: DecisionExplanationPayload = {
  headline: "Balansert · Forretningsscore 71 %",
  bullets: [
    "Strategi er valgt automatisk ut fra margin-gap mot vekst-gap (med hysterese) — eksempel for illustrasjon.",
    "Aktiv modus: Balansert. Mål justeres per modus, deretter vekter og auto-bias.",
    "Forretningsscore 71,0 % (0–100 %) — vektet margin, list MRR og vekst mot forrige sjekkpunkt (eksempel).",
    "Faktisk margin (AI-linje): 385.50 USD. Mål etter modus: ca. 420.00 USD.",
    "Realisert blandet vekst (MRR + bruk): 6,20 % mot forrige periode. Mål: 8,00 %.",
    "Gap (basis): margin 14 %, vekst 11 % — styrer modus når ikke overstyrt.",
    "Auto-tiltak: modellnedgradering skaleres med margin-behov; verktøy-throttle dempes når vekst er under mål.",
  ],
  ai_jobber_med:
    "AI jobber nå med å balansere margin og vekst ut fra faktiske gap og lagret historikk denne perioden (eksempel).",
  forretningsscore_band: "sterk",
  forretningsscore_band_forklaring: "Godt resultat mot mål — færre dramatiske grep forventes (illustrasjon).",
  prognose_7_dager: {
    ingress: "Prognose neste 7 dager (fra dagens tempo i perioden) — eksempel:",
    punkter: [
      "Hittil i perioden: ca. 12,4 AI-kjøringer per dag i snitt (fiktivt volum).",
      "Ved uendret tempo: om lag 87 kjøringer de neste 7 dagene (tilnærmet projeksjon).",
      "Strategi og anbefalinger justeres når nye kall og fakturadata oppdateres.",
    ],
    disclaimer:
      "Prognosen bygger på enkel trending av hittil-bruk i perioden — ikke en garanti, og tallene her er ikke fra en ekte konto.",
  },
  styringsanbefaling_kode: "folg_med",
  styringsanbefaling_tittel: "Følg med",
  styringsanbefaling_begrunnelse:
    "Bildet er verken kritisk eller «grønt lys» — sjekk anbefalinger jevnlig og vær klar til å justere strategi ved endringer (eksempeltekst).",
  forretningsscore_hva_er_det:
    "Forretningsscore (71,0 %) er et samlet tall for hvor godt et miljø ligger an på margin, inntektsbilde og vekst mot forrige lagrede sjekkpunkt — her med påfunnstall for demonstrasjon.",
  hva_skjer_na:
    "Akkurat nå er modus balansert: verken margin eller vekst dominerer alene. Anbefalinger blander hensynene etter faktiske gap (eksempel).",
  hva_forventer_vi:
    "Vi forventer at anbefalinger og eventuelle auto-tiltak følger valgt strategi frem til neste månedlige sammenligning (illustrasjon).",
  effekt_i_korthet: [
    "Lavere Forretningsscore gir oftere forslag om kostkontroll (modellnivå, verktøybruk).",
    "Margin-gap styrer hvor aggressivt systemet foreslår innsparinger.",
    "Strategi kan skifte automatisk når margin- og vekstbildet endrer seg (med rolig hysterese).",
  ],
  tillit: [
    {
      title: "Demonstrasjonsdata",
      body: "Alle tall på denne siden er sammensatt for å vise flyt og språk — ikke hentet fra et levende selskap.",
      signal: "oppmerksom",
    },
    {
      title: "Sammenligning over tid",
      body: "Sjekkpunkt 2025-01 gir meningsfull vekst- og marginutvikling mot 2025-02 i dette scenariet.",
      signal: "god",
    },
    {
      title: "Erfaring fra drift",
      body: "I produksjon bygges erfaringsgrunnlaget fra reelle kjøringer per strategi.",
      signal: "middels",
    },
    {
      title: "Åpen styring",
      body: "Ingen skjult lås i eksemplet: modus følger målt gap med forklart logikk.",
      signal: "god",
    },
  ],
  konfidens: {
    niva: "Moderat forklaringskraft",
    forklaring:
      "Her er alt merket som eksempel. I ekte portal kobles konfidens mot faktisk datagrunnlag og anbefalinger.",
  },
  salgsblokk_overskrift: "AI styrer lønnsomheten din – automatisk",
  historie_problem_overskrift: "Problemet uten en felles motor",
  historie_problem_punkter: [
    "Kost, modeller og varsler fordeles manuelt — uten én felles prioritering på tvers av selskaper",
    "Strategi og tiltak lander i møter, e-post og regneark — sent, fragmentert og vanskelig å spore",
    "Margin og vekst sees ofte først når perioden er lukket — reaksjonen kan komme for sent",
  ],
  historie_transformasjon_overskrift: "Transformasjonen: hva AI-motoren gjør",
  historie_transformasjon_punkter: [
    "Leser faktisk AI-bruk, kost og list MRR fortløpende — innenfor deres tenant og styring",
    "Velger og holder strategi (margin / vekst / balanse) med rolig hysterese — mindre ping-pong",
    "Oppdaterer vekter, auto-bias og anbefalinger ut fra målte gap — synlig i Forretningsscore og prognose",
  ],
  historie_resultat_overskrift: "Resultatet dere oppnår",
  historie_resultat_punkter: [
    "Tydelig bilde av lønnsomhet på AI-linjen — før situasjonen blir uoversiktlig",
    "Færre tilfeldige grep: tiltakene matcher faktiske gap, med tydelig anbefaling (La AI styre / Følg med / Ta kontroll)",
    "Teamet slipper å gjette: tillit, konfidens og teknisk utdyping ligger samlet — beslutninger blir roligere",
  ],
  historie_bevis_overskrift: "Bevis — slik kan tallene se ut i portalen",
  historie_bevis_ingress:
    "Under er illustrative prosentendringer slik de kan se ut i produktet når sjekkpunkt finnes — ikke målinger fra din bedrift.",
  bevis_margin_forbedring_pct: 14.2,
  bevis_margin_tekst:
    "Relativ utvikling i margin på AI-linje mot et fiktivt sjekkpunkt — kun for å vise formatet i grensesnittet.",
  bevis_tid_besparelse_indikator_pct: 21.5,
  bevis_tid_tekst:
    "Indikator for tidsbesparelse: relativ utvikling i Forretningsscore mot fiktivt sjekkpunkt (ikke timeregistrering).",
  bevis_disclaimer:
    "Alle prosenttall på denne offentlige siden er eksempler. I produksjon hentes tall fra plattformens faktiske AI- og økonomidata.",
  cta_start_ai_styring_label: "Prøv med dine egne tall",
  cta_start_ai_styring_href: "/registrering?from=ai_demo",
};
