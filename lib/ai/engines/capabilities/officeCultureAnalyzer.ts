/**
 * AI Office Culture Analyzer capability: analyzeOfficeCulture.
 * AI analyserer preferanser i et selskap: vegetarandel, spicy vs mild, tradisjonell vs moderne mat.
 * Gir personaliserte menyer per firma. Deterministic; no LLM.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "officeCultureAnalyzer";

const officeCultureAnalyzerCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Office culture analyzer: analyzes company preferences—vegetarian share, spicy vs mild, traditional vs modern food—to enable personalized menus per company. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Office culture analyzer input (per company)",
    properties: {
      dishChoices: {
        type: "array",
        description: "Order counts per dish; dishes may have tags: vegetar, spicy, mild, tradisjonell, moderne",
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
      companyId: { type: "string", description: "Optional; for labelling" },
      periodLabel: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["dishChoices"],
  },
  outputSchema: {
    type: "object",
    description: "Office culture profile for personalized menus",
    required: [
      "vegetarianSharePercent",
      "preferenceSpicyVsMild",
      "preferenceTraditionalVsModern",
      "menuHints",
      "summary",
      "generatedAt",
    ],
    properties: {
      vegetarianSharePercent: { type: "number" },
      preferenceSpicyVsMild: { type: "string", enum: ["spicy", "mild", "balanced"] },
      preferenceTraditionalVsModern: { type: "string", enum: ["traditional", "modern", "balanced"] },
      menuHints: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "analytics_only",
      description: "Output is analytics only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(officeCultureAnalyzerCapability);

export type DishChoiceWithTags = {
  dishId?: string | null;
  title?: string | null;
  count: number;
  tags?: string[] | null;
};

export type OfficeCultureAnalyzerInput = {
  dishChoices: DishChoiceWithTags[];
  companyId?: string | null;
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type OfficeCultureProfile = {
  vegetarianSharePercent: number;
  preferenceSpicyVsMild: "spicy" | "mild" | "balanced";
  preferenceTraditionalVsModern: "traditional" | "modern" | "balanced";
  menuHints: string[];
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

function normalizeTag(t: string): string {
  return t.toLowerCase().replace(/\s+/g, "").normalize("NFD").replace(/\u0300-\u036f/g, "");
}

function hasTag(tags: string[] | null | undefined, ...candidates: string[]): boolean {
  const list = Array.isArray(tags) ? tags : [];
  const normalized = list.map(normalizeTag);
  for (const c of candidates) {
    const n = normalizeTag(c);
    if (normalized.some((t) => t.includes(n) || n.includes(t))) return true;
  }
  return false;
}

/**
 * Analyzes office culture from dish choices and tags; returns profile for personalized menus. Deterministic.
 */
export function analyzeOfficeCulture(input: OfficeCultureAnalyzerInput): OfficeCultureProfile {
  const isEn = input.locale === "en";
  const choices = Array.isArray(input.dishChoices) ? input.dishChoices : [];
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "the period" : "perioden");

  let total = 0;
  let vegetarian = 0;
  let spicy = 0;
  let mild = 0;
  let traditional = 0;
  let modern = 0;

  for (const d of choices) {
    const count = Math.max(0, safeNum(d.count));
    if (count <= 0) continue;
    const tags = Array.isArray(d.tags) ? d.tags.map(String) : [];
    total += count;
    if (hasTag(tags, "vegetar", "vegetarian", "veg")) vegetarian += count;
    if (hasTag(tags, "spicy", "sterk", "hot")) spicy += count;
    if (hasTag(tags, "mild", "svak")) mild += count;
    if (hasTag(tags, "tradisjonell", "traditional", "klassisk")) traditional += count;
    if (hasTag(tags, "moderne", "modern", "ny")) modern += count;
  }

  const vegetarianSharePercent =
    total > 0 ? Math.round((vegetarian / total) * 1000) / 10 : 0;
  const spicyTotal = spicy + mild || 1;
  const spicyShare = spicyTotal > 0 ? spicy / spicyTotal : 0.5;
  const preferenceSpicyVsMild: "spicy" | "mild" | "balanced" =
    total > 0 && spicy + mild === 0
      ? "balanced"
      : spicyShare >= 0.6
        ? "spicy"
        : spicyShare <= 0.4
          ? "mild"
          : "balanced";

  const tradModTotal = traditional + modern || 1;
  const tradShare = tradModTotal > 0 ? traditional / tradModTotal : 0.5;
  const preferenceTraditionalVsModern: "traditional" | "modern" | "balanced" =
    total > 0 && traditional + modern === 0
      ? "balanced"
      : tradShare >= 0.6
        ? "traditional"
        : tradShare <= 0.4
          ? "modern"
          : "balanced";

  const menuHints: string[] = [];

  if (vegetarianSharePercent >= 25) {
    menuHints.push(
      isEn
        ? `Include at least one strong vegetarian option daily (${vegetarianSharePercent}% veg preference).`
        : `Inkluder minst én tydelig vegetaralternativ hver dag (${vegetarianSharePercent} % vegetarpreferanse).`
    );
  } else if (vegetarianSharePercent >= 10) {
    menuHints.push(
      isEn
        ? `Offer a vegetarian option regularly (${vegetarianSharePercent}% veg share).`
        : `Tilby vegetaralternativ jevnlig (${vegetarianSharePercent} % vegetarandel).`
    );
  }

  if (preferenceSpicyVsMild === "spicy") {
    menuHints.push(
      isEn
        ? "This office prefers spicier dishes; include chili/pepper options."
        : "Kontoret foretrekker sterkere retter; inkluder chili/pepper-alternativer."
    );
  } else if (preferenceSpicyVsMild === "mild") {
    menuHints.push(
      isEn
        ? "Prefer mild options; limit very spicy dishes."
        : "Foretrekk milde alternativer; begrens svært sterke retter."
    );
  }

  if (preferenceTraditionalVsModern === "traditional") {
    menuHints.push(
      isEn
        ? "Traditional and classic dishes perform well; prioritize familiar flavours."
        : "Tradisjonelle og klassiske retter fungerer godt; prioriter kjente smaker."
    );
  } else if (preferenceTraditionalVsModern === "modern") {
    menuHints.push(
      isEn
        ? "Modern and new dishes are popular; include varied and innovative options."
        : "Moderne og nye retter er populære; inkluder varierte og nysgjerrige alternativer."
    );
  }

  if (menuHints.length === 0) {
    menuHints.push(
      isEn
        ? "Balanced preferences; vary vegetarian, spice level, and style."
        : "Balanserte preferanser; varier vegetar, styrke og stil."
    );
  }

  const summary =
    isEn
      ? `Office profile for ${periodLabel}: ${vegetarianSharePercent}% vegetarian preference, ${preferenceSpicyVsMild}, ${preferenceTraditionalVsModern}. Use for personalized menus.`
      : `Kontorprofil for ${periodLabel}: ${vegetarianSharePercent} % vegetarpreferanse, ${preferenceSpicyVsMild}, ${preferenceTraditionalVsModern}. Bruk til personaliserte menyer.`;

  return {
    vegetarianSharePercent,
    preferenceSpicyVsMild,
    preferenceTraditionalVsModern,
    menuHints,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
