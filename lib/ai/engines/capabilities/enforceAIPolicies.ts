/**
 * AI policy enforcement engine capability: enforceAIPolicies.
 * Evaluates an action (capability, role, surface) against a set of policies.
 * Returns allow/deny, violated and applied policies, and reason. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "enforceAIPolicies";

const enforceAIPoliciesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "AI policy enforcement engine: evaluates an action (capability, role, surface, optional context) against a set of policies (allow/deny capability, require role, surface restriction). Returns allowed (boolean), reason, violatedPolicies, appliedPolicies. Deny wins over allow. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Enforce AI policies input",
    properties: {
      action: {
        type: "object",
        description: "The action to evaluate",
        required: ["capability"],
        properties: {
          capability: { type: "string", description: "Capability name being invoked" },
          role: { type: "string", description: "Caller role (e.g. superadmin, company_admin)" },
          surface: { type: "string", description: "Invocation surface (e.g. backoffice, api, editor)" },
          userId: { type: "string" },
          context: { type: "object", description: "Optional key-value context" },
        },
      },
      policies: {
        type: "array",
        description: "Policies to evaluate in order; first matching deny wins",
        items: {
          type: "object",
          required: ["policyId", "type", "effect"],
          properties: {
            policyId: { type: "string" },
            name: { type: "string" },
            type: {
              type: "string",
              description: "capability | role | surface",
            },
            effect: { type: "string", enum: ["allow", "deny"] },
            value: {
              type: "string",
              description: "e.g. capability name, role name, or surface name; or comma-separated list",
            },
            conditions: {
              type: "object",
              description: "Optional: role, surface, capability (must all match if present)",
              properties: {
                role: { type: "string" },
                surface: { type: "string" },
                capability: { type: "string" },
              },
            },
          },
        },
      },
      defaultAllow: {
        type: "boolean",
        description: "If no policy matches, allow (true) or deny (false); default false (fail-closed)",
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["action", "policies"],
  },
  outputSchema: {
    type: "object",
    description: "Policy enforcement result",
    required: ["allowed", "reason", "violatedPolicies", "appliedPolicies", "summary", "evaluatedAt"],
    properties: {
      allowed: { type: "boolean" },
      reason: { type: "string" },
      violatedPolicies: { type: "array", items: { type: "string" }, description: "policyIds that caused deny" },
      appliedPolicies: { type: "array", items: { type: "string" }, description: "policyIds that matched (allow or deny)" },
      summary: { type: "string" },
      evaluatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Evaluation only; does not mutate policies or system.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(enforceAIPoliciesCapability);

export type PolicyCondition = {
  role?: string | null;
  surface?: string | null;
  capability?: string | null;
};

export type AIPolicyInput = {
  policyId: string;
  name?: string | null;
  type: "capability" | "role" | "surface";
  effect: "allow" | "deny";
  value?: string | null;
  conditions?: PolicyCondition | null;
};

export type EnforcementAction = {
  capability: string;
  role?: string | null;
  surface?: string | null;
  userId?: string | null;
  context?: Record<string, unknown> | null;
};

export type EnforceAIPoliciesInput = {
  action: EnforcementAction;
  policies: AIPolicyInput[];
  defaultAllow?: boolean | null;
  locale?: "nb" | "en" | null;
};

export type EnforceAIPoliciesOutput = {
  allowed: boolean;
  reason: string;
  violatedPolicies: string[];
  appliedPolicies: string[];
  summary: string;
  evaluatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function valueList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function conditionsMatch(conditions: PolicyCondition | null | undefined, action: EnforcementAction): boolean {
  if (!conditions || typeof conditions !== "object") return true;
  const role = safeStr(action.role).toLowerCase();
  const surface = safeStr(action.surface).toLowerCase();
  const capability = safeStr(action.capability).toLowerCase();
  if (conditions.role != null && safeStr(conditions.role).toLowerCase() !== role) return false;
  if (conditions.surface != null && safeStr(conditions.surface).toLowerCase() !== surface) return false;
  if (conditions.capability != null && safeStr(conditions.capability).toLowerCase() !== capability) return false;
  return true;
}

function policyMatches(policy: AIPolicyInput, action: EnforcementAction): boolean {
  if (!conditionsMatch(policy.conditions, action)) return false;
  const cap = safeStr(action.capability).toLowerCase();
  const role = safeStr(action.role).toLowerCase();
  const surface = safeStr(action.surface).toLowerCase();
  const values = valueList(policy.value);

  switch (policy.type) {
    case "capability":
      return values.length === 0 || values.includes(cap) || values.includes("*");
    case "role":
      return values.length === 0 || values.includes(role) || values.includes("*");
    case "surface":
      return values.length === 0 || values.includes(surface) || values.includes("*");
    default:
      return false;
  }
}

/**
 * Evaluates action against policies. Deny wins; if no policy matches, defaultAllow (default false) applies. Deterministic.
 */
export function enforceAIPolicies(input: EnforceAIPoliciesInput): EnforceAIPoliciesOutput {
  const action = input.action && typeof input.action === "object" ? input.action : { capability: "" };
  const policies = Array.isArray(input.policies) ? input.policies : [];
  const defaultAllow = input.defaultAllow === true;
  const isEn = input.locale === "en";

  const capability = safeStr(action.capability);
  if (!capability) {
    const reason = isEn ? "Action missing capability." : "Handlingen mangler capability.";
    return {
      allowed: false,
      reason,
      violatedPolicies: [],
      appliedPolicies: [],
      summary: reason,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const violatedPolicies: string[] = [];
  const appliedPolicies: string[] = [];
  let allowed = defaultAllow;
  let denyReason: string | null = null;
  let allowMatched = false;

  for (const p of policies) {
    const policyId = safeStr(p.policyId);
    if (!policyId) continue;
    if (!policyMatches(p, action)) continue;

    appliedPolicies.push(policyId);

    if (p.effect === "deny") {
      violatedPolicies.push(policyId);
      allowed = false;
      const name = safeStr(p.name) || policyId;
      denyReason = isEn
        ? `Denied by policy "${name}" (${p.type}).`
        : `Blokkert av policy "${name}" (${p.type}).`;
      break;
    }
    if (p.effect === "allow") {
      allowMatched = true;
      allowed = true;
    }
  }

  const reason =
    denyReason ??
    (allowed
      ? (allowMatched
          ? (isEn ? "Allowed by matching policy." : "Tillatt av matchende policy.")
          : (defaultAllow
              ? (isEn ? "No matching policy; default allow." : "Ingen matchende policy; standard tillat.")
              : (isEn ? "No matching allow; default deny." : "Ingen matchende tillat; standard blokkering.")))
      : (isEn ? "No matching allow policy; default deny." : "Ingen matchende tillatelsespolicy; standard blokkering."));

  const summary = isEn
    ? `${allowed ? "Allowed" : "Denied"}: ${capability}. ${appliedPolicies.length} policy(ies) applied; ${violatedPolicies.length} violation(s).`
    : `${allowed ? "Tillatt" : "Avvist"}: ${capability}. ${appliedPolicies.length} policy(ier) anvendt; ${violatedPolicies.length} brudd.`;

  return {
    allowed,
    reason,
    violatedPolicies,
    appliedPolicies,
    summary,
    evaluatedAt: new Date().toISOString(),
  };
}

export { enforceAIPoliciesCapability, CAPABILITY_NAME };
