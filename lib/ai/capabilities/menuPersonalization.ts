/**
 * AI Menu Personalization capability: getPersonalizedMenuForCompany.
 * Automatisk menytilpasning per firma basert på historikk.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";
import { analyzeOfficeCulture } from "./officeCultureAnalyzer";
import type { DishChoiceWithTags } from "./officeCultureAnalyzer";

const CAPABILITY_NAME = "menuPersonalization";

const menuPersonalizationCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Menu personalization: automatic menu adaptation per company based on order history. Uses culture profile and popularity. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Menu personalization input (per company)",
    properties: {
      companyId: { type: "string" },
      companyName: { type: "string" },
      historicalDishChoices: {
        type: "array",
        description: "Order counts per dish (and optional tags)",
        items: {
          type: "object",
          properties: {
            dishId: { type: "string" },
            title: { type: "string" },
            count: { type: "number" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
      candidateDishes: {
        type: "array",
        description: "Optional pool of dishes to recommend from",
        items: { type: "object", properties: { dishId: { type: "string" }, title: { type: "string" }, tags: { type: "array" } } },
      },
      periodLabel: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["historicalDishChoices"],
  },
  outputSchema: {
    type: "object",
    description: "Personalized menu for company",
    required: [
      "recommendedDishes",
      "avoidOrReduce",
      "personalizationSummary",
      "menuHints",
      "summary",
      "generatedAt",
    ],
    properties: {
      recommendedDishes: { type: "array", items: { type: "object" } },
      avoidOrReduce: { type: "array", items: { type: "object" } },
      personalizationSummary: { type: "string" },
      menuHints: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestions_only",
      description: "Output is personalized menu suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(menuPersonalizationCapability);

export type MenuPersonalizationDishInput = {
  dishId?: string | null;
  title?: string | null;
  count: number;
  tags?: string[] | null;
};

export type MenuPersonalizationInput = {
  companyId?: string | null;
  companyName?: string | null;
  historicalDishChoices: MenuPersonalizationDishInput[];
  candidateDishes?: MenuPersonalizationDishInput[] | null;
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type PersonalizedDishItem = {
  dishId: string | null;
  title: string;
  reason: string;
  orderCount?: number | null;
};

export type MenuPersonalizationOutput = {
  recommendedDishes: PersonalizedDishItem[];
  avoidOrReduce: PersonalizedDishItem[];
  personalizationSummary: string;
  menuHints: string[];
  summary: string;
  generatedAt: string;
};

const TOP_RECOMMEND = 12;
const AVOID_IF_BELOW_SHARE = 0.02;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Returns personalized menu for company based on order history. Deterministic.
 */
export function getPersonalizedMenuForCompany(
  input: MenuPersonalizationInput
): MenuPersonalizationOutput {
  const isEn = input.locale === "en";
  const history = Array.isArray(input.historicalDishChoices) ? input.historicalDishChoices : [];
  const candidates = Array.isArray(input.candidateDishes) ? input.candidateDishes : [];
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "the period" : "perioden");
  const companyName = safeStr(input.companyName) || safeStr(input.companyId) || (isEn ? "this company" : "dette firmaet");

  const cultureInput: { dishChoices: DishChoiceWithTags[]; companyId?: string | null; periodLabel?: string | null; locale?: "nb" | "en" | null } = {
    dishChoices: history.map((d) => ({
      dishId: d.dishId,
      title: d.title,
      count: safeNum(d.count),
      tags: d.tags ?? undefined,
    })),
    companyId: input.companyId,
    periodLabel: input.periodLabel,
    locale: input.locale,
  };
  const profile = analyzeOfficeCulture(cultureInput);

  const byTitle = new Map<string, { dishId: string | null; count: number }>();
  for (const d of history) {
    const title = safeStr(d.title || d.dishId) || "unknown";
    if (title === "unknown") continue;
    const dishId = safeStr(d.dishId) || null;
    const count = safeNum(d.count);
    const cur = byTitle.get(title);
    byTitle.set(title, { dishId, count: (cur?.count ?? 0) + count });
  }
  const totalOrders = [...byTitle.values()].reduce((s, x) => s + x.count, 0);

  const sorted = [...byTitle.entries()]
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  const recommendedDishes: PersonalizedDishItem[] = sorted
    .slice(0, TOP_RECOMMEND)
    .map(([title, { dishId, count }]) => ({
      dishId,
      title,
      orderCount: count,
      reason: isEn
        ? `Popular at your office (${count} orders in ${periodLabel}).`
        : `Populær hos dere (${count} bestillinger i ${periodLabel}).`,
    }));

  const threshold = totalOrders > 0 ? totalOrders * AVOID_IF_BELOW_SHARE : 0;
  const avoidOrReduce: PersonalizedDishItem[] = sorted
    .filter(([, v]) => v.count <= Math.max(1, threshold))
    .slice(-5)
    .map(([title, { dishId, count }]) => ({
      dishId,
      title,
      orderCount: count,
      reason: isEn
        ? `Very low uptake (${count}); consider reducing or replacing.`
        : `Svært lav opptak (${count}); vurder å redusere eller erstatte.`,
    }));

  const personalizationSummary = profile.summary;
  const menuHints = profile.menuHints;

  const summary = isEn
    ? `Personalized menu for ${companyName}: ${recommendedDishes.length} recommended, ${avoidOrReduce.length} to consider reducing. Based on ${periodLabel}.`
    : `Tilpasset meny for ${companyName}: ${recommendedDishes.length} anbefalt, ${avoidOrReduce.length} å vurdere å redusere. Basert på ${periodLabel}.`;

  return {
    recommendedDishes,
    avoidOrReduce,
    personalizationSummary,
    menuHints,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
