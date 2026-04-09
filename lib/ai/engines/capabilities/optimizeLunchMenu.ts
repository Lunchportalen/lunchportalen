/**
 * AI Lunch Menu Optimizer capability: optimizeLunchMenu.
 * Analyserer: historiske bestillinger, sesong, vær, kontorvaner – og foreslår optimal lunsjmeny.
 * Ekstremt relevant for Lunchportalen. Deterministic; no LLM.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "optimizeLunchMenu";

const optimizeLunchMenuCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Lunch menu optimizer: analyzes historical orders, season, weather, and office habits to suggest an optimal lunch menu. Returns recommended dishes per day, rationale, and summary. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Optimize lunch menu input",
    properties: {
      historicalOrders: {
        type: "array",
        description: "Aggregated order counts per dish/choice (dishId or title, count, optional period)",
        items: {
          type: "object",
          properties: {
            dishId: { type: "string" },
            title: { type: "string", description: "Display name" },
            count: { type: "number" },
            period: { type: "string", description: "e.g. week-1, 2024-01" },
          },
        },
      },
      season: {
        type: "string",
        enum: ["vår", "sommer", "høst", "vinter"],
        description: "Sesong for menyen",
      },
      weather: {
        type: "string",
        enum: ["varmt", "kaldt", "regn", "neutral"],
        description: "Værsignal (valgfritt)",
      },
      officeHabits: {
        type: "object",
        description: "Kontorvaner / preferanser",
        properties: {
          officeSize: { type: "number", description: "Antall personer (størrelse)" },
          preferredCuisine: { type: "array", items: { type: "string" } },
          dietarySummary: { type: "string", description: "F.eks. vegetar andel, allergier" },
        },
      },
      candidateDishes: {
        type: "array",
        description: "Kandidatretter å velge fra (title, id, optional tags)",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["historicalOrders", "season"],
  },
  outputSchema: {
    type: "object",
    description: "Suggested lunch menu",
    required: ["suggestedDays", "rationale", "summary", "generatedAt"],
    properties: {
      suggestedDays: {
        type: "array",
        items: {
          type: "object",
          required: ["dayLabel", "recommendedDishes", "rationale"],
          properties: {
            dayLabel: { type: "string" },
            recommendedDishes: { type: "array", items: { type: "string" } },
            rationale: { type: "string" },
          },
        },
      },
      rationale: { type: "string" },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is menu suggestions only; no orders or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(optimizeLunchMenuCapability);

export type Season = "vår" | "sommer" | "høst" | "vinter";
export type WeatherHint = "varmt" | "kaldt" | "regn" | "neutral";

export type HistoricalOrderEntry = {
  dishId?: string | null;
  title?: string | null;
  count: number;
  period?: string | null;
};

export type OfficeHabitsInput = {
  officeSize?: number | null;
  preferredCuisine?: string[] | null;
  dietarySummary?: string | null;
};

export type CandidateDish = {
  id?: string | null;
  title: string;
  tags?: string[] | null;
};

export type OptimizeLunchMenuInput = {
  historicalOrders: HistoricalOrderEntry[];
  season: Season;
  weather?: WeatherHint | null;
  officeHabits?: OfficeHabitsInput | null;
  candidateDishes?: CandidateDish[] | null;
  locale?: "nb" | "en" | null;
};

export type SuggestedDay = {
  dayLabel: string;
  recommendedDishes: string[];
  rationale: string;
};

export type OptimizeLunchMenuOutput = {
  suggestedDays: SuggestedDay[];
  rationale: string;
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Suggests optimal lunch menu from historical orders, season, weather, and office habits. Deterministic.
 */
export function optimizeLunchMenu(input: OptimizeLunchMenuInput): OptimizeLunchMenuOutput {
  const isEn = input.locale === "en";
  const season = input.season;
  const weather = input.weather ?? "neutral";

  const orders = Array.isArray(input.historicalOrders) ? input.historicalOrders : [];
  const candidates = Array.isArray(input.candidateDishes) ? input.candidateDishes : [];

  const dayLabels = isEn
    ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    : ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];

  const byTitle = new Map<string, number>();
  for (const o of orders) {
    const title = safeStr(o.title || o.dishId) || "unknown";
    byTitle.set(title, (byTitle.get(title) ?? 0) + safeNum(o.count));
  }

  const sortedByPopularity = [...byTitle.entries()]
    .filter(([t]) => t !== "unknown")
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const candidateTitles =
    candidates.length > 0
      ? candidates.map((c) => safeStr(c.title)).filter(Boolean)
      : [...sortedByPopularity];

  const pool = candidateTitles.length > 0 ? candidateTitles : sortedByPopularity;
  if (pool.length === 0) {
    const fallback = isEn
      ? ["Suggested dish 1", "Suggested dish 2", "Suggested dish 3"]
      : ["Foreslått rett 1", "Foreslått rett 2", "Foreslått rett 3"];
    const suggestedDays: SuggestedDay[] = dayLabels.map((dayLabel, i) => ({
      dayLabel,
      recommendedDishes: [fallback[i % fallback.length]],
      rationale: isEn
        ? "No historical data; add orders and candidate dishes for data-driven suggestions."
        : "Ingen historikk; legg inn bestillinger og kandidatretter for datadrevne forslag.",
    }));
    return {
      suggestedDays,
      rationale: isEn ? "No order history; using placeholder suggestions." : "Ingen bestillingshistorikk; bruker plassholderforslag.",
      summary: isEn
        ? "Lunch menu suggestion: 5 days. Add historical orders and candidate dishes for better recommendations."
        : "Lunsjmeny-forslag: 5 dager. Legg inn historiske bestillinger og kandidatretter for bedre anbefalinger.",
      generatedAt: new Date().toISOString(),
    };
  }

  const seasonHint =
    season === "sommer"
      ? isEn ? "Lighter, fresh options suit summer." : "Lettre, friske valg passer til sommeren."
      : season === "vinter"
        ? isEn ? "Warmer, hearty options suit winter." : "Varmere, mettende valg passer til vinter."
        : season === "vår" || season === "høst"
          ? isEn ? "Varied, seasonal balance." : "Variert, sesongbalanse."
          : "";

  const weatherHint =
    weather === "varmt"
      ? isEn ? "Prefer lighter dishes in warm weather." : "Foretrekk lettere retter ved varmt vær."
      : weather === "kaldt"
        ? isEn ? "Prefer warmer, filling dishes in cold weather." : "Foretrekk varmere, mettende retter ved kaldt vær."
        : "";

  const suggestedDays: SuggestedDay[] = [];
  const used = new Set<string>();
  for (let i = 0; i < dayLabels.length; i++) {
    const dayLabel = dayLabels[i];
    const available = pool.filter((t) => !used.has(t));
    const pick = available.length > 0 ? available.slice(0, 2) : [pool[i % pool.length]];
    pick.forEach((t) => used.add(t));
    if (pick.length === 0 && pool.length > 0) pick.push(pool[i % pool.length]);
    const rationale = [seasonHint, weatherHint]
      .filter(Boolean)
      .join(" ")
      .trim() || (isEn ? "Based on historical order popularity and variety." : "Basert på historisk bestillingspopularitet og variasjon.");
    suggestedDays.push({
      dayLabel,
      recommendedDishes: pick,
      rationale: rationale || (isEn ? "Popular choices; variety across the week." : "Populære valg; variasjon gjennom uken."),
    });
  }

  const rationale = isEn
    ? `Season: ${season}. ${weather !== "neutral" ? `Weather: ${weather}. ` : ""}Suggestions use top historical orders and variety. ${input.officeHabits?.officeSize ? `Office size: ${input.officeHabits.officeSize}. ` : ""}`
    : `Sesong: ${season}. ${weather !== "neutral" ? `Vær: ${weather}. ` : ""}Forslag bygger på topphistorikk og variasjon. ${input.officeHabits?.officeSize ? `Kontorstørrelse: ${input.officeHabits.officeSize}. ` : ""}`;

  const summary = isEn
    ? `Optimal lunch menu: 5 days, ${pool.length} dish(es) in pool. ${season} season${weather !== "neutral" ? `, ${weather} weather` : ""}.`
    : `Optimal lunsjmeny: 5 dager, ${pool.length} rett(er) i puljen. Sesong ${season}${weather !== "neutral" ? `, vær ${weather}` : ""}.`;

  return {
    suggestedDays,
    rationale: rationale.trim(),
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { optimizeLunchMenuCapability, CAPABILITY_NAME };
