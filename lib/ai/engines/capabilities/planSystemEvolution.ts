/**
 * System evolution engine capability: planSystemEvolution.
 * Plans system evolution from current state, pain points, goals, and constraints.
 * Returns phased evolution plan with initiatives and principles. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "planSystemEvolution";

const planSystemEvolutionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Plans system evolution from current state, pain points, goals, and constraints. Returns phased plan with initiatives (architecture, observability, resilience, scale), principles, and outcomes. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "System evolution planning input",
    properties: {
      systemContext: {
        type: "object",
        description: "Current system context",
        properties: {
          name: { type: "string" },
          techStack: { type: "array", items: { type: "string" } },
          currentState: { type: "string", description: "Brief state description" },
        },
      },
      painPoints: { type: "array", items: { type: "string" }, description: "Current pain points or risks" },
      goals: { type: "array", items: { type: "string" }, description: "Evolution goals" },
      constraints: { type: "array", items: { type: "string" } },
      horizonQuarters: { type: "number", description: "Planning horizon (default 4)" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "System evolution plan",
    required: ["phases", "principles", "summary", "generatedAt"],
    properties: {
      phases: {
        type: "array",
        items: {
          type: "object",
          required: ["phaseName", "theme", "initiatives", "outcomes"],
          properties: {
            phaseName: { type: "string" },
            theme: { type: "string" },
            initiatives: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  category: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
            outcomes: { type: "array", items: { type: "string" } },
          },
        },
      },
      principles: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is plan only; no system or infrastructure mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(planSystemEvolutionCapability);

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

const PHASE_THEMES_EN = ["Foundation and stability", "Observability and resilience", "Scale and efficiency", "Evolution and optionality"];
const PHASE_THEMES_NB = ["Grunnlag og stabilitet", "Observability og resiliens", "Skalering og effektivitet", "Evolusjon og valgfrihet"];

const PAIN_TO_INITIATIVES_EN: Record<string, { title: string; category: string; description: string }> = {
  scalability: { title: "Scale infrastructure and data", category: "scale", description: "Horizontal scaling, DB tuning, caching strategy." },
  reliability: { title: "Improve reliability and redundancy", category: "resilience", description: "Failover, health checks, runbooks." },
  observability: { title: "Add observability and alerting", category: "observability", description: "Metrics, logs, traces, alerting." },
  performance: { title: "Optimize performance and latency", category: "performance", description: "Profile, optimize hot paths, caching." },
  security: { title: "Harden security and compliance", category: "security", description: "Auth, secrets, audit, compliance checks." },
  maintainability: { title: "Improve maintainability and docs", category: "architecture", description: "Documentation, standards, tech debt." },
};

const PAIN_TO_INITIATIVES_NB: Record<string, { title: string; category: string; description: string }> = {
  scalability: { title: "Skaler infrastruktur og data", category: "scale", description: "Horisontal skalering, DB-optimalisering, cache-strategi." },
  reliability: { title: "Forbedre pålitelighet og redundans", category: "resilience", description: "Failover, helsesjekker, runbooks." },
  observability: { title: "Legg til observability og varsling", category: "observability", description: "Måltall, logger, tracing, varsling." },
  performance: { title: "Optimaliser ytelse og latency", category: "performance", description: "Profilering, optimalisering, caching." },
  security: { title: "Styrk sikkerhet og compliance", category: "security", description: "Auth, hemmeligheter, revisjon, compliance." },
  maintainability: { title: "Forbedre vedlikehold og dokumentasjon", category: "architecture", description: "Dokumentasjon, standarder, teknisk gjeld." },
};

export type SystemContextInput = {
  name?: string | null;
  techStack?: string[] | null;
  currentState?: string | null;
};

export type PlanSystemEvolutionInput = {
  systemContext?: SystemContextInput | null;
  painPoints?: string[] | null;
  goals?: string[] | null;
  constraints?: string[] | null;
  horizonQuarters?: number | null;
  locale?: "nb" | "en" | null;
};

export type EvolutionInitiative = {
  id: string;
  title: string;
  category: string;
  description: string;
};

export type EvolutionPhase = {
  phaseName: string;
  theme: string;
  initiatives: EvolutionInitiative[];
  outcomes: string[];
};

export type PlanSystemEvolutionOutput = {
  phases: EvolutionPhase[];
  principles: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Plans system evolution from context, pain points, and goals. Deterministic; no external calls.
 */
export function planSystemEvolution(input: PlanSystemEvolutionInput): PlanSystemEvolutionOutput {
  const isEn = input.locale === "en";
  const ctx = input.systemContext && typeof input.systemContext === "object" ? input.systemContext : {};
  const painPoints = Array.isArray(input.painPoints) ? input.painPoints.map(safeStr).filter(Boolean) : [];
  const goals = Array.isArray(input.goals) ? input.goals.map(safeStr).filter(Boolean) : [];
  const horizon = typeof input.horizonQuarters === "number" && input.horizonQuarters > 0
    ? Math.min(input.horizonQuarters, 6)
    : 4;

  const initiativeMap = isEn ? PAIN_TO_INITIATIVES_EN : PAIN_TO_INITIATIVES_NB;
  const themes = isEn ? PHASE_THEMES_EN : PHASE_THEMES_NB;

  const collectedInitiatives: EvolutionInitiative[] = [];
  const seen = new Set<string>();
  for (const p of painPoints) {
    for (const [key, init] of Object.entries(initiativeMap)) {
      if (p.includes(key) && !seen.has(key)) {
        seen.add(key);
        collectedInitiatives.push({
          id: `evol-${key}`,
          title: init.title,
          category: init.category,
          description: init.description,
        });
      }
    }
  }

  if (collectedInitiatives.length === 0) {
    collectedInitiatives.push(
      {
        id: "evol-observability",
        title: isEn ? "Establish observability baseline" : "Etabler observability-baseline",
        category: "observability",
        description: isEn ? "Metrics, logging, and alerting for system health." : "Måltall, logging og varsling for systemhelse.",
      },
      {
        id: "evol-resilience",
        title: isEn ? "Improve resilience and failover" : "Forbedre resiliens og failover",
        category: "resilience",
        description: isEn ? "Health checks, runbooks, and redundancy where critical." : "Helsesjekker, runbooks og redundans der kritisk.",
      },
    );
  }

  const categoriesOrder = ["architecture", "observability", "resilience", "performance", "security", "scale"];
  const byCategory = (a: EvolutionInitiative, b: EvolutionInitiative) =>
    categoriesOrder.indexOf(a.category) - categoriesOrder.indexOf(b.category);
  collectedInitiatives.sort(byCategory);

  const initiativesPerPhase = Math.max(1, Math.ceil(collectedInitiatives.length / horizon));
  const phases: EvolutionPhase[] = [];
  for (let q = 0; q < horizon; q++) {
    const start = q * initiativesPerPhase;
    const slice = collectedInitiatives.slice(start, start + initiativesPerPhase);
    const phaseName = isEn ? `Phase ${q + 1}` : `Fase ${q + 1}`;
    const theme = themes[q % themes.length] ?? phaseName;
    const outcomes = slice.map((i) => (isEn ? `Deliver: ${i.title}` : `Lever: ${i.title}`));
    phases.push({
      phaseName,
      theme,
      initiatives: slice,
      outcomes,
    });
  }

  const principles: string[] = [
    isEn ? "Single source of truth; avoid drift between envs and docs." : "Én sannhetskilde; unngå drift mellom miljøer og dokumentasjon.",
    isEn ? "Fail closed; never guess when uncertain." : "Fail closed; aldri gjett ved usikkerhet.",
    isEn ? "Measure before and after; evidence-based evolution." : "Mål før og etter; evidensbasert evolusjon.",
  ];

  const systemName = safeStr(ctx.name) || (isEn ? "System" : "System");
  const summary = isEn
    ? `System evolution plan for ${systemName}: ${horizon} phase(s), ${collectedInitiatives.length} initiative(s).`
    : `Systemevolusjonsplan for ${systemName}: ${horizon} fase(r), ${collectedInitiatives.length} initiativ.`;

  return {
    phases,
    principles,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { planSystemEvolutionCapability, CAPABILITY_NAME };
