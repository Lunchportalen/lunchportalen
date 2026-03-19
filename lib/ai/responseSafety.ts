/**
 * Live-path AI response safety: validate and filter before returning to CMS/editor.
 * Wires validateAiOutput (schema + strip HTML) and aiSafetyFilter (reject/filter unsafe).
 * Use in app/api/backoffice/ai/* routes before jsonOk or DB insert.
 */

import type { SchemaRef } from "./capabilityRegistry";

/** Minimal schema for suggest-route output (ToolSuggestionPayload). All keys optional; allow extra for patch.ops etc. */
export const SUGGEST_OUTPUT_SCHEMA: SchemaRef = {
  type: "object",
  properties: {
    summary: { type: "string" },
    patch: { type: "object" },
    metaSuggestion: { type: "object" },
    candidates: { type: "array" },
    suggestionIds: { type: "array" },
    experimentId: { type: "string" },
    issues: { type: "array" },
    stats: { type: "object" },
    variants: { type: "array" },
  },
  required: [],
};
import { validateAiOutput } from "./validation/validateAiOutput";
import { payloadHasUnsafeContent, filterPayload } from "./safety/aiSafetyFilter";

export type PrepareAiResponseSuccess = {
  ok: true;
  data: Record<string, unknown>;
  /**
   * Optional fields are present only on error in practice.
   * They are included here so callers can safely read `.message` / `.reason` on the union type.
   */
  message?: string;
  reason?: "VALIDATION_FAILED" | "AI_SAFETY_REJECTED";
  errors?: string[];
};

export type PrepareAiResponseError = {
  ok: false;
  reason: "VALIDATION_FAILED" | "AI_SAFETY_REJECTED";
  errors?: string[];
  message?: string;
};

export type ValidateAndPrepareResult = PrepareAiResponseSuccess | PrepareAiResponseError;

export type ValidateAndPrepareOptions = {
  /** If true, run validateAiOutput with outputSchema first (allowAdditionalProperties when schema has no required). */
  outputSchema?: SchemaRef;
  /** Passed to validateAiOutput when outputSchema is set. */
  allowAdditionalProperties?: boolean;
  /** Max depth for filterPayload (default 10). */
  maxDepth?: number;
};

/**
 * Validates (when schema provided) and safety-filters AI response payload.
 * 1. If outputSchema provided: validate with validateAiOutput; on failure return VALIDATION_FAILED (fail closed).
 * 2. If payload contains unsafe content (script, HTML injection): return AI_SAFETY_REJECTED (explicit failure).
 * 3. Otherwise: filterPayload and return cleaned data.
 * Use before returning AI data to client or storing in DB.
 */
export function validateAndPrepareAiResponse(
  payload: unknown,
  options: ValidateAndPrepareOptions = {}
): ValidateAndPrepareResult {
  const maxDepth = typeof options.maxDepth === "number" && options.maxDepth >= 0 ? options.maxDepth : 10;
  let data: Record<string, unknown>;

  if (options.outputSchema) {
    const validation = validateAiOutput(payload, options.outputSchema, {
      allowAdditionalProperties: options.allowAdditionalProperties ?? true,
      maxDepth,
    });
    if (!validation.ok) {
      return {
        ok: false,
        reason: "VALIDATION_FAILED",
        errors: validation.errors,
        message: validation.errors?.join("; ") ?? "Validation failed",
      };
    }
    data = validation.data;
  } else {
    if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
      data = payload as Record<string, unknown>;
    } else {
      return {
        ok: false,
        reason: "VALIDATION_FAILED",
        errors: ["Output must be an object"],
        message: "Output must be an object",
      };
    }
  }

  if (payloadHasUnsafeContent(data, maxDepth)) {
    return {
      ok: false,
      reason: "AI_SAFETY_REJECTED",
      message: "AI response contained unsafe content and was rejected.",
    };
  }

  const filtered = filterPayload(data, { maxDepth, stripUnsafe: true });
  const filteredObj =
    filtered !== null && typeof filtered === "object" && !Array.isArray(filtered)
      ? (filtered as Record<string, unknown>)
      : {};
  return { ok: true, data: filteredObj };
}

/**
 * Safety-only: no schema validation. Rejects if unsafe, otherwise returns filterPayload result.
 * Use for routes that return free-form AI output (e.g. page-builder, block-builder, text-improve).
 */
export function prepareAiResponseForClient(
  payload: unknown,
  options: { maxDepth?: number } = {}
): PrepareAiResponseSuccess | (PrepareAiResponseError & { reason: "AI_SAFETY_REJECTED" }) {
  const maxDepth = typeof options.maxDepth === "number" && options.maxDepth >= 0 ? options.maxDepth : 10;
  const obj =
    payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  if (payloadHasUnsafeContent(obj, maxDepth)) {
    return {
      ok: false,
      reason: "AI_SAFETY_REJECTED",
      message: "AI response contained unsafe content and was rejected.",
    };
  }
  const filtered = filterPayload(obj, { maxDepth, stripUnsafe: true });
  const filteredObj =
    filtered !== null && typeof filtered === "object" && !Array.isArray(filtered)
      ? (filtered as Record<string, unknown>)
      : {};
  return { ok: true, data: filteredObj };
}
