/**
 * AI Menu Creativity capability: suggestNewDishes.
 * AI genererer nye retter basert på: trender, sesong, kjøkkenets kapasitet.
 * Deterministic; no LLM.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "menuCreativity";

const menuCreativityCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Menu creativity: generates new dish ideas based on trends, season, and kitchen capacity. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Menu creativity input",
    properties: {
      trends: {
        type: "array",
        items: { type: "string" },
        description: "e.g. plant-based, comfort, spicy, nordic, healthy",
      },
      season: {
        type: "string",
        enum: ["vår", "sommer", "høst", "vinter"],
      },
      kitchenCapacity: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Kitchen capacity: low=simple, high=complex",
      },
      locale: { type: "string", enum: ["nb", "en"] },
      maxSuggestions: { type: "number" },
    },
    required: ["season"],
  },
  outputSchema: {
    type: "object",
    description: "New dish suggestions",
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
      description: "Output is dish suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "kitchen"],
};

registerCapability(menuCreativityCapability);

export type Season = "vår" | "sommer" | "høst" | "vinter";
export type KitchenCapacity = "low" | "medium" | "high";

export type MenuCreativityInput = {
  trends?: string[] | null;
  season: Season;
  kitchenCapacity?: KitchenCapacity | null;
  locale?: "nb" | "en" | null;
  maxSuggestions?: number | null;
};

export type NewDishSuggestion = {
  title: string;
  shortDescription: string;
  trendMatch: string[];
  seasonMatch: string;
  capacityMatch: string;
  rationale: string;
};

export type MenuCreativityOutput = {
  suggestions: NewDishSuggestion[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Dish ideas: trend tags, season, capacity, title + description (nb/en). */
type DishIdea = {
  trends: string[];
  season: Season;
  capacity: KitchenCapacity;
  titleNb: string;
  titleEn: string;
  descNb: string;
  descEn: string;
};

const DISH_IDEAS: DishIdea[] = [
  {
    trends: ["plant-based", "healthy", "vegetar"],
    season: "sommer",
    capacity: "low",
    titleNb: "Sommersalat med kikerter og sitron",
    titleEn: "Summer salad with chickpeas and lemon",
    descNb: "Lett salat med kikerter, agurk, tomat og fersk sitron. Rask å lage.",
    descEn: "Light salad with chickpeas, cucumber, tomato and fresh lemon. Quick to make.",
  },
  {
    trends: ["plant-based", "nordic"],
    season: "vår",
    capacity: "medium",
    titleNb: "Asparges med rabarbra og urter",
    titleEn: "Asparagus with rhubarb and herbs",
    descNb: "Vårrett med stekt asparges, lett rabarbrakompott og dill.",
    descEn: "Spring dish with pan-fried asparagus, light rhubarb compote and dill.",
  },
  {
    trends: ["comfort", "healthy"],
    season: "høst",
    capacity: "medium",
    titleNb: "Gryte med squash og linse",
    titleEn: "Squash and lentil casserole",
    descNb: "Varmende gryte med gresskar, rød linse og spinat. Mettene og enkel.",
    descEn: "Warming casserole with squash, red lentil and spinach. Filling and simple.",
  },
  {
    trends: ["spicy", "asian"],
    season: "vinter",
    capacity: "high",
    titleNb: "Koreansk-inspirert tofu med kimchi og ris",
    titleEn: "Korean-inspired tofu with kimchi and rice",
    descNb: "Krydret tofu, kimchi og sesam. Krever noe mer tilberedning.",
    descEn: "Spiced tofu, kimchi and sesame. Requires a bit more prep.",
  },
  {
    trends: ["nordic", "comfort"],
    season: "vinter",
    capacity: "low",
    titleNb: "Rugbrødslunch med spekeskinke og egg",
    titleEn: "Rye bread lunch with cured ham and egg",
    descNb: "Klassisk norsk: rugbrød, spekeskinke, kokt egg, råkost.",
    descEn: "Classic Nordic: rye bread, cured ham, boiled egg, coleslaw.",
  },
  {
    trends: ["plant-based", "trendy"],
    season: "sommer",
    capacity: "medium",
    titleNb: "Buddha bowl med edamame og mango",
    titleEn: "Buddha bowl with edamame and mango",
    descNb: "Bolle med ris, edamame, mango, avokado og lime. Populær og fargerik.",
    descEn: "Bowl with rice, edamame, mango, avocado and lime. Popular and colourful.",
  },
  {
    trends: ["comfort", "spicy"],
    season: "høst",
    capacity: "medium",
    titleNb: "Pumpkin karri med kikerter",
    titleEn: "Pumpkin curry with chickpeas",
    descNb: "Mild til medium karri med gresskar og kikerter. Sesongens grønnsaker.",
    descEn: "Mild to medium curry with pumpkin and chickpeas. Seasonal vegetables.",
  },
  {
    trends: ["nordic", "healthy"],
    season: "vår",
    capacity: "low",
    titleNb: "Nypotet og dill med røkt laks",
    titleEn: "New potatoes and dill with smoked salmon",
    descNb: "Enkel vårklassiker: nypoteter, dill, røkt laks og råkost.",
    descEn: "Simple spring classic: new potatoes, dill, smoked salmon and coleslaw.",
  },
  {
    trends: ["asian", "healthy"],
    season: "sommer",
    capacity: "medium",
    titleNb: "Sommerruller med peanøttdressing",
    titleEn: "Summer rolls with peanut dressing",
    descNb: "Lette sommerruller med reker eller tofu, grønnsaker og peanøttdressing.",
    descEn: "Light summer rolls with shrimp or tofu, vegetables and peanut dressing.",
  },
  {
    trends: ["comfort", "nordic"],
    season: "vinter",
    capacity: "medium",
    titleNb: "Lapskaus med viltkjøtt",
    titleEn: "Norwegian stew with game meat",
    descNb: "Tradisjonell lapskaus med vilt eller storfekjøtt. Varmende vinterrett.",
    descEn: "Traditional Norwegian stew with game or beef. Warming winter dish.",
  },
  {
    trends: ["plant-based", "comfort"],
    season: "høst",
    capacity: "low",
    titleNb: "Ertesuppe med mynte og brød",
    titleEn: "Pea soup with mint and bread",
    descNb: "Kremet ertesuppe med mynte. Enkel og mettende.",
    descEn: "Creamy pea soup with mint. Simple and filling.",
  },
  {
    trends: ["trendy", "healthy"],
    season: "vår",
    capacity: "medium",
    titleNb: "Bowl med rabarbra og yoghurt",
    titleEn: "Bowl with rhubarb and yoghurt",
    descNb: "Frukost- eller lunsjbowl med rabarbrakompott, yoghurt og granola.",
    descEn: "Breakfast or lunch bowl with rhubarb compote, yoghurt and granola.",
  },
];

/**
 * Suggests new dishes based on trends, season, and kitchen capacity. Deterministic.
 */
export function suggestNewDishes(input: MenuCreativityInput): MenuCreativityOutput {
  const isEn = input.locale === "en";
  const season = input.season;
  const capacity = (input.kitchenCapacity ?? "medium") as KitchenCapacity;
  const trendList = Array.isArray(input.trends)
    ? input.trends.map((t) => normalize(safeStr(t)))
    : [];
  const maxSuggestions = Math.min(15, Math.max(1, safeNum(input.maxSuggestions)));

  const normalizedTrends = new Set(trendList);
  if (normalizedTrends.size === 0) {
    ["plant-based", "comfort", "nordic", "healthy"].forEach((t) => normalizedTrends.add(t));
  }

  const scored = DISH_IDEAS.filter(
    (d) => d.season === season && d.capacity === capacity
  ).map((d) => {
    const trendMatch = d.trends.filter((t) => normalizedTrends.has(normalize(t)));
    const score = trendMatch.length > 0 ? trendMatch.length : 0.5;
    return { idea: d, trendMatch: trendMatch.length > 0 ? trendMatch : d.trends.slice(0, 1), score };
  });

  const sorted = scored.sort((a, b) => b.score - a.score);
  const selected = sorted.slice(0, maxSuggestions);

  const suggestions: NewDishSuggestion[] = selected.map(({ idea, trendMatch }) => ({
    title: isEn ? idea.titleEn : idea.titleNb,
    shortDescription: isEn ? idea.descEn : idea.descNb,
    trendMatch,
    seasonMatch: season,
    capacityMatch: capacity,
    rationale: isEn
      ? `Matches season (${season}), capacity (${capacity}), and trend(s): ${trendMatch.join(", ")}.`
      : `Matcher sesong (${season}), kapasitet (${capacity}) og trend(er): ${trendMatch.join(", ")}.`,
  }));

  if (suggestions.length === 0) {
    const fallback = DISH_IDEAS.filter((d) => d.season === season)[0];
    if (fallback) {
      suggestions.push({
        title: isEn ? fallback.titleEn : fallback.titleNb,
        shortDescription: isEn ? fallback.descEn : fallback.descNb,
        trendMatch: fallback.trends,
        seasonMatch: season,
        capacityMatch: fallback.capacity,
        rationale: isEn
          ? `Suggested for season ${season}; adjust capacity or trends for more options.`
          : `Foreslått for sesong ${season}; juster kapasitet eller trender for flere valg.`,
      });
    }
  }

  const summary = isEn
    ? `${suggestions.length} new dish suggestion(s) for ${season} (capacity: ${capacity}, trends: ${[...normalizedTrends].join(", ") || "any"}).`
    : `${suggestions.length} forslag til nye retter for ${season} (kapasitet: ${capacity}, trender: ${[...normalizedTrends].join(", ") || "alle"}).`;

  return {
    suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
