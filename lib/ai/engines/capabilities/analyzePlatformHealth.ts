/**
 * Platform health AI capability: analyzePlatformHealth.
 * Analyzes platform health from metrics (uptime, latency, error rate) and component/dependency status.
 * Returns overall status, health score, issues, and recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "analyzePlatformHealth";

const analyzePlatformHealthCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes platform health from metrics (uptime, latency, error rate) and component or dependency statuses. Returns overall status (healthy, degraded, unhealthy), health score, issues, and recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Platform health analysis input",
    properties: {
      metrics: {
        type: "object",
        description: "Aggregated platform metrics",
        properties: {
          uptimePercent: { type: "number", description: "Uptime over period (0-100)" },
          latencyMsP95: { type: "number", description: "P95 latency in ms" },
          errorRate: { type: "number", description: "Error rate 0-1 or 0-100" },
        },
      },
      components: {
        type: "array",
        description: "Component or dependency status (e.g. database, API, cache)",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            status: { type: "string", enum: ["ok", "degraded", "down", "unknown"] },
            message: { type: "string" },
          },
        },
      },
      checks: {
        type: "array",
        description: "Health check results (e.g. flowcheck items)",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            status: { type: "string", enum: ["ok", "warn", "fail"] },
            message: { type: "string" },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Platform health analysis result",
    required: ["status", "healthScore", "issues", "components", "recommendations", "summary", "generatedAt"],
    properties: {
      status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
      healthScore: { type: "number", description: "0-100" },
      issues: { type: "array", items: { type: "object", properties: { source: { type: "string" }, message: { type: "string" }, severity: { type: "string" } } } },
      components: { type: "array", items: { type: "object", properties: { name: { type: "string" }, status: { type: "string" }, detail: { type: "string" } } } },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no platform or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(analyzePlatformHealthCapability);

const UPTIME_DEGRADED = 99;
const UPTIME_UNHEALTHY = 95;
const LATENCY_DEGRADED_MS = 2000;
const LATENCY_UNHEALTHY_MS = 5000;
const ERROR_RATE_DEGRADED = 0.01;
const ERROR_RATE_UNHEALTHY = 0.05;

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export type PlatformMetricsInput = {
  uptimePercent?: number | null;
  latencyMsP95?: number | null;
  errorRate?: number | null;
};

export type ComponentStatusInput = {
  name?: string | null;
  status?: string | null;
  message?: string | null;
};

export type HealthCheckInput = {
  name?: string | null;
  status?: string | null;
  message?: string | null;
};

export type AnalyzePlatformHealthInput = {
  metrics?: PlatformMetricsInput | null;
  components?: ComponentStatusInput[] | null;
  checks?: HealthCheckInput[] | null;
  locale?: "nb" | "en" | null;
};

export type HealthIssue = {
  source: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
};

export type ComponentHealth = {
  name: string;
  status: string;
  detail: string;
};

export type AnalyzePlatformHealthOutput = {
  status: "healthy" | "degraded" | "unhealthy";
  healthScore: number;
  issues: HealthIssue[];
  components: ComponentHealth[];
  recommendations: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Analyzes platform health from metrics and component/check results. Deterministic; no external calls.
 */
export function analyzePlatformHealth(input: AnalyzePlatformHealthInput): AnalyzePlatformHealthOutput {
  const isEn = input.locale === "en";
  const m = input.metrics && typeof input.metrics === "object" ? input.metrics : {};
  const components = Array.isArray(input.components) ? input.components.filter((c) => c && typeof c === "object") : [];
  const checks = Array.isArray(input.checks) ? input.checks.filter((c) => c && typeof c === "object") : [];

  const uptime = safeNum(m.uptimePercent);
  const latency = safeNum(m.latencyMsP95);
  const errorRateRaw = safeNum(m.errorRate);
  const errorRate = errorRateRaw > 1 ? errorRateRaw / 100 : errorRateRaw;

  const issues: HealthIssue[] = [];
  let status: AnalyzePlatformHealthOutput["status"] = "healthy";
  let score = 100;

  if (uptime > 0) {
    if (uptime < UPTIME_UNHEALTHY) {
      issues.push({
        source: "uptime",
        message: isEn ? `Uptime ${uptime}% below threshold (${UPTIME_UNHEALTHY}%).` : `Oppetid ${uptime}% under terskel (${UPTIME_UNHEALTHY}%).`,
        severity: "critical",
      });
      status = "unhealthy";
      score -= 30;
    } else if (uptime < UPTIME_DEGRADED) {
      issues.push({
        source: "uptime",
        message: isEn ? `Uptime ${uptime}% below target (${UPTIME_DEGRADED}%).` : `Oppetid ${uptime}% under mål (${UPTIME_DEGRADED}%).`,
        severity: "high",
      });
      if (status === "healthy") status = "degraded";
      score -= 15;
    }
  }

  if (latency > 0) {
    if (latency >= LATENCY_UNHEALTHY_MS) {
      issues.push({
        source: "latency",
        message: isEn ? `P95 latency ${latency}ms exceeds threshold (${LATENCY_UNHEALTHY_MS}ms).` : `P95-latency ${latency}ms over terskel (${LATENCY_UNHEALTHY_MS}ms).`,
        severity: "critical",
      });
      status = "unhealthy";
      score -= 25;
    } else if (latency >= LATENCY_DEGRADED_MS) {
      issues.push({
        source: "latency",
        message: isEn ? `P95 latency ${latency}ms elevated.` : `P95-latency ${latency}ms forhøyet.`,
        severity: "medium",
      });
      if (status === "healthy") status = "degraded";
      score -= 10;
    }
  }

  if (errorRate > 0) {
    if (errorRate >= ERROR_RATE_UNHEALTHY) {
      issues.push({
        source: "error_rate",
        message: isEn ? `Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold.` : `Feilrate ${(errorRate * 100).toFixed(2)}% over terskel.`,
        severity: "critical",
      });
      status = "unhealthy";
      score -= 25;
    } else if (errorRate >= ERROR_RATE_DEGRADED) {
      issues.push({
        source: "error_rate",
        message: isEn ? `Error rate ${(errorRate * 100).toFixed(2)}% above target.` : `Feilrate ${(errorRate * 100).toFixed(2)}% over mål.`,
        severity: "high",
      });
      if (status === "healthy") status = "degraded";
      score -= 10;
    }
  }

  const componentResults: ComponentHealth[] = [];
  for (const c of components) {
    const name = safeStr(c.name) || "component";
    const st = safeStr(c.status);
    const statusNorm = st === "down" || st === "degraded" || st === "ok" ? st : "unknown";
    const detail = safeStr(c.message) || (statusNorm === "ok" ? (isEn ? "OK" : "OK") : (isEn ? "Check component" : "Sjekk komponent"));
    componentResults.push({ name, status: statusNorm, detail });

    if (statusNorm === "down") {
      issues.push({ source: name, message: detail || (isEn ? "Component down." : "Komponent nede."), severity: "critical" });
      status = "unhealthy";
      score -= 20;
    } else if (statusNorm === "degraded") {
      issues.push({ source: name, message: detail || (isEn ? "Component degraded." : "Komponent degradert."), severity: "high" });
      if (status === "healthy") status = "degraded";
      score -= 8;
    }
  }

  for (const ch of checks) {
    const name = safeStr(ch.name) || "check";
    const st = safeStr(ch.status);
    const message = safeStr(ch.message);
    if (st === "fail") {
      issues.push({ source: name, message: message || (isEn ? "Check failed." : "Sjekk feilet."), severity: "high" });
      if (status === "healthy") status = "degraded";
      score -= 5;
    } else if (st === "warn") {
      issues.push({ source: name, message: message || (isEn ? "Check warning." : "Sjekk advarsel."), severity: "medium" });
      if (status !== "unhealthy" && status !== "degraded") status = "degraded";
      score -= 3;
    }
  }

  const healthScore = Math.max(0, Math.min(100, score));

  const recommendations: string[] = [];
  if (issues.some((i) => i.severity === "critical")) {
    recommendations.push(isEn ? "Address critical issues first; verify dependencies and infrastructure." : "Adresser kritiske saker først; verifiser avhengigheter og infrastruktur.");
  }
  if (status === "degraded") {
    recommendations.push(isEn ? "Review degraded components and metrics; plan remediation." : "Gjennomgå degraderte komponenter og måltall; planlegg tiltak.");
  }
  if (components.length === 0 && checks.length === 0 && !m.uptimePercent && !m.latencyMsP95 && !m.errorRate) {
    recommendations.push(isEn ? "Add metrics or component checks for meaningful health assessment." : "Legg til måltall eller komponent-sjekker for meningsfull helsevurdering.");
  }

  const summary = isEn
    ? `Platform health: ${status} (score ${healthScore}/100). ${issues.length} issue(s), ${componentResults.length} component(s).`
    : `Plattformhelse: ${status} (score ${healthScore}/100). ${issues.length} sak(er), ${componentResults.length} komponent(er).`;

  return {
    status,
    healthScore,
    issues,
    components: componentResults,
    recommendations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { analyzePlatformHealthCapability, CAPABILITY_NAME };
