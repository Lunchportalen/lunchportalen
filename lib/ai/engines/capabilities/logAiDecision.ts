/**
 * AI explainability log capability: logAiDecision.
 * Defines the schema for logging an AI decision for explainability: decision, rationale, input/output summaries, rid.
 * Use buildAiDecisionEntry() to produce a sanitized payload; persist via logAiExecution (metadata) or aiDecisionLog.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "logAiDecision";

const logAiDecisionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Logs an AI decision for explainability: records what was decided, why (rationale), and optional input/output summaries. Produces a sanitized payload for ai_activity_log metadata; no PII in summaries.",
  requiredContext: ["capability", "decision", "rationale"],
  inputSchema: {
    type: "object",
    description: "AI decision log input",
    properties: {
      capability: { type: "string", description: "Capability or tool name that produced the decision" },
      decision: { type: "string", description: "What was decided (e.g. chosen option, recommendation)" },
      rationale: { type: "string", description: "Why (short explanation for audit)" },
      inputSummary: { type: "string", description: "Optional short summary of inputs (no PII)" },
      outputSummary: { type: "string", description: "Optional short summary of outputs (no PII)" },
      rid: { type: "string", description: "Optional request/execution id for correlation" },
      resultStatus: { type: "string", description: "success | failure" },
    },
    required: ["capability", "decision", "rationale"],
  },
  outputSchema: {
    type: "object",
    description: "AI decision log entry (for metadata)",
    required: ["loggedAt", "rid", "explainability"],
    properties: {
      loggedAt: { type: "string", description: "ISO timestamp" },
      rid: { type: "string" },
      explainability: { type: "boolean" },
      decision: { type: "string" },
      rationale: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "audit_only", description: "Output is log payload only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(logAiDecisionCapability);

export type LogAiDecisionInput = {
  capability: string;
  decision: string;
  rationale: string;
  inputSummary?: string | null;
  outputSummary?: string | null;
  rid?: string | null;
  resultStatus?: "success" | "failure" | null;
};

/** Sanitized payload suitable for ai_activity_log.metadata. No PII; summaries truncated. */
export type AiDecisionLogEntry = {
  explainability: true;
  loggedAt: string;
  rid: string;
  decision: string;
  rationale: string;
  inputSummary?: string;
  outputSummary?: string;
  resultStatus?: "success" | "failure";
};

const MAX_SUMMARY_LENGTH = 500;

function truncate(s: string, max: number): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trim() + "…";
}

/**
 * Builds a sanitized AI decision log entry for explainability. No PII; summaries truncated.
 * Use the result as metadata when calling logAiExecution or the aiDecisionLog logger.
 */
export function buildAiDecisionEntry(input: LogAiDecisionInput): AiDecisionLogEntry {
  const capability = (input.capability ?? "").trim() || "unknown";
  const decision = (input.decision ?? "").trim() || "";
  const rationale = (input.rationale ?? "").trim() || "";
  const rid = (input.rid ?? "").trim() || `AI-${Date.now()}`;
  const resultStatus = input.resultStatus === "failure" ? "failure" : "success";

  const entry: AiDecisionLogEntry = {
    explainability: true,
    loggedAt: new Date().toISOString(),
    rid,
    decision: truncate(decision, MAX_SUMMARY_LENGTH),
    rationale: truncate(rationale, MAX_SUMMARY_LENGTH),
    resultStatus,
  };

  if (input.inputSummary != null && String(input.inputSummary).trim()) {
    entry.inputSummary = truncate(String(input.inputSummary).trim(), MAX_SUMMARY_LENGTH);
  }
  if (input.outputSummary != null && String(input.outputSummary).trim()) {
    entry.outputSummary = truncate(String(input.outputSummary).trim(), MAX_SUMMARY_LENGTH);
  }

  return entry;
}

export { logAiDecisionCapability, CAPABILITY_NAME };
