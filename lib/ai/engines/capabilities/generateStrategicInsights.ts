/**
 * AI strategic advisor capability: generateStrategicInsights.
 * Generates strategic insights from goals, strengths, weaknesses, opportunities, and threats.
 * Returns insights, priorities, risks, and opportunities. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateStrategicInsights";

const generateStrategicInsightsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates strategic insights from goals, strengths, weaknesses, opportunities, and threats (SWOT-like). Returns insights by type (opportunity, risk, priority, recommendation), priorities, and summary. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Strategic insights input",
    properties: {
      context: {
        type: "object",
        properties: {
          name: { type: "string", description: "Company or product name" },
          market: { type: "string" },
          timeHorizon: { type: "string", description: "e.g. 12 months, 2 years" },
        },
      },
      goals: { type: "array", items: { type: "string" } },
      strengths: { type: "array", items: { type: "string" } },
      weaknesses: { type: "array", items: { type: "string" } },
      opportunities: { type: "array", items: { type: "string" } },
      threats: { type: "array", items: { type: "string" } },
      keyMetrics: {
        type: "array",
        description: "Optional metric labels or values for context",
        items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } } },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Strategic insights result",
    required: ["insights", "priorities", "risks", "opportunities", "summary", "generatedAt"],
    properties: {
      insights: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type", "title", "description", "priority"],
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["opportunity", "risk", "priority", "recommendation"] },
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
      },
      priorities: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      opportunities: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is advisory only; no business or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(generateStrategicInsightsCapability);

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export type StrategicContextInput = {
  name?: string | null;
  market?: string | null;
  timeHorizon?: string | null;
};

export type GenerateStrategicInsightsInput = {
  context?: StrategicContextInput | null;
  goals?: string[] | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  opportunities?: string[] | null;
  threats?: string[] | null;
  keyMetrics?: { label?: string | null; value?: string | null }[] | null;
  locale?: "nb" | "en" | null;
};

export type StrategicInsight = {
  id: string;
  type: "opportunity" | "risk" | "priority" | "recommendation";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
};

export type GenerateStrategicInsightsOutput = {
  insights: StrategicInsight[];
  priorities: string[];
  risks: string[];
  opportunities: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Generates strategic insights from goals and SWOT-like inputs. Deterministic; no external calls.
 */
export function generateStrategicInsights(input: GenerateStrategicInsightsInput): GenerateStrategicInsightsOutput {
  const isEn = input.locale === "en";
  const ctx = input.context && typeof input.context === "object" ? input.context : {};
  const goals = Array.isArray(input.goals) ? input.goals.map(safeStr).filter(Boolean) : [];
  const strengths = Array.isArray(input.strengths) ? input.strengths.map(safeStr).filter(Boolean) : [];
  const weaknesses = Array.isArray(input.weaknesses) ? input.weaknesses.map(safeStr).filter(Boolean) : [];
  const opportunities = Array.isArray(input.opportunities) ? input.opportunities.map(safeStr).filter(Boolean) : [];
  const threats = Array.isArray(input.threats) ? input.threats.map(safeStr).filter(Boolean) : [];

  const insights: StrategicInsight[] = [];
  const priorities: string[] = [];
  let idSeq = 1;

  const name = safeStr(ctx.name) || (isEn ? "Organization" : "Organisasjon");

  if (goals.length > 0) {
    insights.push({
      id: `insight-${idSeq++}`,
      type: "priority",
      title: isEn ? "Align initiatives to top goals" : "Juster initiativer mot toppmål",
      description: isEn ? `Focus execution on: ${goals.slice(0, 3).join("; ")}. Avoid scope creep.` : `Fokuser utførelse på: ${goals.slice(0, 3).join("; ")}. Unngå scope creep.`,
      priority: "high",
    });
    priorities.push(isEn ? "Execute against stated goals; measure progress." : "Utfør mot statede mål; mål fremgang.");
  }

  for (const o of opportunities.slice(0, 5)) {
    insights.push({
      id: `insight-${idSeq++}`,
      type: "opportunity",
      title: o.length > 60 ? o.slice(0, 57) + "…" : o,
      description: o,
      priority: "medium",
    });
  }

  for (const t of threats.slice(0, 5)) {
    insights.push({
      id: `insight-${idSeq++}`,
      type: "risk",
      title: t.length > 60 ? t.slice(0, 57) + "…" : t,
      description: t,
      priority: "high",
    });
  }

  if (weaknesses.length > 0) {
    insights.push({
      id: `insight-${idSeq++}`,
      type: "recommendation",
      title: isEn ? "Address critical weaknesses" : "Adresser kritiske svakheter",
      description: isEn ? `Weaknesses to mitigate: ${weaknesses.slice(0, 3).join("; ")}. Prioritize by impact on goals.` : `Svakheter å dempe: ${weaknesses.slice(0, 3).join("; ")}. Prioriter etter påvirkning på mål.`,
      priority: weaknesses.length >= 3 ? "high" : "medium",
    });
    priorities.push(isEn ? "Reduce exposure from weaknesses; build on strengths." : "Reduser eksponering fra svakheter; bygg på styrker.");
  }

  if (strengths.length > 0 && opportunities.length > 0) {
    insights.push({
      id: `insight-${idSeq++}`,
      type: "recommendation",
      title: isEn ? "Leverage strengths to capture opportunities" : "Utnytt styrker for å fange muligheter",
      description: isEn ? "Match strengths to opportunities for higher chance of success; avoid overreach." : "Match styrker mot muligheter for høyere suksesssjanse; unngå overstrekk.",
      priority: "medium",
    });
  }

  insights.push({
    id: `insight-${idSeq++}`,
    type: "recommendation",
    title: isEn ? "Maintain calm, evidence-based strategy" : "Behold rolig, evidensbasert strategi",
    description: isEn ? "Base decisions on data and single source of truth; no hype or unrealistic promises (AGENTS.md S7)." : "Baser beslutninger på data og én sannhetskilde; ingen hype eller urealistiske løfter (AGENTS.md S7).",
    priority: "high",
  });

  const risks = threats.length > 0 ? [...threats] : [isEn ? "Unmitigated threats or weak signals." : "Udemperte trusler eller svake signaler."];
  const opps = opportunities.length > 0 ? [...opportunities] : [isEn ? "Capture opportunities aligned with strengths and goals." : "Fang muligheter i tråd med styrker og mål."];

  if (priorities.length === 0) {
    priorities.push(isEn ? "Define and communicate top 3 priorities for the horizon." : "Definer og kommuniser topp 3 prioriteringer for horisonten.");
  }

  const summary = isEn
    ? `Strategic insights for ${name}: ${insights.length} insight(s), ${priorities.length} priority(ies). ${risks.length} risk(s), ${opps.length} opportunity(ies).`
    : `Strategiske innsikter for ${name}: ${insights.length} innsikt(er), ${priorities.length} prioritet(er). ${risks.length} risiko(er), ${opps.length} mulighet(er).`;

  return {
    insights,
    priorities,
    risks,
    opportunities: opps,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateStrategicInsightsCapability, CAPABILITY_NAME };
