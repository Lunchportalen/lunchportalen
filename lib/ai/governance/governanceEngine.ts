/**
 * AI GOVERNANCE ENGINE
 * Kontrollerer: sikkerhet, compliance, AI-policy.
 * Samler detectOperationalRisk, monitorCompliance, enforceAIPolicies.
 * Kun evaluering/kontroll; ingen mutasjon.
 */

import { detectOperationalRisk } from "@/lib/ai/capabilities/detectOperationalRisk";
import type {
  DetectOperationalRiskInput,
  DetectOperationalRiskOutput,
  OperationalRisk,
  IncidentInput,
  DependencyInput,
  ComplianceSignalInput,
} from "@/lib/ai/capabilities/detectOperationalRisk";
import { monitorCompliance } from "@/lib/ai/capabilities/monitorCompliance";
import type {
  MonitorComplianceInput,
  MonitorComplianceOutput,
  ComplianceCheckInput,
  ComplianceFinding,
} from "@/lib/ai/capabilities/monitorCompliance";
import { enforceAIPolicies } from "@/lib/ai/capabilities/enforceAIPolicies";
import type {
  EnforceAIPoliciesInput,
  EnforceAIPoliciesOutput,
  AIPolicyInput,
  EnforcementAction,
  PolicyCondition,
} from "@/lib/ai/capabilities/enforceAIPolicies";

export type {
  OperationalRisk,
  IncidentInput,
  DependencyInput,
  ComplianceSignalInput,
  ComplianceCheckInput,
  ComplianceFinding,
  AIPolicyInput,
  EnforcementAction,
  PolicyCondition,
};

/** Kontrollerer sikkerhet og operasjonell risiko (hendelser, avhengigheter, kapasitet, compliance-signaler). */
export function controlSecurity(input: DetectOperationalRiskInput): DetectOperationalRiskOutput {
  return detectOperationalRisk(input);
}

/** Kontrollerer compliance: sjekker, score, status, hull og anbefalinger. */
export function controlCompliance(input: MonitorComplianceInput): MonitorComplianceOutput {
  return monitorCompliance(input);
}

/** Kontrollerer AI-policy: vurderer handling mot policy (tillat/avvis). */
export function controlAIPolicy(input: EnforceAIPoliciesInput): EnforceAIPoliciesOutput {
  return enforceAIPolicies(input);
}

/** Type for dispatch. */
export type GovernanceEngineKind = "security" | "compliance" | "ai_policy";

export type GovernanceEngineInput =
  | { kind: "security"; input: DetectOperationalRiskInput }
  | { kind: "compliance"; input: MonitorComplianceInput }
  | { kind: "ai_policy"; input: EnforceAIPoliciesInput };

export type GovernanceEngineResult =
  | { kind: "security"; data: DetectOperationalRiskOutput }
  | { kind: "compliance"; data: MonitorComplianceOutput }
  | { kind: "ai_policy"; data: EnforceAIPoliciesOutput };

/**
 * Samlet dispatch: sikkerhet, compliance, AI-policy.
 */
export function runGovernanceEngine(req: GovernanceEngineInput): GovernanceEngineResult {
  switch (req.kind) {
    case "security":
      return { kind: "security", data: controlSecurity(req.input) };
    case "compliance":
      return { kind: "compliance", data: controlCompliance(req.input) };
    case "ai_policy":
      return { kind: "ai_policy", data: controlAIPolicy(req.input) };
    default:
      throw new Error(`Unknown governance engine kind: ${(req as GovernanceEngineInput).kind}`);
  }
}
