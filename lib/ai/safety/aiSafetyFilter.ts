/**
 * AI safety filter: prevent HTML injection and unsafe scripts.
 * Use on any AI-generated or user-derived content before rendering or persisting.
 * Deterministic; no external calls.
 */

/** Result of checking a string for unsafe content. */
export type SafetyCheckResult = {
  safe: boolean;
  /** If unsafe, short reason (e.g. "script_tag", "javascript_url"). */
  reason?: string;
};

/** Options for filtering a payload (object/array). */
export type FilterPayloadOptions = {
  /** Max recursion depth (default 10). */
  maxDepth?: number;
  /** If true, strip HTML from strings; if false, only check (default true). */
  stripUnsafe?: boolean;
};

const DEFAULT_MAX_DEPTH = 10;

// Patterns for unsafe content (case-insensitive where relevant)
const SCRIPT_TAG = /<script\b[\s\S]*?<\/script\s*>/gi;
const STYLE_TAG = /<style\b[\s\S]*?<\/style\s*>/gi;
const ANY_TAG = /<[^>]+>/g;
const JAVASCRIPT_URL = /javascript\s*:/gi;
const DATA_HTML_OR_SCRIPT = /data\s*:\s*text\/html|data\s*:\s*application\/javascript|data\s*:\s*text\/javascript/gi;
const VBSCRIPT_URL = /vbscript\s*:/gi;
const EVENT_HANDLER = /\bon\w+\s*=\s*["']?[^"'\s>]*/gi;
const EXPRESSION_OR_BEHAVIOR = /expression\s*\(|behavior\s*:/gi;

/**
 * Decodes common HTML entities so we can reliably detect tags and scripts.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#x[\da-f]+/gi, (match) => {
      const code = parseInt(match.slice(2).replace(";", ""), 16);
      return String.fromCharCode(code);
    })
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.slice(2).replace(";", ""), 10);
      return String.fromCharCode(code);
    });
}

/**
 * Returns whether the string contains content considered unsafe (HTML injection or scripts).
 * Uses match() to avoid mutating global regex lastIndex.
 */
export function isUnsafe(value: string): SafetyCheckResult {
  if (typeof value !== "string") return { safe: true };
  const decoded = decodeEntities(value);
  if (decoded.match(SCRIPT_TAG)) return { safe: false, reason: "script_tag" };
  if (decoded.match(STYLE_TAG)) return { safe: false, reason: "style_tag" };
  if (decoded.match(JAVASCRIPT_URL)) return { safe: false, reason: "javascript_url" };
  if (decoded.match(DATA_HTML_OR_SCRIPT)) return { safe: false, reason: "data_script_url" };
  if (decoded.match(VBSCRIPT_URL)) return { safe: false, reason: "vbscript_url" };
  if (decoded.match(EVENT_HANDLER)) return { safe: false, reason: "event_handler" };
  if (decoded.match(EXPRESSION_OR_BEHAVIOR)) return { safe: false, reason: "expression_behavior" };
  if (decoded.match(ANY_TAG)) return { safe: false, reason: "html_tag" };
  return { safe: true };
}

/**
 * Escapes a string for safe insertion into HTML text context (no tags).
 */
function escapeForText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Filters a string: removes HTML and script content, then escapes for safe output.
 * Use for any AI-generated or untrusted string before display or persistence.
 * Uses new RegExp per replace to avoid mutating shared global regex state.
 */
export function filterString(value: string): string {
  if (typeof value !== "string") return "";
  let s = value;
  s = decodeEntities(s);
  s = s.replace(new RegExp(SCRIPT_TAG.source, "gi"), "");
  s = s.replace(new RegExp(STYLE_TAG.source, "gi"), "");
  s = s.replace(new RegExp(JAVASCRIPT_URL.source, "gi"), "");
  s = s.replace(new RegExp(DATA_HTML_OR_SCRIPT.source, "gi"), "");
  s = s.replace(new RegExp(VBSCRIPT_URL.source, "gi"), "");
  s = s.replace(new RegExp(EVENT_HANDLER.source, "gi"), "");
  s = s.replace(new RegExp(EXPRESSION_OR_BEHAVIOR.source, "gi"), "");
  s = s.replace(new RegExp(ANY_TAG.source, "g"), "");
  return escapeForText(s);
}

/**
 * Recursively filters all string values in a payload (object or array).
 * Nested objects/arrays are processed up to maxDepth. Non-string primitives are left as-is.
 */
export function filterPayload(
  payload: unknown,
  options: FilterPayloadOptions = {}
): unknown {
  const maxDepth = typeof options.maxDepth === "number" && options.maxDepth >= 0
    ? options.maxDepth
    : DEFAULT_MAX_DEPTH;
  const stripUnsafe = options.stripUnsafe !== false;

  function go(val: unknown, depth: number): unknown {
    if (depth > maxDepth) return val;
    if (val === null || val === undefined) return val;
    if (typeof val === "string") {
      return stripUnsafe ? filterString(val) : val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => go(item, depth + 1));
    }
    if (typeof val === "object" && val !== null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        out[k] = go(v, depth + 1);
      }
      return out;
    }
    return val;
  }

  return go(payload, 0);
}

/**
 * Returns true if the payload contains any string that fails the safety check.
 * Use when you need to reject rather than strip (e.g. strict API).
 */
export function payloadHasUnsafeContent(payload: unknown, maxDepth = DEFAULT_MAX_DEPTH): boolean {
  function check(val: unknown, depth: number): boolean {
    if (depth > maxDepth) return false;
    if (typeof val === "string") return !isUnsafe(val).safe;
    if (Array.isArray(val)) return val.some((item) => check(item, depth + 1));
    if (typeof val === "object" && val !== null) {
      return Object.values(val).some((v) => check(v, depth + 1));
    }
    return false;
  }
  return check(payload, 0);
}
