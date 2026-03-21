/**
 * AI compliance monitor capability: monitorCompliance.
 * Evaluates compliance checks (pass/fail/not_applicable), computes compliance score
 * and status, and returns findings, gaps, and recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "monitorCompliance";

const monitorComplianceCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "AI compliance monitor: from a set of compliance checks (pass/fail/not_applicable) with optional category and severity, computes compliance score (0-100) and status (compliant/partial/non_compliant). Returns findings, gaps, and recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Monitor compliance input",
    properties: {
      checks: {
        type: "array",
        description: "Compliance check results",
        items: {
          type: "object",
          required: ["checkId", "status"],
          properties: {
            checkId: { type: "string" },
            name: { type: "string", description: "Check display name" },
            category: {
              type: "string",
              description: "e.g. data_retention, consent, audit, access_control, policy",
            },
            status: { type: "string", enum: ["pass", "fail", "not_applicable"] },
            requirement: { type: "string", description: "Requirement or policy reference" },
            evidence: { type: "string", description: "Evidence or note" },
            severity: {
              type: "string",
              enum: ["critical", "high", "medium", "low"],
              description: "Impact if failed (default: medium)",
            },
          },
        },
      },
      framework: {
        type: "string",
        description: "Optional framework name (e.g. GDPR, SOC2, internal)",
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["checks"],
  },
  outputSchema: {
    type: "object",
    description: "Compliance monitoring result",
    required: [
      "complianceStatus",
      "complianceScore",
      "findings",
      "gaps",
      "recommendations",
      "summary",
      "generatedAt",
    ],
    properties: {
      complianceStatus: {
        type: "string",
        enum: ["compliant", "partial", "non_compliant"],
      },
      complianceScore: { type: "number", description: "0-100, based on applicable checks" },
      findings: {
        type: "array",
        items: {
          type: "object",
          required: ["checkId", "status"],
          properties: {
            checkId: { type: "string" },
            name: { type: "string" },
            category: { type: "string" },
            status: { type: "string", enum: ["pass", "fail", "not_applicable"] },
            gap: { type: "string" },
            recommendation: { type: "string" },
            severity: { type: "string" },
          },
        },
      },
      gaps: { type: "array", items: { type: "string" }, description: "Short descriptions of failed checks" },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Monitoring only; does not mutate policy or system.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(monitorComplianceCapability);

export type ComplianceCheckInput = {
  checkId: string;
  name?: string | null;
  category?: string | null;
  status: "pass" | "fail" | "not_applicable";
  requirement?: string | null;
  evidence?: string | null;
  severity?: "critical" | "high" | "medium" | "low" | null;
};

export type MonitorComplianceInput = {
  checks: ComplianceCheckInput[];
  framework?: string | null;
  locale?: "nb" | "en" | null;
};

export type ComplianceFinding = {
  checkId: string;
  name?: string | null;
  category?: string | null;
  status: "pass" | "fail" | "not_applicable";
  gap?: string | null;
  recommendation?: string | null;
  severity?: string | null;
};

export type MonitorComplianceOutput = {
  complianceStatus: "compliant" | "partial" | "non_compliant";
  complianceScore: number;
  findings: ComplianceFinding[];
  gaps: string[];
  recommendations: string[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function recommendationForCategory(category: string, isEn: boolean): string {
  const c = category.toLowerCase();
  if (c.includes("data_retention") || c.includes("retention"))
    return isEn ? "Review and enforce data retention policy; document retention periods." : "Gå gjennom og håndhev lagringspolicy; dokumenter oppbevaringsperioder.";
  if (c.includes("consent"))
    return isEn ? "Ensure consent is captured, stored, and withdrawable per regulation." : "Sikre at samtykke registreres, lagres og kan trekkes tilbake.";
  if (c.includes("audit"))
    return isEn ? "Enable audit logging for sensitive operations; retain logs per policy." : "Aktiver audit logging for sensitive operasjoner; behold logger i tråd med policy.";
  if (c.includes("access_control") || c.includes("access"))
    return isEn ? "Enforce least-privilege access; review roles and permissions." : "Håndhev minst mulig tilgang; gå gjennom roller og tillatelser.";
  if (c.includes("policy"))
    return isEn ? "Update and communicate policy; ensure alignment with framework." : "Oppdater og kommuniser policy; sikre samsvar med rammeverk.";
  return isEn ? "Remediate finding and document evidence." : "Retting av funn og dokumentasjon av bevis.";
}

/**
 * Monitors compliance from check results. Deterministic; no external calls.
 */
export function monitorCompliance(input: MonitorComplianceInput): MonitorComplianceOutput {
  const checks = Array.isArray(input.checks) ? input.checks : [];
  const framework = safeStr(input.framework);
  const isEn = input.locale === "en";

  const findings: ComplianceFinding[] = [];
  const gaps: string[] = [];
  const recommendations: string[] = [];
  let applicableCount = 0;
  let passCount = 0;
  let hasCriticalFail = false;
  let hasHighFail = false;

  for (const c of checks) {
    const checkId = safeStr(c.checkId);
    if (!checkId) continue;

    const status = c.status === "pass" || c.status === "fail" || c.status === "not_applicable" ? c.status : "fail";
    const severity = c.severity === "critical" || c.severity === "high" || c.severity === "medium" || c.severity === "low" ? c.severity : "medium";
    const name = safeStr(c.name) || checkId;
    const category = safeStr(c.category);

    if (status !== "not_applicable") {
      applicableCount++;
      if (status === "pass") passCount++;
      if (status === "fail") {
        if (severity === "critical") hasCriticalFail = true;
        if (severity === "high") hasHighFail = true;
      }
    }

    let gap: string | null = null;
    let recommendation: string | null = null;
    if (status === "fail") {
      gap = isEn
        ? `Check "${name}" did not pass. ${c.requirement ? `Requirement: ${safeStr(c.requirement)}` : ""}`.trim()
        : `Sjekk "${name}" bestod ikke. ${c.requirement ? `Krav: ${safeStr(c.requirement)}` : ""}`.trim();
      recommendation = recommendationForCategory(category || "policy", isEn);
      gaps.push(gap);
      if (recommendation && !recommendations.includes(recommendation)) recommendations.push(recommendation);
    }

    findings.push({
      checkId,
      name: name || undefined,
      category: category || undefined,
      status,
      gap: gap ?? undefined,
      recommendation: recommendation ?? undefined,
      severity,
    });
  }

  const complianceScore =
    applicableCount > 0 ? Math.round((passCount / applicableCount) * 100) : 100;

  const complianceStatus: "compliant" | "partial" | "non_compliant" =
    applicableCount === 0
      ? "compliant"
      : hasCriticalFail || (hasHighFail && passCount < applicableCount)
        ? "non_compliant"
        : passCount === applicableCount
          ? "compliant"
          : "partial";

  const frameworkLabel = framework ? ` (${framework})` : "";
  const summary = isEn
    ? `Compliance${frameworkLabel}: ${complianceStatus}, score ${complianceScore}/100. ${applicableCount} applicable check(s), ${passCount} pass, ${gaps.length} gap(s).`
    : `Compliance${frameworkLabel}: ${complianceStatus}, score ${complianceScore}/100. ${applicableCount} relevante sjekk(er), ${passCount} bestått, ${gaps.length} hull.`;

  return {
    complianceStatus,
    complianceScore,
    findings,
    gaps,
    recommendations: recommendations.length > 0 ? recommendations : (isEn ? ["No remediation required."] : ["Ingen tiltak nødvendig."]),
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { monitorComplianceCapability, CAPABILITY_NAME };
