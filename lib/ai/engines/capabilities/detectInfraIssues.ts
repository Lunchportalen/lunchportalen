/**
 * Infrastructure anomaly detector capability: detectInfraIssues.
 * Evaluates infrastructure signals (CPU, memory, disk, latency, error rate, health)
 * and health checks against thresholds. Flags warning/critical issues. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectInfraIssues";

const detectInfraIssuesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Infrastructure anomaly detector: from metrics (CPU, memory, disk, latency, error_rate) and health checks, evaluates against thresholds. Returns detected issues with severity (warning/critical), message, and suggested action. Overall status: ok | degraded | critical. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect infrastructure issues input",
    properties: {
      signals: {
        type: "array",
        description: "Metric signals per component",
        items: {
          type: "object",
          required: ["componentId", "type", "value"],
          properties: {
            componentId: { type: "string" },
            componentName: { type: "string" },
            type: {
              type: "string",
              description: "cpu | memory | disk | latency | error_rate | health",
            },
            value: { type: "number" },
            lowerIsBetter: {
              type: "boolean",
              description: "true for latency/error_rate (default for those), false for health/availability",
            },
            thresholdWarning: { type: "number", description: "Breach = warning" },
            thresholdCritical: { type: "number", description: "Breach = critical" },
            unit: { type: "string", description: "e.g. %, ms, GB" },
            timestamp: { type: "string", description: "ISO timestamp" },
          },
        },
      },
      healthChecks: {
        type: "array",
        description: "Health check results: status ok | degraded | down",
        items: {
          type: "object",
          required: ["name", "status"],
          properties: {
            name: { type: "string" },
            status: { type: "string", enum: ["ok", "degraded", "down"] },
            latencyMs: { type: "number" },
            message: { type: "string" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Infrastructure issues detection result",
    required: ["issues", "overallStatus", "summary", "generatedAt"],
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          required: ["issueId", "componentId", "type", "severity", "message"],
          properties: {
            issueId: { type: "string" },
            componentId: { type: "string" },
            componentName: { type: "string" },
            type: { type: "string" },
            severity: { type: "string", enum: ["warning", "critical"] },
            value: { type: "number" },
            threshold: { type: "number" },
            unit: { type: "string" },
            message: { type: "string" },
            suggestedAction: { type: "string" },
            source: { type: "string", description: "signal | health_check" },
          },
        },
      },
      overallStatus: { type: "string", enum: ["ok", "degraded", "critical"] },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Detection only; does not mutate infrastructure or config.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(detectInfraIssuesCapability);

export type InfraSignal = {
  componentId: string;
  componentName?: string | null;
  type: string;
  value: number;
  lowerIsBetter?: boolean | null;
  thresholdWarning?: number | null;
  thresholdCritical?: number | null;
  unit?: string | null;
  timestamp?: string | null;
};

export type HealthCheckInput = {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs?: number | null;
  message?: string | null;
};

export type DetectInfraIssuesInput = {
  signals?: InfraSignal[] | null;
  healthChecks?: HealthCheckInput[] | null;
  locale?: "nb" | "en" | null;
};

export type InfraIssue = {
  issueId: string;
  componentId: string;
  componentName?: string | null;
  type: string;
  severity: "warning" | "critical";
  value?: number | null;
  threshold?: number | null;
  unit?: string | null;
  message: string;
  suggestedAction?: string | null;
  source: "signal" | "health_check";
};

export type DetectInfraIssuesOutput = {
  issues: InfraIssue[];
  overallStatus: "ok" | "degraded" | "critical";
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function issueId(prefix: string, componentId: string, type: string, idx: number): string {
  const base = `${prefix}_${safeStr(componentId)}_${safeStr(type)}`;
  return idx > 0 ? `${base}_${idx}` : base;
}

function defaultLowerIsBetter(type: string): boolean {
  const t = type.toLowerCase();
  return t === "latency" || t === "error_rate" || t === "error rate";
}

function suggestActionSignal(
  type: string,
  severity: string,
  lowerIsBetter: boolean,
  isEn: boolean
): string {
  const t = type.toLowerCase();
  if (t === "cpu")
    return isEn
      ? "Check process load, scale horizontally or optimize hot paths."
      : "Sjekk prosessbelastning, skaler horisontalt eller optimaliser.";
  if (t === "memory")
    return isEn
      ? "Review memory usage and limits; consider increasing or fixing leaks."
      : "Gå gjennom minnebruk og grenser; vurder øking eller lekkasjehåndtering.";
  if (t === "disk")
    return isEn
      ? "Free disk space or expand storage; rotate logs if applicable."
      : "Frigjør diskplass eller utvid lagring; roter logger ved behov.";
  if (t === "latency" || t === "error_rate" || t === "error rate")
    return isEn
      ? "Investigate dependency latency and error rates; add caching or retries."
      : "Undersøk avhengigheters latens og feilrate; vurder caching eller retries.";
  if (t === "health")
    return isEn ? "Verify service health and dependencies." : "Verifiser tjenestehelse og avhengigheter.";
  return isEn ? "Review component metrics and logs." : "Gå gjennom komponentmetrikker og logger.";
}

function suggestActionHealth(status: string, isEn: boolean): string {
  if (status === "down")
    return isEn ? "Service is down; check process, network, and dependencies." : "Tjenesten er nede; sjekk prosess, nettverk og avhengigheter.";
  if (status === "degraded")
    return isEn ? "Service degraded; review latency and partial failures." : "Tjenesten er degradert; sjekk latens og delvise feil.";
  return isEn ? "No action needed." : "Ingen tiltak nødvendig.";
}

/**
 * Detects infrastructure issues from signals and health checks. Deterministic; no external calls.
 */
export function detectInfraIssues(input: DetectInfraIssuesInput): DetectInfraIssuesOutput {
  const signals = Array.isArray(input.signals) ? input.signals : [];
  const healthChecks = Array.isArray(input.healthChecks) ? input.healthChecks : [];
  const isEn = input.locale === "en";

  const issues: InfraIssue[] = [];
  let criticalCount = 0;
  let warningCount = 0;

  for (let i = 0; i < signals.length; i++) {
    const s = signals[i];
    const componentId = safeStr(s.componentId);
    if (!componentId) continue;

    const value = Number(s.value);
    const type = safeStr(s.type) || "metric";
    const lowerIsBetter = s.lowerIsBetter ?? defaultLowerIsBetter(type);
    const warn = s.thresholdWarning != null ? Number(s.thresholdWarning) : null;
    const crit = s.thresholdCritical != null ? Number(s.thresholdCritical) : null;

    let severity: "warning" | "critical" | null = null;
    let threshold: number | null = null;

    if (lowerIsBetter) {
      if (crit != null && value > crit) {
        severity = "critical";
        threshold = crit;
      } else if (warn != null && value > warn) {
        severity = "warning";
        threshold = warn;
      }
    } else {
      if (crit != null && value < crit) {
        severity = "critical";
        threshold = crit;
      } else if (warn != null && value < warn) {
        severity = "warning";
        threshold = warn;
      }
    }

    if (severity) {
      const unit = safeStr(s.unit);
      const valStr = unit ? `${value}${unit}` : String(value);
      const thStr = threshold != null && unit ? `${threshold}${unit}` : String(threshold ?? "");
      const message = isEn
        ? `${type}: ${valStr} breaches ${severity} threshold${thStr ? ` (${thStr})` : ""}.`
        : `${type}: ${valStr} overskrider ${severity}-terskel${thStr ? ` (${thStr})` : ""}.`;
      issues.push({
        issueId: issueId("sig", componentId, type, i),
        componentId,
        componentName: s.componentName ?? undefined,
        type,
        severity,
        value,
        threshold: threshold ?? undefined,
        unit: s.unit ?? undefined,
        message,
        suggestedAction: suggestActionSignal(type, severity, lowerIsBetter, isEn),
        source: "signal",
      });
      if (severity === "critical") criticalCount++;
      else warningCount++;
    }
  }

  for (let j = 0; j < healthChecks.length; j++) {
    const h = healthChecks[j];
    const name = safeStr(h.name);
    const status = h.status;
    if (!name || status === "ok") continue;

    const severity: "warning" | "critical" = status === "down" ? "critical" : "warning";
    const message = isEn
      ? `Health check "${name}" is ${status}.`
      : `Helsesjekk "${name}" er ${status}.`;
    issues.push({
      issueId: issueId("hc", name, "health", j),
      componentId: name,
      componentName: name,
      type: "health",
      severity,
      value: h.latencyMs ?? undefined,
      message,
      suggestedAction: suggestActionHealth(status, isEn),
      source: "health_check",
    });
    if (severity === "critical") criticalCount++;
    else warningCount++;
  }

  issues.sort((a, b) => (a.severity === "critical" && b.severity !== "critical" ? -1 : b.severity === "critical" && a.severity !== "critical" ? 1 : 0));

  const overallStatus: "ok" | "degraded" | "critical" =
    criticalCount > 0 ? "critical" : warningCount > 0 ? "degraded" : "ok";

  const summary = isEn
    ? overallStatus === "ok"
      ? "No infrastructure issues detected."
      : `Detected ${issues.length} issue(s): ${criticalCount} critical, ${warningCount} warning. Overall: ${overallStatus}.`
    : overallStatus === "ok"
      ? "Ingen infrastrukturproblemer oppdaget."
      : `Fant ${issues.length} problem(er): ${criticalCount} kritiske, ${warningCount} advarsler. Samlet: ${overallStatus}.`;

  return {
    issues,
    overallStatus,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { detectInfraIssuesCapability, CAPABILITY_NAME };
