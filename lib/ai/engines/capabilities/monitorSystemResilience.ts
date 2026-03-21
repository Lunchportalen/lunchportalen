/**
 * Platform resilience monitor capability: monitorSystemResilience.
 * Aggregates component health (ok/degraded/down), latency, and error rates into
 * a resilience score and status. Returns component summary and recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "monitorSystemResilience";

const monitorSystemResilienceCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Platform resilience monitor: from component status (ok/degraded/down), optional latency and error rates, computes resilience score (0-100) and status (healthy/degraded/at_risk). Returns per-component summary, contributing factors, and recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Monitor system resilience input",
    properties: {
      components: {
        type: "array",
        description: "System components with status and optional metrics",
        items: {
          type: "object",
          required: ["id", "status"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            status: { type: "string", enum: ["ok", "degraded", "down"] },
            latencyMs: { type: "number", description: "Response latency" },
            errorRate: { type: "number", description: "Error rate 0-1 or 0-100" },
            lastCheck: { type: "string", description: "ISO timestamp of last check" },
            weight: { type: "number", description: "Weight for score (default 1); higher = more critical" },
          },
        },
      },
      latencyThresholdMs: {
        type: "number",
        description: "Latency above this may reduce score (optional)",
      },
      errorRateThreshold: {
        type: "number",
        description: "Error rate above this may reduce score (0-1 or 0-100, optional)",
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["components"],
  },
  outputSchema: {
    type: "object",
    description: "System resilience monitoring result",
    required: [
      "resilienceStatus",
      "resilienceScore",
      "componentSummary",
      "recommendations",
      "summary",
      "generatedAt",
    ],
    properties: {
      resilienceStatus: { type: "string", enum: ["healthy", "degraded", "at_risk"] },
      resilienceScore: { type: "number", description: "0-100, higher = more resilient" },
      componentSummary: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "status"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            status: { type: "string", enum: ["ok", "degraded", "down"] },
            contributingFactor: { type: "string" },
            latencyMs: { type: "number" },
            errorRate: { type: "number" },
          },
        },
      },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Monitoring only; does not mutate system or config.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(monitorSystemResilienceCapability);

export type ResilienceComponentInput = {
  id: string;
  name?: string | null;
  status: "ok" | "degraded" | "down";
  latencyMs?: number | null;
  errorRate?: number | null;
  lastCheck?: string | null;
  weight?: number | null;
};

export type MonitorSystemResilienceInput = {
  components: ResilienceComponentInput[];
  latencyThresholdMs?: number | null;
  errorRateThreshold?: number | null;
  locale?: "nb" | "en" | null;
};

export type ComponentResilienceSummary = {
  id: string;
  name?: string | null;
  status: "ok" | "degraded" | "down";
  contributingFactor?: string | null;
  latencyMs?: number | null;
  errorRate?: number | null;
};

export type MonitorSystemResilienceOutput = {
  resilienceStatus: "healthy" | "degraded" | "at_risk";
  resilienceScore: number;
  componentSummary: ComponentResilienceSummary[];
  recommendations: string[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function statusScore(s: "ok" | "degraded" | "down"): number {
  switch (s) {
    case "ok":
      return 100;
    case "degraded":
      return 50;
    case "down":
      return 0;
    default:
      return 50;
  }
}

/**
 * Monitors system resilience from component status and optional metrics. Deterministic; no external calls.
 */
export function monitorSystemResilience(input: MonitorSystemResilienceInput): MonitorSystemResilienceOutput {
  const components = Array.isArray(input.components) ? input.components : [];
  const latencyThreshold = Number(input.latencyThresholdMs) || 0;
  const errorRateThreshold = Number(input.errorRateThreshold) || 0;
  const isEn = input.locale === "en";

  const componentSummary: ComponentResilienceSummary[] = [];
  const recommendations: string[] = [];
  let weightedSum = 0;
  let totalWeight = 0;
  let downCount = 0;
  let degradedCount = 0;

  for (const c of components) {
    const id = safeStr(c.id);
    if (!id) continue;

    const status = c.status === "ok" || c.status === "degraded" || c.status === "down" ? c.status : "degraded";
    const weight = Math.max(0.1, Number(c.weight) || 1);
    let score = statusScore(status);

    let contributingFactor: string | null = null;
    const latencyMs = c.latencyMs != null ? Number(c.latencyMs) : null;
    const errorRateRaw = c.errorRate != null ? Number(c.errorRate) : null;
    const errorRate = errorRateRaw != null ? (errorRateRaw > 1 ? errorRateRaw / 100 : errorRateRaw) : null;

    if (status === "ok" && (latencyThreshold > 0 || errorRateThreshold > 0)) {
      if (latencyThreshold > 0 && latencyMs != null && latencyMs > latencyThreshold) {
        score = Math.min(score, 70);
        contributingFactor = isEn
          ? `Latency ${latencyMs} ms above threshold ${latencyThreshold} ms`
          : `Latens ${latencyMs} ms over terskel ${latencyThreshold} ms`;
      }
      if (errorRateThreshold > 0 && errorRate != null && errorRate > (errorRateThreshold > 1 ? errorRateThreshold / 100 : errorRateThreshold)) {
        score = Math.min(score, 70);
        contributingFactor = isEn
          ? `Error rate ${(errorRate * 100).toFixed(1)}% above threshold`
          : `Feilrate ${(errorRate * 100).toFixed(1)}% over terskel`;
      }
    }

    if (status === "down") downCount++;
    else if (status === "degraded") degradedCount++;

    weightedSum += score * weight;
    totalWeight += weight;

    componentSummary.push({
      id,
      name: c.name ?? undefined,
      status,
      contributingFactor: contributingFactor ?? undefined,
      latencyMs: latencyMs ?? undefined,
      errorRate: errorRate != null ? errorRate : undefined,
    });
  }

  const resilienceScore =
    totalWeight > 0 ? Math.round(Math.max(0, Math.min(100, weightedSum / totalWeight))) : 100;

  const resilienceStatus: "healthy" | "degraded" | "at_risk" =
    resilienceScore >= 80 && downCount === 0
      ? "healthy"
      : resilienceScore >= 50 && downCount === 0
        ? "degraded"
        : "at_risk";

  if (downCount > 0) {
    recommendations.push(
      isEn
        ? `Address ${downCount} down component(s) first to restore availability.`
        : `Adresser ${downCount} nede komponent(er) først for å gjenopprette tilgjengelighet.`
    );
  }
  if (degradedCount > 0) {
    recommendations.push(
      isEn
        ? `Review ${degradedCount} degraded component(s); check latency and error rates.`
        : `Gå gjennom ${degradedCount} degradert(e) komponent(er); sjekk latens og feilrater.`
    );
  }
  if (resilienceStatus === "healthy" && recommendations.length === 0) {
    recommendations.push(isEn ? "No immediate actions; continue monitoring." : "Ingen umiddelbare tiltak; fortsett overvåking.");
  }
  if (resilienceStatus === "at_risk" && downCount === 0) {
    recommendations.push(
      isEn
        ? "Overall score is at risk; improve degraded components or add redundancy."
        : "Samlet score er i fare; forbedre degradert komponenter eller legg til redundans."
    );
  }

  const summary = isEn
    ? `Resilience: ${resilienceStatus} (score ${resilienceScore}/100). ${components.length} component(s); ${downCount} down, ${degradedCount} degraded.`
    : `Resiliens: ${resilienceStatus} (score ${resilienceScore}/100). ${components.length} komponent(er); ${downCount} nede, ${degradedCount} degradert.`;

  return {
    resilienceStatus,
    resilienceScore,
    componentSummary,
    recommendations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { monitorSystemResilienceCapability, CAPABILITY_NAME };
