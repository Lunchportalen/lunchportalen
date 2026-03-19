/**
 * AI decision audit trail capability: auditAIDecisions.
 * Builds an audit trail view from AI decision entries: filter, sort, and summarize
 * for compliance and review. Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "auditAIDecisions";

const auditAIDecisionsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "AI decision audit trail: from a set of AI decision log entries, filters by capability/resultStatus/time range, sorts by timestamp, and returns an audit trail with summary (total, by capability, by status). For compliance and explainability review. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Audit AI decisions input",
    properties: {
      entries: {
        type: "array",
        description: "AI decision log entries to build audit trail from",
        items: {
          type: "object",
          required: ["capability", "decision", "rationale", "loggedAt"],
          properties: {
            capability: { type: "string" },
            decision: { type: "string" },
            rationale: { type: "string" },
            loggedAt: { type: "string", description: "ISO timestamp" },
            rid: { type: "string" },
            resultStatus: { type: "string", enum: ["success", "failure"] },
            inputSummary: { type: "string" },
            outputSummary: { type: "string" },
          },
        },
      },
      capabilityFilter: {
        type: "string",
        description: "Only include entries for this capability (exact match)",
      },
      resultStatusFilter: {
        type: "string",
        enum: ["success", "failure"],
        description: "Only include entries with this result status",
      },
      fromTimestamp: { type: "string", description: "ISO timestamp; entries before this excluded" },
      toTimestamp: { type: "string", description: "ISO timestamp; entries after this excluded" },
      sortOrder: { type: "string", enum: ["asc", "desc"], description: "By loggedAt (default: desc)" },
      limit: { type: "number", description: "Max entries in trail (default: 100)" },
      locale: { type: "string", description: "Locale (nb | en) for summary messages" },
    },
    required: ["entries"],
  },
  outputSchema: {
    type: "object",
    description: "AI decision audit trail result",
    required: ["auditTrail", "summary", "generatedAt"],
    properties: {
      auditTrail: {
        type: "array",
        items: {
          type: "object",
          required: ["sequence", "capability", "decision", "rationale", "loggedAt"],
          properties: {
            sequence: { type: "number" },
            capability: { type: "string" },
            decision: { type: "string" },
            rationale: { type: "string" },
            loggedAt: { type: "string" },
            rid: { type: "string" },
            resultStatus: { type: "string" },
            inputSummary: { type: "string" },
            outputSummary: { type: "string" },
          },
        },
      },
      summary: {
        type: "object",
        required: ["total", "byCapability", "byStatus", "from", "to"],
        properties: {
          total: { type: "number" },
          byCapability: { type: "object", additionalProperties: { type: "number" } },
          byStatus: { type: "object", additionalProperties: { type: "number" } },
          from: { type: "string", description: "Earliest loggedAt in trail" },
          to: { type: "string", description: "Latest loggedAt in trail" },
        },
      },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Audit trail is read-only; does not mutate logs or system.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(auditAIDecisionsCapability);

export type AuditDecisionEntryInput = {
  capability: string;
  decision: string;
  rationale: string;
  loggedAt: string;
  rid?: string | null;
  resultStatus?: "success" | "failure" | null;
  inputSummary?: string | null;
  outputSummary?: string | null;
};

export type AuditAIDecisionsInput = {
  entries: AuditDecisionEntryInput[];
  capabilityFilter?: string | null;
  resultStatusFilter?: "success" | "failure" | null;
  fromTimestamp?: string | null;
  toTimestamp?: string | null;
  sortOrder?: "asc" | "desc" | null;
  limit?: number | null;
  locale?: "nb" | "en" | null;
};

export type AuditTrailEntry = {
  sequence: number;
  capability: string;
  decision: string;
  rationale: string;
  loggedAt: string;
  rid?: string | null;
  resultStatus?: string | null;
  inputSummary?: string | null;
  outputSummary?: string | null;
};

export type AuditTrailSummary = {
  total: number;
  byCapability: Record<string, number>;
  byStatus: Record<string, number>;
  from: string | null;
  to: string | null;
};

export type AuditAIDecisionsOutput = {
  auditTrail: AuditTrailEntry[];
  summary: AuditTrailSummary;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseTime(s: string | null | undefined): number {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Builds an audit trail from decision entries with optional filters and sort. Deterministic; no external calls.
 */
export function auditAIDecisions(input: AuditAIDecisionsInput): AuditAIDecisionsOutput {
  const entries = Array.isArray(input.entries) ? input.entries : [];
  const capabilityFilter = safeStr(input.capabilityFilter);
  const resultStatusFilter = input.resultStatusFilter === "success" || input.resultStatusFilter === "failure" ? input.resultStatusFilter : null;
  const fromTs = parseTime(input.fromTimestamp);
  const toTs = parseTime(input.toTimestamp);
  const sortOrder = input.sortOrder === "asc" || input.sortOrder === "desc" ? input.sortOrder : "desc";
  const limit = Math.max(1, Math.min(1000, Math.floor(Number(input.limit) || 100)));

  const filtered = entries.filter((e) => {
    const cap = safeStr(e.capability);
    if (!cap || !safeStr(e.loggedAt)) return false;
    if (capabilityFilter && cap !== capabilityFilter) return false;
    const status = e.resultStatus === "success" || e.resultStatus === "failure" ? e.resultStatus : null;
    if (resultStatusFilter && status !== resultStatusFilter) return false;
    const t = parseTime(e.loggedAt);
    if (fromTs > 0 && t < fromTs) return false;
    if (toTs > 0 && t > toTs) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const ta = parseTime(a.loggedAt);
    const tb = parseTime(b.loggedAt);
    return sortOrder === "desc" ? tb - ta : ta - tb;
  });

  const sliced = filtered.slice(0, limit);

  const byCapability: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let from: string | null = null;
  let to: string | null = null;

  const auditTrail: AuditTrailEntry[] = sliced.map((e, i) => {
    const cap = safeStr(e.capability);
    byCapability[cap] = (byCapability[cap] ?? 0) + 1;
    const status = e.resultStatus === "success" || e.resultStatus === "failure" ? e.resultStatus : "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const loggedAt = safeStr(e.loggedAt);
    if (loggedAt) {
      if (!from || loggedAt < from) from = loggedAt;
      if (!to || loggedAt > to) to = loggedAt;
    }
    return {
      sequence: i + 1,
      capability: cap,
      decision: safeStr(e.decision),
      rationale: safeStr(e.rationale),
      loggedAt,
      rid: e.rid ?? undefined,
      resultStatus: e.resultStatus ?? undefined,
      inputSummary: e.inputSummary ?? undefined,
      outputSummary: e.outputSummary ?? undefined,
    };
  });

  const summary: AuditTrailSummary = {
    total: auditTrail.length,
    byCapability,
    byStatus,
    from,
    to,
  };

  return {
    auditTrail,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { auditAIDecisionsCapability, CAPABILITY_NAME };
