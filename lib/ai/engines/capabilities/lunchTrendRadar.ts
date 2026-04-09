/**
 * AI Food Trend Engine / Lunch Trend Radar capability: getTrendReport.
 * AI overvåker mattrender og foreslår nye retter.
 * Deterministic; curated trend data (no live external API).
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "lunchTrendRadar";

const lunchTrendRadarCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Food trend engine: monitors food trends and suggests new dishes (and concepts). Deterministic; curated trends.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Lunch trend radar input",
    properties: {
      category: {
        type: "string",
        enum: ["all", "concepts", "dishes"],
        description: "Focus: all, concepts only, or dish suggestions only",
      },
      locale: { type: "string", enum: ["nb", "en"] },
      maxConcepts: { type: "number" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Trend report with concepts and dish suggestions",
    required: ["trendConcepts", "suggestedDishes", "reportSummary", "generatedAt"],
    properties: {
      trendConcepts: { type: "array", items: { type: "object" } },
      suggestedDishes: { type: "array", items: { type: "object" } },
      reportSummary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "information_only",
      description: "Output is trend information and suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(lunchTrendRadarCapability);

export type LunchTrendRadarInput = {
  category?: "all" | "concepts" | "dishes" | null;
  locale?: "nb" | "en" | null;
  maxConcepts?: number | null;
};

export type TrendConcept = {
  id: string;
  name: string;
  description: string;
  originHint: string;
  suggestedDishes: string[];
};

export type SuggestedDishFromTrend = {
  dishName: string;
  conceptId: string;
  conceptName: string;
  hint: string;
};

export type LunchTrendRadarOutput = {
  trendConcepts: TrendConcept[];
  suggestedDishes: SuggestedDishFromTrend[];
  reportSummary: string;
  generatedAt: string;
};

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/** Curated global lunch trends: concepts + example dishes. */
type TrendRow = {
  id: string;
  nameNb: string;
  nameEn: string;
  descNb: string;
  descEn: string;
  origin: string;
  dishesNb: string[];
  dishesEn: string[];
};

const TRENDS: TrendRow[] = [
  {
    id: "power-bowls",
    nameNb: "Power bowls / Buddha bowls",
    nameEn: "Power bowls / Buddha bowls",
    descNb: "Bunner med ris eller bulgur, grønnsaker, protein og dressing. Stort globalt fokus på balanse og visuell presentasjon.",
    descEn: "Bowls with rice or bulgur, vegetables, protein and dressing. Strong global focus on balance and visual appeal.",
    origin: "Global (Asia–US)",
    dishesNb: ["Buddha bowl med edamame og avocado", "Poke bowl med laks", "Grain bowl med roasted vegetables"],
    dishesEn: ["Buddha bowl with edamame and avocado", "Poke bowl with salmon", "Grain bowl with roasted vegetables"],
  },
  {
    id: "flexitarian",
    nameNb: "Flexitar",
    nameEn: "Flexitarian",
    descNb: "Plantebasert som standard med valgfri tilgang på animalsk protein. Vokser raskt i Europa og Nord-Amerika.",
    descEn: "Plant-based by default with optional animal protein. Growing fast in Europe and North America.",
    origin: "Europe, North America",
    dishesNb: ["Plantebasert hovedrett med kylling som tilvalg", "Linsegryte med spekeskinkebiter", "Vegetarburger med ost"],
    dishesEn: ["Plant-based main with chicken as add-on", "Lentil casserole with ham pieces", "Veggie burger with cheese"],
  },
  {
    id: "fermented-gut-health",
    nameNb: "Fermentert og tarmhelse",
    nameEn: "Fermented and gut health",
    descNb: "Kimchi, surkål, kombucha og probiotiske tilbehør. Sterk trend i Norden og Korea.",
    descEn: "Kimchi, sauerkraut, kombucha and probiotic sides. Strong trend in Nordics and Korea.",
    origin: "Nordic, Korea, global",
    dishesNb: ["Kimchi-bowl med ris og egg", "Surkål med potet og pølse", "Salat med fermentert rødbet"],
    dishesEn: ["Kimchi bowl with rice and egg", "Sauerkraut with potato and sausage", "Salad with fermented beetroot"],
  },
  {
    id: "street-food-premium",
    nameNb: "Street food premium",
    nameEn: "Street food premium",
    descNb: "Gatekjøkken-inspirert mat i kontor- og lunsjsetting: tacos, banh mi, gyros i høy kvalitet.",
    descEn: "Street food–inspired in office and lunch settings: tacos, banh mi, gyros at higher quality.",
    origin: "Global",
    dishesNb: ["Banh mi med pulled pork", "Gyros i pita med tzatziki", "Soft tacos med grillet kylling"],
    dishesEn: ["Banh mi with pulled pork", "Gyros in pita with tzatziki", "Soft tacos with grilled chicken"],
  },
  {
    id: "nordic-simplicity",
    nameNb: "Nordisk enkelhet",
    nameEn: "Nordic simplicity",
    descNb: "Råvarer i fokus, få ingredienser, sesong og lokal tilgjengelighet. Etablert i Norden, økende internasjonalt.",
    descEn: "Ingredients in focus, few components, season and local availability. Established in Nordics, growing internationally.",
    origin: "Nordic",
    dishesNb: ["Røkt laks med dill og agurk", "Rugbrød med pålegg og råkost", "Kål og eple med nøtter"],
    dishesEn: ["Smoked salmon with dill and cucumber", "Rye bread with toppings and coleslaw", "Cabbage and apple with nuts"],
  },
  {
    id: "middle-eastern",
    nameNb: "Middelhavs- og midtøstensmaker",
    nameEn: "Middle Eastern flavours",
    descNb: "Hummus, falafel, tahini, granatæple og urter. Populært i UK, Tyskland og Skandinavia.",
    descEn: "Hummus, falafel, tahini, pomegranate and herbs. Popular in UK, Germany and Scandinavia.",
    origin: "UK, Germany, Scandinavia",
    dishesNb: ["Falafel med hummus og tabouleh", "Grillkylling med tahini og granatæple", "Shakshuka med brød"],
    dishesEn: ["Falafel with hummus and tabouleh", "Grilled chicken with tahini and pomegranate", "Shakshuka with bread"],
  },
  {
    id: "zero-waste",
    nameNb: "Zero waste / nose-to-tail",
    nameEn: "Zero waste / nose-to-tail",
    descNb: "Bruk av hele råvaren, mindre matsvinn, «ugle» grønnsaker og rester i nye retter.",
    descEn: "Using the whole ingredient, less waste, «ugly» vegetables and leftovers in new dishes.",
    origin: "Global",
    dishesNb: ["Gryte med rotstykker og belgfrukter", "Suppe på grønnsaksavfall", "Brødrisotto / panzanella"],
    dishesEn: ["Casserole with root scraps and pulses", "Soup from vegetable trimmings", "Bread risotto / panzanella"],
  },
  {
    id: "comfort-twist",
    nameNb: "Comfort med twist",
    nameEn: "Comfort with a twist",
    descNb: "Klassiske komfortretter med ny vri: krydder, urter eller internasjonal innflytelse.",
    descEn: "Classic comfort dishes with a new twist: spice, herbs or international influence.",
    origin: "Global",
    dishesNb: ["Mac and cheese med chorizo og lime", "Lapskaus med kimchi", "Shepherd's pie med søtpotet"],
    dishesEn: ["Mac and cheese with chorizo and lime", "Stew with kimchi", "Shepherd's pie with sweet potato"],
  },
  {
    id: "grab-and-go-premium",
    nameNb: "Grab-and-go premium",
    nameEn: "Grab-and-go premium",
    descNb: "Hurtig lunsj uten å ofre kvalitet: wraps, salater i boks, smørbrød og bowl til takeaway.",
    descEn: "Quick lunch without sacrificing quality: wraps, boxed salads, open sandwiches and takeaway bowls.",
    origin: "Nordic, UK",
    dishesNb: ["Premium wrap med kylling og avocado", "Smørbrød på rugbrød", "Salatboks med quinoa og feta"],
    dishesEn: ["Premium wrap with chicken and avocado", "Open rye sandwich", "Salad box with quinoa and feta"],
  },
  {
    id: "plant-forward",
    nameNb: "Plant-forward",
    nameEn: "Plant-forward",
    descNb: "Plantene i hovedrollen, kjøtt/fisk som smaksgivere eller tilbehør. Større fokus på bærekraft.",
    descEn: "Plants in the lead, meat/fish as flavour or side. Greater focus on sustainability.",
    origin: "Global",
    dishesNb: ["Kikertegryte med bacon som topping", "Risotto med sopp og parmesan", "Baked cauliflower med yoghurtsaus"],
    dishesEn: ["Chickpea casserole with bacon topping", "Mushroom risotto with parmesan", "Baked cauliflower with yoghurt sauce"],
  },
];

/**
 * Returns curated global lunch trend report: new concepts and suggested dishes. Deterministic.
 */
export function getTrendReport(input: LunchTrendRadarInput): LunchTrendRadarOutput {
  const isEn = input.locale === "en";
  const category = input.category ?? "all";
  const maxConcepts = Math.min(TRENDS.length, Math.max(1, safeNum(input.maxConcepts)));

  const concepts: TrendConcept[] = TRENDS.slice(0, maxConcepts).map((t) => ({
    id: t.id,
    name: isEn ? t.nameEn : t.nameNb,
    description: isEn ? t.descEn : t.descNb,
    originHint: t.origin,
    suggestedDishes: isEn ? t.dishesEn : t.dishesNb,
  }));

  const suggestedDishes: SuggestedDishFromTrend[] = [];
  if (category !== "concepts") {
    for (const c of concepts) {
      const trendRow = TRENDS.find((t) => t.id === c.id)!;
      const dishes = isEn ? trendRow.dishesEn : trendRow.dishesNb;
      for (const d of dishes) {
        suggestedDishes.push({
          dishName: d,
          conceptId: c.id,
          conceptName: c.name,
          hint: isEn
            ? `Part of trend: ${c.name} (${c.originHint}).`
            : `Inngår i trenden: ${c.name} (${c.originHint}).`,
        });
      }
    }
  }

  const trendConcepts = category === "dishes" ? [] : concepts;
  const reportSummary = isEn
    ? `Lunch Trend Radar: ${trendConcepts.length} trend concept(s), ${suggestedDishes.length} suggested dish(es). Use for new concepts and menu ideas.`
    : `Lunch Trend Radar: ${trendConcepts.length} trendkonsept(er), ${suggestedDishes.length} foreslåtte retter. Bruk til nye konsepter og menyidéer.`;

  return {
    trendConcepts,
    suggestedDishes: category === "concepts" ? [] : suggestedDishes,
    reportSummary,
    generatedAt: new Date().toISOString(),
  };
}
