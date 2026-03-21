/**
 * AI Food Pairing capability: suggestMenuPairings.
 * AI foreslår hva som passer sammen i menyen.
 * Eksempel: Thai curry → mango salad → kokosdessert.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "foodPairing";

const foodPairingCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Food pairing: suggests what goes well together on a menu (e.g. Thai curry → mango salad → coconut dessert). Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Food pairing input",
    properties: {
      anchorDish: { type: "string", description: "e.g. Thai curry, pasta, taco" },
      cuisine: { type: "string", description: "Optional: Thai, Italian, Nordic, Asian" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Suggested menu pairings",
    required: ["suggestions", "summary", "generatedAt"],
    properties: {
      suggestions: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestion_only",
      description: "Output is menu suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(foodPairingCapability);

export type FoodPairingInput = {
  anchorDish?: string | null;
  cuisine?: string | null;
  locale?: "nb" | "en" | null;
};

export type MenuPairingSuggestion = {
  theme: string;
  main: string;
  sides: string[];
  dessert: string | null;
  rationale: string;
};

export type FoodPairingOutput = {
  suggestions: MenuPairingSuggestion[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\u0300-\u036f/g, "")
    .replace(/\s+/g, " ");
}

/** Predefined pairings: theme → { main, sides, dessert, rationaleKey }. */
const PAIRINGS_NB: Record<
  string,
  { main: string; sides: string[]; dessert: string; rationale: string }
> = {
  thai: {
    main: "Thai curry",
    sides: ["Mangosalat", "Ris"],
    dessert: "Kokosdessert",
    rationale: "Kurry, mango og kokos henger sammen og gir en balansert thai-inspirert meny.",
  },
  italian: {
    main: "Pasta",
    sides: ["Caprese", "Brød og olivenolje"],
    dessert: "Tiramisu",
    rationale: "Klassisk italiensk trio: pasta, fersk salat og kaffedessert.",
  },
  nordic: {
    main: "Laks med grønnsaker",
    sides: ["Rugbrød", "Dillsaus", "Råkost"],
    dessert: "Eplekake eller bær",
    rationale: "Nordisk smak med laks, rugbrød og sesongens bær eller eple.",
  },
  asian: {
    main: "Wok med ris",
    sides: ["Edamame", "Ingefærsalat"],
    dessert: "Mochi eller sesamkake",
    rationale: "Asiatisk wok passer til edamame og lett dessert.",
  },
  mexican: {
    main: "Tacos",
    sides: ["Guacamole", "Salsa", "Lime og koriander"],
    dessert: "Churros eller flan",
    rationale: "Tacos, avokado og lime gir en sammenhengende meksikansk meny.",
  },
  indian: {
    main: "Karri (kylling eller kikerter)",
    sides: ["Naan", "Raita", "Lime og koriander"],
    dessert: "Gulab jamun eller mango lassi",
    rationale: "Karri, naan og raita balanserer sterke smaker; dessert runder av.",
  },
  middleeastern: {
    main: "Falafel eller grillkylling",
    sides: ["Hummus", "Tabouleh", "Pita"],
    dessert: "Baklava eller dadler",
    rationale: "Middelhavs-inspirert: kikerter, urter og søtt avslutning.",
  },
};

const PAIRINGS_EN: Record<
  string,
  { main: string; sides: string[]; dessert: string; rationale: string }
> = {
  thai: {
    main: "Thai curry",
    sides: ["Mango salad", "Rice"],
    dessert: "Coconut dessert",
    rationale: "Curry, mango and coconut work together for a balanced Thai-inspired menu.",
  },
  italian: {
    main: "Pasta",
    sides: ["Caprese", "Bread and olive oil"],
    dessert: "Tiramisu",
    rationale: "Classic Italian trio: pasta, fresh salad and coffee dessert.",
  },
  nordic: {
    main: "Salmon with vegetables",
    sides: ["Rye bread", "Dill sauce", "Coleslaw"],
    dessert: "Apple cake or berries",
    rationale: "Nordic flavours with salmon, rye and seasonal berries or apple.",
  },
  asian: {
    main: "Stir-fry with rice",
    sides: ["Edamame", "Ginger salad"],
    dessert: "Mochi or sesame cake",
    rationale: "Asian stir-fry pairs with edamame and a light dessert.",
  },
  mexican: {
    main: "Tacos",
    sides: ["Guacamole", "Salsa", "Lime and coriander"],
    dessert: "Churros or flan",
    rationale: "Tacos, avocado and lime make a coherent Mexican menu.",
  },
  indian: {
    main: "Curry (chicken or chickpeas)",
    sides: ["Naan", "Raita", "Lime and coriander"],
    dessert: "Gulab jamun or mango lassi",
    rationale: "Curry, naan and raita balance strong flavours; dessert rounds it off.",
  },
  middleeastern: {
    main: "Falafel or grilled chicken",
    sides: ["Hummus", "Tabouleh", "Pita"],
    dessert: "Baklava or dates",
    rationale: "Mediterranean-inspired: chickpeas, herbs and a sweet finish.",
  },
};

const ANCHOR_TO_THEME: Record<string, string> = {
  curry: "thai",
  thai: "thai",
  kokos: "thai",
  coconut: "thai",
  mango: "thai",
  pasta: "italian",
  italian: "italian",
  caprese: "italian",
  tiramisu: "italian",
  laks: "nordic",
  salmon: "nordic",
  nordic: "nordic",
  rugbrød: "nordic",
  rye: "nordic",
  wok: "asian",
  asian: "asian",
  ris: "asian",
  rice: "asian",
  edamame: "asian",
  taco: "mexican",
  tacos: "mexican",
  mexican: "mexican",
  guacamole: "mexican",
  karri: "indian",
  indian: "indian",
  naan: "indian",
  falafel: "middleeastern",
  hummus: "middleeastern",
  middelhav: "middleeastern",
  mediterranean: "middleeastern",
};

function detectTheme(anchorDish: string, cuisine: string | null): string | null {
  const c = cuisine ? normalize(safeStr(cuisine)) : "";
  if (c && PAIRINGS_NB[c]) return c;
  const words = normalize(anchorDish).split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (ANCHOR_TO_THEME[w]) return ANCHOR_TO_THEME[w];
  }
  for (const key of Object.keys(ANCHOR_TO_THEME)) {
    if (normalize(anchorDish).includes(key)) return ANCHOR_TO_THEME[key];
  }
  return null;
}

/**
 * Suggests menu pairings (main + sides + dessert) that go well together. Deterministic.
 */
export function suggestMenuPairings(input: FoodPairingInput): FoodPairingOutput {
  const isEn = input.locale === "en";
  const anchor = safeStr(input.anchorDish) || (isEn ? "curry" : "curry");
  const cuisine = input.cuisine ? safeStr(input.cuisine) : null;
  const pairings = isEn ? PAIRINGS_EN : PAIRINGS_NB;

  const theme = detectTheme(anchor, cuisine);

  const suggestions: MenuPairingSuggestion[] = [];

  if (theme && pairings[theme]) {
    const p = pairings[theme];
    suggestions.push({
      theme: theme.charAt(0).toUpperCase() + theme.slice(1),
      main: p.main,
      sides: p.sides,
      dessert: p.dessert,
      rationale: p.rationale,
    });
  }

  if (suggestions.length === 0) {
    const fallback = isEn ? pairings["thai"]! : pairings["thai"]!;
    suggestions.push({
      theme: "Thai",
      main: fallback.main,
      sides: fallback.sides,
      dessert: fallback.dessert,
      rationale: isEn
        ? "No match for your dish; here is a Thai-style pairing example (curry → mango salad → coconut dessert)."
        : "Ingen treff for retten; her er et thai-inspirert paringsforslag (curry → mangosalat → kokosdessert).",
    });
  }

  const summary = isEn
    ? `Suggested menu pairing: ${suggestions[0]?.main ?? ""} → ${suggestions[0]?.sides.join(", ")} → ${suggestions[0]?.dessert ?? ""}.`
    : `Foreslått menyparing: ${suggestions[0]?.main ?? ""} → ${suggestions[0]?.sides.join(", ")} → ${suggestions[0]?.dessert ?? ""}.`;

  return {
    suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
