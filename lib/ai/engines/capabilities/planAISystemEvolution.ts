/**
 * AI evolution planner capability: planAISystemEvolution.
 * Produces a phased evolution plan from current state (capabilities, goals, metrics, constraints).
 * Returns phases, objectives, initiatives, priorities, and risks. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "planAISystemEvolution";

const planAISystemEvolutionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "AI evolution planner: from current state (capabilities, goals, metrics, constraints), produces a phased evolution plan with objectives, initiatives, dependencies, priorities, and risks. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Plan AI system evolution input",
    properties: {
      currentState: {
        type: "object",
        description: "Current AI system state",
        properties: {
          capabilities: {
            type: "array",
            description: "Current capability IDs or names",
            items: { type: "string" },
          },
          goals: {
            type: "array",
            description: "Strategic goals (e.g. improve conversion, reduce risk)",
            items: { type: "string" },
          },
          metrics: {
            type: "object",
            description: "Optional current metrics",
            properties: {
              resilienceScore: { type: "number" },
              complianceScore: { type: "number" },
              errorRate: { type: "number" },
            },
          },
          constraints: {
            type: "object",
            properties: {
              maxPhases: { type: "number" },
              horizonQuarters: { type: "number" },
            },
          },
        },
      },
      horizonQuarters: {
        type: "number",
        description: "Planning horizon in quarters (default: 4)",
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["currentState"],
  },
  outputSchema: {
    type: "object",
    description: "AI system evolution plan",
    required: ["phases", "priorities", "risks", "summary", "generatedAt"],
    properties: {
      phases: {
        type: "array",
        items: {
          type: "object",
          required: ["phaseId", "name", "objectives", "initiatives", "dependencies"],
          properties: {
            phaseId: { type: "string" },
            name: { type: "string" },
            objectives: { type: "array", items: { type: "string" } },
            initiatives: { type: "array", items: { type: "string" } },
            targetQuarter: { type: "string" },
            dependencies: { type: "array", items: { type: "string" } },
          },
        },
      },
      priorities: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is plan only; does not mutate system or config.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(planAISystemEvolutionCapability);

export type CurrentStateInput = {
  capabilities?: string[] | null;
  goals?: string[] | null;
  metrics?: {
    resilienceScore?: number | null;
    complianceScore?: number | null;
    errorRate?: number | null;
  } | null;
  constraints?: {
    maxPhases?: number | null;
    horizonQuarters?: number | null;
  } | null;
};

export type PlanAISystemEvolutionInput = {
  currentState: CurrentStateInput;
  horizonQuarters?: number | null;
  locale?: "nb" | "en" | null;
};

export type EvolutionPhase = {
  phaseId: string;
  name: string;
  objectives: string[];
  initiatives: string[];
  targetQuarter?: string | null;
  dependencies: string[];
};

export type PlanAISystemEvolutionOutput = {
  phases: EvolutionPhase[];
  priorities: string[];
  risks: string[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Builds a phased AI system evolution plan from current state. Deterministic; no external calls.
 */
export function planAISystemEvolution(input: PlanAISystemEvolutionInput): PlanAISystemEvolutionOutput {
  const state = input.currentState && typeof input.currentState === "object" ? input.currentState : {};
  const capabilities = Array.isArray(state.capabilities) ? state.capabilities.map((c) => safeStr(c)).filter(Boolean) : [];
  const goals = Array.isArray(state.goals) ? state.goals.map((g) => safeStr(g)).filter(Boolean) : [];
  const metrics = state.metrics && typeof state.metrics === "object" ? state.metrics : {};
  const horizon = Math.max(1, Math.min(8, Math.floor(Number(input.horizonQuarters) ?? state.constraints?.horizonQuarters ?? 4)));
  const maxPhases = Math.max(1, Math.min(6, Math.floor(Number(state.constraints?.maxPhases) ?? 4)));
  const isEn = input.locale === "en";

  const resilienceScore = metrics.resilienceScore != null ? Number(metrics.resilienceScore) : null;
  const complianceScore = metrics.complianceScore != null ? Number(metrics.complianceScore) : null;
  const errorRate = metrics.errorRate != null ? Number(metrics.errorRate) : null;

  const phases: EvolutionPhase[] = [];
  const priorities: string[] = [];
  const risks: string[] = [];

  const hasMonitoring = capabilities.some((c) => /monitor|detect|audit|compliance|resilience/i.test(c));

  function buildSummary(): string {
    return isEn
      ? `Evolution plan: ${phases.length} phase(s) over ${horizon} quarter(s). ${priorities.length} priority(ies), ${risks.length} risk(s) noted.`
      : `Evolusjonsplan: ${phases.length} fase(r) over ${horizon} kvartal(er). ${priorities.length} prioritet(er), ${risks.length} risiko(er) notert.`;
  }

  if (isEn) {
    if (resilienceScore != null && resilienceScore < 80) {
      priorities.push("Improve system resilience and monitoring before adding new capabilities.");
      risks.push("Low resilience may amplify failures when evolving.");
    }
    if (complianceScore != null && complianceScore < 100) {
      priorities.push("Address compliance gaps before expanding AI usage.");
      risks.push("Compliance gaps can block or delay rollout.");
    }
    if (errorRate != null && errorRate > 0.01) {
      priorities.push("Reduce error rate and stabilize before evolution.");
      risks.push("High error rate increases user and operational risk.");
    }
  } else {
    if (resilienceScore != null && resilienceScore < 80) {
      priorities.push("Forbedre systemresiliens og overvåking før nye capabilities.");
      risks.push("Lav resiliens kan forsterke feil ved utvikling.");
    }
    if (complianceScore != null && complianceScore < 100) {
      priorities.push("Lukk compliance-hull før utvidelse av AI-bruk.");
      risks.push("Compliance-hull kan blokkere eller forsinke utrulling.");
    }
    if (errorRate != null && errorRate > 0.01) {
      priorities.push("Reduser feilrate og stabiliser før evolusjon.");
      risks.push("Høy feilrate øker bruker- og driftsrisiko.");
    }
  }

  let phaseNum = 0;

  if ((!hasMonitoring || (resilienceScore != null && resilienceScore < 80)) && phaseNum < maxPhases) {
    phaseNum++;
    phases.push({
      phaseId: `phase_${phaseNum}`,
      name: isEn ? "Stabilize & monitor" : "Stabiliser og overvåk",
      objectives: isEn
        ? ["Establish baseline resilience and compliance.", "Ensure monitoring and audit trail are in place."]
        : ["Etablere baseline resiliens og compliance.", "Sikre overvåking og sporbarhet."],
      initiatives: isEn
        ? ["Harden monitoring (detectInfraIssues, monitorSystemResilience, monitorCompliance).", "Enable audit trail (auditAIDecisions) and risk checks (detectAIRisk)."]
        : ["Styrk overvåking (detectInfraIssues, monitorSystemResilience, monitorCompliance).", "Aktiver sporbarhet (auditAIDecisions) og risikosjekk (detectAIRisk)."],
      targetQuarter: `Q${phaseNum}`,
      dependencies: [],
    });
  }

  if (phaseNum < maxPhases && (hasMonitoring || phases.length > 0)) {
    phaseNum++;
    phases.push({
      phaseId: `phase_${phaseNum}`,
      name: isEn ? "Optimize & personalize" : "Optimaliser og person tilpass",
      objectives: isEn
        ? ["Improve conversion and relevance with existing capabilities.", "Reduce friction and improve CTA performance."]
        : ["Forbedre konvertering og relevans med eksisterende capabilities.", "Redusere friksjon og forbedre CTA-ytelse."],
      initiatives: isEn
        ? ["Use personalizeCTA, generatePersonalizedContent, suggestNextContent.", "Apply detectConversionFriction and autoImproveCTAs where applicable."]
        : ["Bruk personalizeCTA, generatePersonalizedContent, suggestNextContent.", "Bruk detectConversionFriction og autoImproveCTAs der relevant."],
      targetQuarter: `Q${phaseNum}`,
      dependencies: [phases[0]?.phaseId ?? "phase_1"].filter(Boolean),
    });
  }

  if (phaseNum < maxPhases) {
    phaseNum++;
    phases.push({
      phaseId: `phase_${phaseNum}`,
      name: isEn ? "Expand & evolve" : "Utvid og utvikle",
      objectives: isEn
        ? ["Add or extend capabilities aligned with goals.", "Strengthen policy enforcement and safety."]
        : ["Legge til eller utvide capabilities i tråd med mål.", "Styrke policy-håndhevelse og sikkerhet."],
      initiatives: isEn
        ? ["Prioritize new capabilities from goals; enforce policies (enforceAIPolicies).", "Review detectAIRisk and compliance (monitorCompliance) regularly."]
        : ["Prioriter nye capabilities fra mål; håndhev policy (enforceAIPolicies).", "Gjennomgå detectAIRisk og compliance (monitorCompliance) jevnlig."],
      targetQuarter: `Q${phaseNum}`,
      dependencies: phases.length >= 2 ? [phases[phases.length - 1].phaseId] : ["phase_1"],
    });
  }

  if (goals.length > 0 && isEn) {
    priorities.push(`Align initiatives with stated goals: ${goals.slice(0, 3).join("; ")}.`);
  } else if (goals.length > 0) {
    priorities.push(`Juster initiativer til mål: ${goals.slice(0, 3).join("; ")}.`);
  }

  return {
    phases,
    priorities,
    risks,
    summary: buildSummary(),
    generatedAt: new Date().toISOString(),
  };
}

export { planAISystemEvolutionCapability, CAPABILITY_NAME };
