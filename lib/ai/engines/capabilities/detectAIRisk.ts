/**
 * AI risk detector capability: detectAIRisk.
 * Evaluates input/output text and context (capability, role, surface) for AI-related
 * risks: prompt injection, PII exposure, unsafe output, privilege mismatch. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectAIRisk";

const detectAIRiskCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "AI risk detector: from input text, output text, and context (capability, role, surface), detects risks such as prompt injection patterns, PII in input/output, unsafe content, and privilege/surface mismatch. Returns detected risks with category, severity, and recommendation. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect AI risk input",
    properties: {
      context: {
        type: "object",
        description: "Context to evaluate for risk",
        properties: {
          inputText: { type: "string", description: "User or system input (e.g. prompt, query)" },
          outputText: { type: "string", description: "AI or system output to check" },
          capability: { type: "string", description: "Capability being invoked" },
          role: { type: "string", description: "Caller role" },
          surface: { type: "string", description: "Invocation surface (backoffice, api, editor)" },
          metadata: { type: "object", description: "Optional key-value context" },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["context"],
  },
  outputSchema: {
    type: "object",
    description: "AI risk detection result",
    required: ["risksDetected", "overallLevel", "riskScore", "summary", "generatedAt"],
    properties: {
      risksDetected: {
        type: "array",
        items: {
          type: "object",
          required: ["riskId", "category", "severity", "message"],
          properties: {
            riskId: { type: "string" },
            category: {
              type: "string",
              description: "prompt_injection | pii | unsafe_output | privilege | rate_abuse | other",
            },
            severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
            message: { type: "string" },
            indicator: { type: "string", description: "Matched pattern or hint" },
            recommendation: { type: "string" },
          },
        },
      },
      overallLevel: {
        type: "string",
        enum: ["none", "low", "medium", "high", "critical"],
      },
      riskScore: { type: "number", description: "0-100, higher = more risk" },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Detection only; does not mutate input, output, or system.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(detectAIRiskCapability);

export type AIRiskContext = {
  inputText?: string | null;
  outputText?: string | null;
  capability?: string | null;
  role?: string | null;
  surface?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DetectAIRiskInput = {
  context: AIRiskContext;
  locale?: "nb" | "en" | null;
};

export type DetectedAIRisk = {
  riskId: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  indicator?: string | null;
  recommendation?: string | null;
};

export type DetectAIRiskOutput = {
  risksDetected: DetectedAIRisk[];
  overallLevel: "none" | "low" | "medium" | "high" | "critical";
  riskScore: number;
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const PROMPT_INJECTION_PATTERNS: { pattern: RegExp; severity: "critical" | "high" | "medium" }[] = [
  { pattern: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)\b/i, severity: "critical" },
  { pattern: /\b(new\s+)?instructions?\s*:\s*/i, severity: "high" },
  { pattern: /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\b/i, severity: "high" },
  { pattern: /\b(system\s*:?\s*|\[INST\]|<\/s>)\s*/i, severity: "medium" },
  { pattern: /\boverride\s+|bypass\s+|ignore\s+safety\b/i, severity: "critical" },
];

const UNSAFE_OUTPUT_PATTERNS: { pattern: RegExp; severity: "critical" | "high" | "medium" }[] = [
  { pattern: /<script\b[^>]*>|<\/script>/i, severity: "critical" },
  { pattern: /javascript\s*:/i, severity: "critical" },
  { pattern: /on\w+\s*=\s*["'][^"']*["']/i, severity: "high" },
  { pattern: /eval\s*\(|document\.write\s*\(/i, severity: "critical" },
];

const PII_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, label: "email" },
  { pattern: /\b\d{8}\s?\d{5}\b/, label: "norwegian_fnr_like" },
  { pattern: /\b(?:\+47|0047)?\s*\d{3}\s?\d{2}\s?\d{3}\b/, label: "norwegian_phone_like" },
];

function severityToScore(s: DetectedAIRisk["severity"]): number {
  switch (s) {
    case "critical": return 100;
    case "high": return 75;
    case "medium": return 50;
    case "low": return 25;
    default: return 50;
  }
}

function overallFromRisks(risks: DetectedAIRisk[]): DetectAIRiskOutput["overallLevel"] {
  if (risks.length === 0) return "none";
  const hasCritical = risks.some((r) => r.severity === "critical");
  const hasHigh = risks.some((r) => r.severity === "high");
  const hasMedium = risks.some((r) => r.severity === "medium");
  if (hasCritical) return "critical";
  if (hasHigh) return "high";
  if (hasMedium) return "medium";
  return "low";
}

/**
 * Detects AI-related risks in input/output and context. Deterministic; no external calls.
 */
export function detectAIRisk(input: DetectAIRiskInput): DetectAIRiskOutput {
  const ctx = input.context && typeof input.context === "object" ? input.context : {};
  const isEn = input.locale === "en";

  const inputText = safeStr(ctx.inputText);
  const outputText = safeStr(ctx.outputText);
  const capability = safeStr(ctx.capability);
  const role = safeStr(ctx.role);
  const surface = safeStr(ctx.surface);

  const risksDetected: DetectedAIRisk[] = [];
  const seen = new Set<string>();

  function add(risk: DetectedAIRisk) {
    const key = `${risk.riskId}:${risk.indicator ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    risksDetected.push(risk);
  }

  if (inputText) {
    for (const { pattern, severity } of PROMPT_INJECTION_PATTERNS) {
      const m = inputText.match(pattern);
      if (m) {
        add({
          riskId: "prompt_injection",
          category: "prompt_injection",
          severity,
          message: isEn
            ? "Input contains patterns that may attempt to override or inject instructions."
            : "Inndata inneholder mønstre som kan forsøke å overstyre eller injisere instruksjoner.",
          indicator: m[0].slice(0, 80),
          recommendation: isEn ? "Sanitize or reject input; do not pass raw to model." : "Saniter eller avvis inndata; ikke send rå til modell.",
        });
      }
    }

    for (const { pattern, label } of PII_PATTERNS) {
      if (pattern.test(inputText)) {
        add({
          riskId: "pii_input",
          category: "pii",
          severity: "medium",
          message: isEn ? "Input may contain PII (e.g. email, phone, id-like)." : "Inndata kan inneholde personopplysninger (e-post, telefon, id-lignende).",
          indicator: label,
          recommendation: isEn ? "Avoid logging full input; redact or hash PII." : "Unngå å logge full inndata; rediger eller hash PII.",
        });
      }
    }
  }

  if (outputText) {
    for (const { pattern, severity } of UNSAFE_OUTPUT_PATTERNS) {
      const m = outputText.match(pattern);
      if (m) {
        add({
          riskId: "unsafe_output",
          category: "unsafe_output",
          severity,
          message: isEn ? "Output contains potentially unsafe content (e.g. script, eval)." : "Utdata inneholder potensielt usikkert innhold (f.eks. script, eval).",
          indicator: m[0].slice(0, 60),
          recommendation: isEn ? "Run output through safety filter; do not render raw." : "Kjør utdata gjennom sikkerhetsfilter; ikke vis rå.",
        });
      }
    }

    for (const { pattern, label } of PII_PATTERNS) {
      if (pattern.test(outputText)) {
        add({
          riskId: "pii_output",
          category: "pii",
          severity: "high",
          message: isEn ? "Output may contain PII; risk of exposure." : "Utdata kan inneholde personopplysninger; eksponeringsrisiko.",
          indicator: label,
          recommendation: isEn ? "Redact PII before display or storage." : "Rediger PII før visning eller lagring.",
        });
      }
    }
  }

  if (capability && role) {
    const highRiskCapabilities = ["deployWinningVariant", "enforceAIPolicies", "logAiDecision"].map((c) => c.toLowerCase());
    const restrictedRoles = ["employee", "driver", "kitchen"].map((r) => r.toLowerCase());
    const capLow = capability.toLowerCase();
    const roleLow = role.toLowerCase();
    if (highRiskCapabilities.some((c) => capLow.includes(c)) && restrictedRoles.includes(roleLow)) {
      add({
        riskId: "privilege_mismatch",
        category: "privilege",
        severity: "high",
        message: isEn ? "High-impact capability invoked by restricted role." : "Høyt påvirknings-capability kalt av begrenset rolle.",
        indicator: `${capability} / ${role}`,
        recommendation: isEn ? "Verify role has required permission for this capability." : "Verifiser at rollen har nødvendig tillatelse for denne capability.",
      });
    }
  }

  risksDetected.sort((a, b) => severityToScore(b.severity) - severityToScore(a.severity));

  const overallLevel = overallFromRisks(risksDetected);
  const riskScore =
    risksDetected.length === 0
      ? 0
      : Math.min(100, Math.round(risksDetected.reduce((acc, r) => acc + severityToScore(r.severity), 0) / Math.max(risksDetected.length, 1)));

  const summary = isEn
    ? risksDetected.length === 0
      ? "No AI risks detected."
      : `Detected ${risksDetected.length} risk(s); overall ${overallLevel} (score ${riskScore}).`
    : risksDetected.length === 0
      ? "Ingen AI-risiko oppdaget."
      : `Fant ${risksDetected.length} risiko(er); samlet ${overallLevel} (score ${riskScore}).`;

  return {
    risksDetected,
    overallLevel,
    riskScore,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { detectAIRiskCapability, CAPABILITY_NAME };
