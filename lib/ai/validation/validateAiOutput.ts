/**
 * AI result validator: enforce output schema, strip unsafe HTML, detect hallucinated fields, ensure deterministic structure.
 * No external API calls; pure validation and normalization.
 * HTML/script stripping delegates to lib/ai/safety/aiSafetyFilter.
 */

import type { SchemaRef } from "../capabilityRegistry";
import { filterString } from "../safety/aiSafetyFilter";

export type ValidateAiOutputSuccess = {
  ok: true;
  data: Record<string, unknown>;
  /** Present only on error, but optional here so callers can read `.errors` on the union without casts. */
  errors?: string[];
};

export type ValidateAiOutputError = {
  ok: false;
  errors: string[];
};

export type ValidateAiOutputResult = ValidateAiOutputSuccess | ValidateAiOutputError;

/** Options for validation. */
export type ValidateAiOutputOptions = {
  /** If false (default), keys not in outputSchema.properties are stripped (hallucinated fields). */
  allowAdditionalProperties?: boolean;
  /** Max recursion depth for nested objects/arrays (default 5). */
  maxDepth?: number;
};

const DEFAULT_MAX_DEPTH = 5;

/**
 * Strips unsafe HTML and scripts from a string. Delegates to AI safety filter (script tags, javascript: URLs, event handlers, etc.).
 * Safe for display in text contexts.
 */
export function stripUnsafeHtml(value: string): string {
  return filterString(value);
}

function getSchemaProperties(schema: SchemaRef): Record<string, unknown> {
  const p = schema.properties;
  if (p && typeof p === "object" && !Array.isArray(p)) return p;
  return {};
}

function getSchemaRequired(schema: SchemaRef): string[] {
  const r = schema.required;
  if (Array.isArray(r)) return r.filter((k) => typeof k === "string");
  return [];
}

function getPropertyType(prop: unknown): string | undefined {
  if (!prop || typeof prop !== "object" || Array.isArray(prop)) return undefined;
  const t = (prop as Record<string, unknown>).type;
  return typeof t === "string" ? t : undefined;
}

function typeCheck(key: string, value: unknown, expectedType: string): string | null {
  if (value === undefined || value === null) return null;
  switch (expectedType) {
    case "string":
      return typeof value !== "string" ? `"${key}" must be a string` : null;
    case "number":
      return typeof value !== "number" || Number.isNaN(value) ? `"${key}" must be a number` : null;
    case "boolean":
      return typeof value !== "boolean" ? `"${key}" must be a boolean` : null;
    case "object":
      return typeof value !== "object" || value === null || Array.isArray(value)
        ? `"${key}" must be an object`
        : null;
    case "array":
      return !Array.isArray(value) ? `"${key}" must be an array` : null;
    default:
      return null;
  }
}

function normalizeToDeterministicObject(
  obj: Record<string, unknown>,
  keyOrder: string[]
): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const k of keyOrder) {
    if (k in obj) {
      ordered[k] = obj[k];
      seen.add(k);
    }
  }
  const rest = Object.keys(obj)
    .filter((k) => !seen.has(k))
    .sort();
  for (const k of rest) ordered[k] = obj[k];
  return ordered;
}

function processValue(
  value: unknown,
  propSchema: unknown,
  depth: number,
  maxDepth: number,
  stripHtml: boolean
): unknown {
  if (depth > maxDepth) return value;

  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return stripHtml ? stripUnsafeHtml(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => processValue(item, undefined, depth + 1, maxDepth, stripHtml));
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(o).sort();
    for (const k of keys) {
      out[k] = processValue(o[k], undefined, depth + 1, maxDepth, stripHtml);
    }
    return out;
  }

  return value;
}

/**
 * Validates AI output against the output schema: enforces types and required keys,
 * strips unsafe HTML from strings, removes hallucinated fields (when allowAdditionalProperties is false),
 * and returns a deterministic key-ordered object.
 */
export function validateAiOutput(
  rawOutput: unknown,
  outputSchema: SchemaRef,
  options: ValidateAiOutputOptions = {}
): ValidateAiOutputResult {
  const allowExtra = options.allowAdditionalProperties === true;
  const maxDepth = typeof options.maxDepth === "number" && options.maxDepth >= 0
    ? options.maxDepth
    : DEFAULT_MAX_DEPTH;

  const errors: string[] = [];

  if (rawOutput !== null && typeof rawOutput !== "object") {
    return { ok: false, errors: ["Output must be an object"] };
  }
  const raw = (rawOutput ?? {}) as Record<string, unknown>;

  const properties = getSchemaProperties(outputSchema);
  const required = getSchemaRequired(outputSchema);
  const allowedKeys = new Set<string>(Object.keys(properties));

  for (const key of required) {
    if (!(key in raw)) {
      errors.push(`Missing required field: ${key}`);
    }
  }

  const result: Record<string, unknown> = {};
  const schemaKeyOrder = Object.keys(properties);

  for (const key of schemaKeyOrder) {
    const prop = properties[key];
    const expectedType = getPropertyType(prop);
    const value = raw[key];

    if (value === undefined || value === null) {
      if (required.includes(key)) continue;
      result[key] = value;
      continue;
    }

    const err = expectedType ? typeCheck(key, value, expectedType) : null;
    if (err) {
      errors.push(err);
      continue;
    }

    const stripHtml = typeof (prop as Record<string, unknown>)?.stripHtml === "boolean"
      ? (prop as Record<string, unknown>).stripHtml as boolean
      : expectedType === "string";
    result[key] = processValue(value, prop, 0, maxDepth, stripHtml);
  }

  if (allowExtra) {
    const extraKeys = Object.keys(raw).filter((k) => !allowedKeys.has(k)).sort();
    for (const k of extraKeys) {
      result[k] = processValue(raw[k], undefined, 0, maxDepth, true);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const deterministic = normalizeToDeterministicObject(result, schemaKeyOrder);
  return { ok: true, data: deterministic };
}
