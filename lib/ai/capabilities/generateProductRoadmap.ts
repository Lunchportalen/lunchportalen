/**
 * Roadmap planning AI capability: generateProductRoadmap.
 * Generates a product roadmap from initiatives, goals, horizon, and constraints.
 * Returns phased roadmap (by quarter or phase) with assigned initiatives. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateProductRoadmap";

const generateProductRoadmapCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates a product roadmap from initiatives (with priority and optional dependencies), goals, and horizon. Returns phased roadmap by quarter with assigned initiatives and themes. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Roadmap generation input",
    properties: {
      productName: { type: "string", description: "Product or product area name" },
      initiatives: {
        type: "array",
        description: "Initiatives or features to place on roadmap",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            category: { type: "string", description: "e.g. usability, reporting" },
            dependencyIds: { type: "array", items: { type: "string" }, description: "IDs that must complete before this" },
          },
        },
      },
      goals: { type: "array", items: { type: "string" } },
      horizonQuarters: { type: "number", description: "Number of quarters to plan (default 4)" },
      constraints: { type: "array", items: { type: "string" } },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["initiatives"],
  },
  outputSchema: {
    type: "object",
    description: "Generated product roadmap",
    required: ["phases", "timeline", "summary", "generatedAt"],
    properties: {
      phases: {
        type: "array",
        items: {
          type: "object",
          required: ["quarter", "theme", "initiatives", "summary"],
          properties: {
            quarter: { type: "string", description: "e.g. Q1 2025" },
            theme: { type: "string" },
            initiatives: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  priority: { type: "string" },
                  category: { type: "string" },
                },
              },
            },
            summary: { type: "string" },
          },
        },
      },
      timeline: {
        type: "object",
        description: "Quarter -> list of initiative ids",
        additionalProperties: { type: "array", items: { type: "string" } },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is roadmap plan only; no product or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(generateProductRoadmapCapability);

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const PHASE_THEMES_EN = ["Foundation and discovery", "Core delivery", "Scale and optimize", "Differentiate and expand"];
const PHASE_THEMES_NB = ["Grunnlag og oppdagelse", "Kjernelevering", "Skalering og optimalisering", "Differensiering og utvidelse"];

export type InitiativeInput = {
  id?: string | null;
  title?: string | null;
  priority?: string | null;
  category?: string | null;
  dependencyIds?: string[] | null;
};

export type GenerateProductRoadmapInput = {
  productName?: string | null;
  initiatives: InitiativeInput[];
  goals?: string[] | null;
  horizonQuarters?: number | null;
  constraints?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type RoadmapInitiative = {
  id: string;
  title: string;
  priority: string;
  category: string;
};

export type RoadmapPhase = {
  quarter: string;
  theme: string;
  initiatives: RoadmapInitiative[];
  summary: string;
};

export type GenerateProductRoadmapOutput = {
  phases: RoadmapPhase[];
  timeline: Record<string, string[]>;
  summary: string;
  generatedAt: string;
};

/**
 * Generates product roadmap from initiatives and horizon. Deterministic; no external calls.
 */
export function generateProductRoadmap(input: GenerateProductRoadmapInput): GenerateProductRoadmapOutput {
  const isEn = input.locale === "en";
  const productName = safeStr(input.productName) || (isEn ? "Product" : "Produkt");
  const horizon = typeof input.horizonQuarters === "number" && input.horizonQuarters > 0
    ? Math.min(input.horizonQuarters, 8)
    : 4;

  const raw = Array.isArray(input.initiatives) ? input.initiatives.filter((i) => i && typeof i === "object") : [];
  const initiatives: { id: string; title: string; priority: string; category: string; dependencyIds: string[] }[] = [];

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const id = safeStr(r.id) || `init-${i + 1}`;
    const title = safeStr(r.title) || id;
    const priority = r.priority === "high" || r.priority === "medium" || r.priority === "low" ? r.priority : "medium";
    const category = safeStr(r.category) || "other";
    const dependencyIds = Array.isArray(r.dependencyIds) ? r.dependencyIds.map(safeStr).filter(Boolean) : [];
    initiatives.push({ id, title, priority, category, dependencyIds });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...initiatives].sort((a, b) => {
    const aHasDep = a.dependencyIds.length > 0 ? 1 : 0;
    const bHasDep = b.dependencyIds.length > 0 ? 1 : 0;
    if (aHasDep !== bHasDep) return aHasDep - bHasDep;
    return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
  });

  const idToIndex = new Map<string, number>();
  sorted.forEach((init, idx) => idToIndex.set(init.id, idx));

  const assigned = new Set<string>();
  const byQuarter: RoadmapInitiative[][] = Array.from({ length: horizon }, () => []);

  for (const init of sorted) {
    if (assigned.has(init.id)) continue;
    let slot = 0;
    for (const depId of init.dependencyIds) {
      const depIdx = idToIndex.get(depId);
      if (depIdx !== undefined) {
        for (let q = 0; q < horizon; q++) {
          if (byQuarter[q].some((x) => x.id === depId)) {
            slot = Math.max(slot, q + 1);
            break;
          }
        }
      }
    }
    slot = Math.min(slot, horizon - 1);
    while (slot < horizon && byQuarter[slot].length >= 4) slot++;
    if (slot >= horizon) slot = horizon - 1;
    byQuarter[slot].push({
      id: init.id,
      title: init.title,
      priority: init.priority,
      category: init.category,
    });
    assigned.add(init.id);
  }

  const phases: RoadmapPhase[] = [];
  const timeline: Record<string, string[]> = {};
  const themes = isEn ? PHASE_THEMES_EN : PHASE_THEMES_NB;

  const now = new Date();
  const startYear = now.getFullYear();
  const startQ = Math.floor(now.getMonth() / 3) + 1;

  for (let q = 0; q < horizon; q++) {
    const qNum = ((startQ - 1 + q) % 4) + 1;
    const year = startYear + Math.floor((startQ - 1 + q) / 4);
    const quarterLabel = `Q${qNum} ${year}`;
    const theme = themes[q % themes.length] ?? (isEn ? `Phase ${q + 1}` : `Fase ${q + 1}`);
    const items = byQuarter[q];
    timeline[quarterLabel] = items.map((i) => i.id);
    phases.push({
      quarter: quarterLabel,
      theme,
      initiatives: items,
      summary: items.length > 0
        ? (isEn ? `${items.length} initiative(s): ` : `${items.length} initiativ: `) + items.map((i) => i.title).join("; ")
        : (isEn ? "Buffer or discovery" : "Buffer eller oppdagelse"),
    });
  }

  const summary = isEn
    ? `Roadmap for ${productName}: ${horizon} quarter(s), ${initiatives.length} initiative(s) placed.`
    : `Roadmap for ${productName}: ${horizon} kvartal(er), ${initiatives.length} initiativ plassert.`;

  return {
    phases,
    timeline,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateProductRoadmapCapability, CAPABILITY_NAME };
