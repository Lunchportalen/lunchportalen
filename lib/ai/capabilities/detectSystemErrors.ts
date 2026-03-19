/**
 * Automatic error detection capability: detectSystemErrors.
 * Aggregates error log entries by pattern/code, assigns severity, and suggests
 * actions. Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectSystemErrors";

const detectSystemErrorsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Automatic error detection: from error log entries (message, code, statusCode, source, timestamp), aggregates by pattern, assigns severity (high/medium/low), and suggests actions. Returns detected errors with count, first/last seen, affected sources. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect system errors input",
    properties: {
      errorEntries: {
        type: "array",
        description: "Error log entries to analyze",
        items: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" },
            code: { type: "string", description: "e.g. ECONNREFUSED, ETIMEDOUT" },
            statusCode: { type: "number", description: "HTTP status (4xx, 5xx)" },
            source: { type: "string", description: "Service or component" },
            timestamp: { type: "string", description: "ISO timestamp" },
            count: { type: "number", description: "Occurrence count if pre-aggregated" },
          },
        },
      },
      timeWindowHours: {
        type: "number",
        description: "Only consider entries within last N hours (optional filter)",
      },
      minCountToReport: { type: "number", description: "Min occurrences to include (default: 1)" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["errorEntries"],
  },
  outputSchema: {
    type: "object",
    description: "System error detection result",
    required: ["detectedErrors", "totalOccurrences", "summary", "generatedAt"],
    properties: {
      detectedErrors: {
        type: "array",
        items: {
          type: "object",
          required: ["errorId", "pattern", "severity", "count", "firstSeen", "lastSeen", "suggestedAction"],
          properties: {
            errorId: { type: "string" },
            pattern: { type: "string", description: "Normalized error pattern" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            count: { type: "number" },
            firstSeen: { type: "string", description: "ISO timestamp" },
            lastSeen: { type: "string", description: "ISO timestamp" },
            suggestedAction: { type: "string" },
            affectedSources: { type: "array", items: { type: "string" } },
            statusCode: { type: "number" },
            code: { type: "string" },
          },
        },
      },
      totalOccurrences: { type: "number" },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Detection only; does not mutate logs or system.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(detectSystemErrorsCapability);

export type ErrorEntry = {
  message: string;
  code?: string | null;
  statusCode?: number | null;
  source?: string | null;
  timestamp?: string | null;
  count?: number | null;
};

export type DetectSystemErrorsInput = {
  errorEntries: ErrorEntry[];
  timeWindowHours?: number | null;
  minCountToReport?: number | null;
  locale?: "nb" | "en" | null;
};

export type DetectedError = {
  errorId: string;
  pattern: string;
  severity: "high" | "medium" | "low";
  count: number;
  firstSeen: string;
  lastSeen: string;
  suggestedAction: string;
  affectedSources?: string[];
  statusCode?: number | null;
  code?: string | null;
};

export type DetectSystemErrorsOutput = {
  detectedErrors: DetectedError[];
  totalOccurrences: number;
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Normalize message to a stable pattern: strip numbers, UUIDs, quoted strings. */
function normalizePattern(message: string, code?: string | null): string {
  let p = message
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z?\b/g, "<ts>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/"([^"]*)"/g, '"<s>"')
    .replace(/'([^']*)'/g, "'<s>'")
    .trim();
  if (p.length > 200) p = p.slice(0, 200);
  if (code) p = `[${code}] ${p}`;
  return p || "unknown";
}

function severityFromEntry(entry: ErrorEntry): "high" | "medium" | "low" {
  const code = safeStr(entry.code).toUpperCase();
  const msg = (entry.message || "").toLowerCase();
  const status = entry.statusCode;
  if (status >= 500) return "high";
  if (status >= 400) return "medium";
  if (
    code &&
    /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN|ENOMEM|EACCES/.test(code)
  )
    return "high";
  if (msg.includes("timeout") || msg.includes("fatal") || msg.includes("crash")) return "high";
  if (msg.includes("warn") || msg.includes("deprecated")) return "low";
  return "medium";
}

function suggestAction(
  _pattern: string,
  severity: string,
  code?: string | null,
  isEn?: boolean,
  statusCode?: number | null
): string {
  const c = (code || "").toUpperCase();
  if (c === "ECONNREFUSED")
    return isEn ? "Check target service is running and reachable." : "Sjekk at målservicen kjører og er nåbar.";
  if (c === "ETIMEDOUT")
    return isEn ? "Increase timeout or check network/latency." : "Øk timeout eller sjekk nettverk/latens.";
  if (c === "ENOTFOUND")
    return isEn ? "Verify hostname/DNS resolution." : "Verifiser vertsnavn/DNS-oppslag.";
  if ((statusCode != null && statusCode >= 500) || severity === "high")
    return isEn ? "Investigate server-side logs and dependencies." : "Undersøk serverlogger og avhengigheter.";
  if (severity === "medium")
    return isEn ? "Review request payload and client configuration." : "Gå gjennom forespørsel og klientkonfigurasjon.";
  return isEn ? "Monitor and triage if frequency increases." : "Overvåk og prioriter ved økning.";
}

/** Stable id from pattern (simple hash-like). */
function patternId(pattern: string): string {
  let h = 0;
  for (let i = 0; i < pattern.length; i++) {
    h = (h * 31 + pattern.charCodeAt(i)) >>> 0;
  }
  return `err_${h.toString(36)}`;
}

/**
 * Aggregates error entries by pattern, assigns severity and suggested action. Deterministic; no external calls.
 */
export function detectSystemErrors(input: DetectSystemErrorsInput): DetectSystemErrorsOutput {
  const entries = Array.isArray(input.errorEntries) ? input.errorEntries : [];
  const windowHours = Math.max(0, Number(input.timeWindowHours) || 0);
  const minCount = Math.max(1, Math.floor(Number(input.minCountToReport) || 1));
  const isEn = input.locale === "en";

  const now = Date.now();
  const cutoff = windowHours > 0 ? now - windowHours * 60 * 60 * 1000 : 0;

  const byPattern = new Map<
    string,
    { pattern: string; code?: string; statusCode?: number; count: number; first: number; last: number; sources: Set<string>; severity: "high" | "medium" | "low" }
  >();

  for (const e of entries) {
    const msg = safeStr(e.message);
    if (!msg) continue;
    const ts = e.timestamp ? new Date(e.timestamp).getTime() : now;
    if (cutoff > 0 && ts < cutoff) continue;
    const n = Math.max(1, Math.floor(Number(e.count) || 1));
    const pattern = normalizePattern(msg, e.code);
    const key = pattern;
    const sev = severityFromEntry(e);
    const source = safeStr(e.source);

    const existing = byPattern.get(key);
    if (existing) {
      existing.count += n;
      existing.first = Math.min(existing.first, ts);
      existing.last = Math.max(existing.last, ts);
      if (source) existing.sources.add(source);
      if (sev === "high" || (sev === "medium" && existing.severity === "low")) existing.severity = sev;
    } else {
      byPattern.set(key, {
        pattern,
        code: e.code ?? undefined,
        statusCode: e.statusCode ?? undefined,
        count: n,
        first: ts,
        last: ts,
        sources: source ? new Set([source]) : new Set(),
        severity: sev,
      });
    }
  }

  const detectedErrors: DetectedError[] = [];
  let totalOccurrences = 0;

  for (const [, v] of byPattern.entries()) {
    if (v.count < minCount) continue;
    totalOccurrences += v.count;
    const errorId = patternId(v.pattern);
    detectedErrors.push({
      errorId,
      pattern: v.pattern,
      severity: v.severity,
      count: v.count,
      firstSeen: new Date(v.first).toISOString(),
      lastSeen: new Date(v.last).toISOString(),
      suggestedAction: suggestAction(v.pattern, v.severity, v.code, isEn, v.statusCode),
      affectedSources: v.sources.size > 0 ? Array.from(v.sources) : undefined,
      statusCode: v.statusCode,
      code: v.code,
    });
  }

  detectedErrors.sort((a, b) => {
    if (a.severity !== b.severity) {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    }
    return b.count - a.count;
  });

  const summary = isEn
    ? `Detected ${detectedErrors.length} distinct error pattern(s), ${totalOccurrences} total occurrence(s).`
    : `Fant ${detectedErrors.length} ulike feilmønster, ${totalOccurrences} forekomster totalt.`;

  return {
    detectedErrors,
    totalOccurrences,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { detectSystemErrorsCapability, CAPABILITY_NAME };
