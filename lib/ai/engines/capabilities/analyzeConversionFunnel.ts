/**
 * AI funnel analysis engine capability: analyzeConversionFunnel.
 * Analyzes funnel stage counts to compute drop-off, identify bottlenecks, and suggest improvements.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "analyzeConversionFunnel";

const analyzeConversionFunnelCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes a conversion funnel from stage counts (e.g. views → interest → consideration → conversion). Computes drop-off per stage, identifies the main bottleneck, overall conversion rate, and returns recommendations.",
  requiredContext: ["stages"],
  inputSchema: {
    type: "object",
    description: "Analyze conversion funnel input",
    properties: {
      stages: {
        type: "array",
        description: "Funnel stages in order (first = top, last = conversion)",
        items: {
          type: "object",
          required: ["id", "name", "count"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            count: { type: "number", description: "Number of users/sessions at this stage" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["stages"],
  },
  outputSchema: {
    type: "object",
    description: "Funnel analysis result",
    required: ["stageMetrics", "bottleneck", "overallConversionRate", "recommendations", "summary"],
    properties: {
      stageMetrics: {
        type: "array",
        items: {
          type: "object",
          required: ["stageId", "stageName", "count", "dropOffRate", "conversionRateToNext"],
          properties: {
            stageId: { type: "string" },
            stageName: { type: "string" },
            count: { type: "number" },
            dropOffRate: { type: "number", description: "0-1 share lost to next stage" },
            conversionRateToNext: { type: "number", description: "0-1 share proceeding" },
          },
        },
      },
      bottleneck: {
        type: "object",
        required: ["stageId", "stageName", "dropOffRate", "message"],
        properties: {
          stageId: { type: "string" },
          stageName: { type: "string" },
          dropOffRate: { type: "number" },
          message: { type: "string" },
        },
      },
      overallConversionRate: { type: "number", description: "0-1, conversions / top-of-funnel" },
      recommendations: {
        type: "array",
        items: { type: "object", properties: { stageId: { type: "string" }, priority: { type: "string" }, message: { type: "string" } } },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(analyzeConversionFunnelCapability);

export type FunnelStageInput = {
  id: string;
  name: string;
  count: number;
};

export type AnalyzeConversionFunnelInput = {
  stages: FunnelStageInput[];
  locale?: "nb" | "en" | null;
};

export type FunnelStageMetric = {
  stageId: string;
  stageName: string;
  count: number;
  dropOffRate: number;
  conversionRateToNext: number;
};

export type FunnelBottleneck = {
  stageId: string;
  stageName: string;
  dropOffRate: number;
  message: string;
};

export type FunnelRecommendation = {
  stageId: string;
  priority: "low" | "medium" | "high";
  message: string;
};

export type AnalyzeConversionFunnelOutput = {
  stageMetrics: FunnelStageMetric[];
  bottleneck: FunnelBottleneck;
  overallConversionRate: number;
  recommendations: FunnelRecommendation[];
  summary: string;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, typeof v === "number" && !Number.isNaN(v) ? v : 0));
}

/**
 * Analyzes conversion funnel from ordered stage counts. Computes drop-off, bottleneck, and recommendations.
 * Deterministic; no external calls.
 */
export function analyzeConversionFunnel(input: AnalyzeConversionFunnelInput): AnalyzeConversionFunnelOutput {
  const isEn = input.locale === "en";
  const stages = Array.isArray(input.stages) ? input.stages : [];
  const valid = stages
    .map((s) => ({
      id: (s.id ?? "").toString().trim(),
      name: (s.name ?? "").toString().trim(),
      count: Math.max(0, Math.floor(Number(s.count) ?? 0)),
    }))
    .filter((s) => s.id);

  const stageMetrics: FunnelStageMetric[] = [];
  let bottleneck: FunnelBottleneck = {
    stageId: "",
    stageName: "",
    dropOffRate: 0,
    message: isEn ? "No funnel data." : "Ingen traktdata.",
  };

  const topCount = valid[0]?.count ?? 0;
  const conversionCount = valid.length > 0 ? (valid[valid.length - 1]?.count ?? 0) : 0;
  const overallConversionRate = topCount > 0 ? clamp01(conversionCount / topCount) : 0;

  let maxDropOff = 0;

  for (let i = 0; i < valid.length; i++) {
    const curr = valid[i];
    const nextCount = valid[i + 1]?.count ?? 0;
    const currCount = curr.count;
    const dropOffRate = currCount > 0 ? clamp01(1 - nextCount / currCount) : 0;
    const conversionRateToNext = currCount > 0 ? clamp01(nextCount / currCount) : 0;

    stageMetrics.push({
      stageId: curr.id,
      stageName: curr.name,
      count: currCount,
      dropOffRate,
      conversionRateToNext,
    });

    if (i < valid.length - 1 && dropOffRate > maxDropOff) {
      maxDropOff = dropOffRate;
      bottleneck = {
        stageId: curr.id,
        stageName: curr.name,
        dropOffRate,
        message: isEn
          ? `Largest drop-off (${Math.round(dropOffRate * 100)}%) between "${curr.name}" and next stage.`
          : `Størst fall (${Math.round(dropOffRate * 100)}%) mellom «${curr.name}» og neste steg.`,
      };
    }
  }

  const recommendations: FunnelRecommendation[] = [];
  if (bottleneck.stageId && bottleneck.dropOffRate >= 0.5) {
    recommendations.push({
      stageId: bottleneck.stageId,
      priority: "high",
      message: isEn
        ? "Focus on this stage: simplify messaging, reduce friction, or test a stronger CTA."
        : "Fokuser på dette stadiet: forenkle budskap, reduser friksjon, eller test en tydeligere CTA.",
    });
  }
  if (bottleneck.stageId && bottleneck.dropOffRate >= 0.3 && bottleneck.dropOffRate < 0.5) {
    recommendations.push({
      stageId: bottleneck.stageId,
      priority: "medium",
      message: isEn
        ? "Improve transition to next stage: clarify value, add social proof, or shorten the path."
        : "Forbedre overgang til neste steg: tydeliggjør verdi, legg til sosial bevis, eller forkort veien.",
    });
  }
  if (overallConversionRate > 0 && overallConversionRate < 0.05 && valid.length >= 2) {
    recommendations.push({
      stageId: valid[0].id,
      priority: "medium",
      message: isEn
        ? "Overall conversion is low; review top-of-funnel fit and first-step clarity."
        : "Samlet konvertering er lav; vurder topp av trakt og tydelighet i første steg.",
    });
  }
  if (recommendations.length === 0 && valid.length > 0) {
    recommendations.push({
      stageId: valid[0].id,
      priority: "low",
      message: isEn ? "Funnel flow is within expected range; keep monitoring." : "Traktflyt er innenfor forventet område; fortsett å overvåke.",
    });
  }

  const summary = isEn
    ? `Funnel: ${valid.length} stages, ${Math.round(overallConversionRate * 100)}% overall conversion. Bottleneck: ${bottleneck.stageName} (${Math.round((bottleneck.dropOffRate ?? 0) * 100)}% drop-off).`
    : `Trakt: ${valid.length} stadier, ${Math.round(overallConversionRate * 100)}% samlet konvertering. Flaskehals: ${bottleneck.stageName} (${Math.round((bottleneck.dropOffRate ?? 0) * 100)}% fall).`;

  return {
    stageMetrics,
    bottleneck,
    overallConversionRate,
    recommendations,
    summary,
  };
}

export { analyzeConversionFunnelCapability, CAPABILITY_NAME };
