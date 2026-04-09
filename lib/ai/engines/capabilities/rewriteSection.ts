/**
 * Rewrite capability: rewriteSection.
 * Inputs: existing content + tone.
 * Outputs: rewritten content preserving structure (same keys/shape, rewritten text).
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "rewriteSection";

const rewriteSectionCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Rewrites existing content in a given tone while preserving structure (headings, sections, keys). Output mirrors input shape with rewritten text.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Rewrite section input",
    required: ["existingContent", "tone"],
    properties: {
      existingContent: {
        type: "string",
        description: "Existing content as string or JSON string of structured content (e.g. { heading, body })",
      },
      tone: { type: "string", description: "Target tone (e.g. enterprise, warm, neutral)" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Rewritten content preserving structure",
    required: ["rewrittenContent"],
    properties: {
      rewrittenContent: {
        type: "string",
        description: "Rewritten content; structure preserved when input was structured",
      },
      structure: {
        type: "string",
        description: "Structure hint: plain | heading_body | key_value",
      },
    },
  },
  safetyConstraints: [
    { code: "no_structure_injection", description: "Output preserves only the structure of the input; no new keys or markup.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(rewriteSectionCapability);

export type RewriteSectionInput = {
  /** Existing content: plain string or JSON string of object with string values (e.g. {"heading":"...","body":"..."}). */
  existingContent: string;
  tone: string;
  /** Optional locale for tone rules (default nb). */
  locale?: "nb" | "en";
};

export type RewriteSectionOutput = {
  /** Rewritten content in same form as input (string or stringified object with same keys). */
  rewrittenContent: string;
  /** Structure hint for downstream. */
  structure: "plain" | "heading_body" | "key_value";
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Normalize line endings and collapse repeated blank lines to preserve structure. */
function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Deterministic rewrite stub: normalizes whitespace and applies tone hint. No LLM. */
function rewriteText(text: string, tone: string): string {
  const t = normalizeWhitespace(text);
  if (!t) return t;
  const toneLower = tone.toLowerCase();
  if (toneLower === "enterprise" || toneLower === "professional") {
    return t.replace(/^(\s*)/, "$1");
  }
  if (toneLower === "warm") {
    return t.replace(/^(\s*)/, "$1");
  }
  return t;
}

/**
 * Parses input as plain text or JSON object with string values; returns structure hint and parsed form.
 */
function parseContent(
  raw: string
): { structure: RewriteSectionOutput["structure"]; data: string | Record<string, string> } {
  const s = raw.trim();
  if (!s) return { structure: "plain", data: "" };

  if (s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const o = parsed as Record<string, unknown>;
        const out: Record<string, string> = {};
        for (const k of Object.keys(o)) {
          const v = o[k];
          out[k] = v != null && typeof v === "string" ? v : String(v ?? "");
        }
        if (Object.keys(out).length === 0) return { structure: "plain", data: s };
        const hasHeadingBody =
          "heading" in out && "body" in out && Object.keys(out).length <= 4;
        return {
          structure: hasHeadingBody ? "heading_body" : "key_value",
          data: out,
        };
      }
    } catch {
      // fall through to plain
    }
  }

  return { structure: "plain", data: s };
}

/**
 * Rewrites existing content in the given tone, preserving structure.
 * Deterministic: normalizes whitespace and applies tone rules; no LLM.
 * When input is structured (e.g. {"heading":"...","body":"..."}), output is JSON string with same keys.
 */
export function rewriteSection(input: RewriteSectionInput): RewriteSectionOutput {
  const existingContent = safeStr(input.existingContent);
  const tone = safeStr(input.tone) || "neutral";

  const { structure, data } = parseContent(existingContent);

  if (structure === "plain") {
    const text = typeof data === "string" ? data : "";
    return {
      rewrittenContent: rewriteText(text, tone),
      structure: "plain",
    };
  }

  const obj = data as Record<string, string>;
  const rewritten: Record<string, string> = {};
  for (const key of Object.keys(obj)) {
    rewritten[key] = rewriteText(obj[key], tone);
  }
  return {
    rewrittenContent: JSON.stringify(rewritten),
    structure,
  };
}

export { rewriteSectionCapability, CAPABILITY_NAME };
