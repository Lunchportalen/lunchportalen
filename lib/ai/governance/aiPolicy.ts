/**
 * AI governance: policy rules for capability use, safety, and operations.
 * Single source of truth for AI policy; consumed by routes, orchestrator, and tool registry.
 * Aligns with AGENTS.md: fail-closed, no silent fallbacks, tenant isolation.
 */

import type { Capability, SafetyConstraint } from "../capabilityRegistry";

// ---------------------------------------------------------------------------
// Principles (documentation; not enforced in code here)
// ---------------------------------------------------------------------------

/** AI governance principles. Use for documentation and audits. */
export const AI_GOVERNANCE_PRINCIPLES = {
  failClosed: "If uncertain about role, tenant, or data — block actions; show safe read-only UI; never guess.",
  noSilentFallbacks: "Do not silently fall back to degraded behavior; surface errors and respect rate limits.",
  tenantIsolation: "Never trust client-sent company_id; every AI context must be scoped by server-side tenant.",
  outputSafety: "All AI-generated or user-derived content must pass the safety filter before render or persist.",
  capabilitySafety: "Capabilities declare safety constraints (e.g. read_only, suggestions_only); enforce hard constraints.",
  auditTrail: "Log AI executions (capability, result status, latency) for audit; do not log secrets or PII in prompts.",
  rateLimits: "Apply per-identity, per-scope rate limits before invoking AI; return 429 with Retry-After when exceeded.",
} as const;

// ---------------------------------------------------------------------------
// Surfaces and roles
// ---------------------------------------------------------------------------

/** Surfaces where AI capabilities can be invoked. Must match capability.targetSurfaces. */
export const AI_POLICY_SURFACES = ["backoffice", "api", "editor"] as const;

export type AiPolicySurface = (typeof AI_POLICY_SURFACES)[number];

/** Role required to use AI tools through the suggest route (tool registry). Other routes may enforce differently. */
export const AI_POLICY_DEFAULT_ROLE = "superadmin" as const;

/** Whether a surface is allowed by policy. Use to gate capability selection. */
export function isSurfaceAllowed(surface: string): surface is AiPolicySurface {
  return AI_POLICY_SURFACES.includes(surface as AiPolicySurface);
}

// ---------------------------------------------------------------------------
// Safety: output filtering and capability constraints
// ---------------------------------------------------------------------------

/** Policy: all AI-generated content must be filtered through the safety layer before render or persist. */
export const AI_POLICY_REQUIRE_OUTPUT_FILTER = true;

/** Safety constraint codes that imply output must not mutate content or system (suggestions/read-only). */
export const AI_POLICY_READ_ONLY_CODES = [
  "read_only",
  "suggestions_only",
  "detection_only",
] as const;

function normalizeConstraint(c: SafetyConstraint): { code: string; enforce?: "hard" | "soft" } {
  if (typeof c === "string") return { code: c };
  return {
    code: (c as { code?: string }).code ?? "",
    enforce: (c as { enforce?: "hard" | "soft" }).enforce,
  };
}

/** Returns true if the capability has a hard read-only (or equivalent) safety constraint. */
export function hasHardReadOnlyConstraint(capability: Capability | null): boolean {
  if (!capability?.safetyConstraints?.length) return false;
  const codes = new Set(
    capability.safetyConstraints.map((c) => normalizeConstraint(c).code.trim().toLowerCase())
  );
  return AI_POLICY_READ_ONLY_CODES.some((code) => codes.has(code));
}

/** Returns true if the capability has any hard safety constraint. */
export function hasAnyHardConstraint(capability: Capability | null): boolean {
  if (!capability?.safetyConstraints?.length) return false;
  return capability.safetyConstraints.some((c) => normalizeConstraint(c).enforce === "hard");
}

// ---------------------------------------------------------------------------
// Rate limits (policy defaults; tool registry overrides per tool)
// ---------------------------------------------------------------------------

/** Default rate limit when no tool-specific limit is defined: 1 hour window, max 30 requests. */
export const AI_POLICY_DEFAULT_RATE_LIMIT = {
  windowSeconds: 3600,
  max: 30,
} as const;

// ---------------------------------------------------------------------------
// Validation and schema
// ---------------------------------------------------------------------------

/** Policy: strip keys not in capability outputSchema (prevent hallucinated fields) unless explicitly allowed. */
export const AI_POLICY_STRIP_EXTRA_OUTPUT_KEYS = true;

/** Default max depth when validating or filtering nested AI output. */
export const AI_POLICY_DEFAULT_MAX_DEPTH = 5;

// ---------------------------------------------------------------------------
// Logging and audit
// ---------------------------------------------------------------------------

/** Policy: log every AI execution (capability name, result status, latency); do not log request/response bodies or PII. */
export const AI_POLICY_LOG_EXECUTIONS = true;

/** Metadata keys that must not be logged (secrets, PII). */
export const AI_POLICY_SENSITIVE_LOG_KEYS = [
  "apiKey",
  "secret",
  "password",
  "token",
  "authorization",
  "cookie",
] as const;
