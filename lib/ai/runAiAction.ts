/**
 * Unified AI action interface.
 * Validates capability and input schema, attaches metadata, returns structured output.
 * No direct LLM calls; foundation for future inference wiring.
 */

import { makeRid, isoNow } from "@/lib/http/rid";
import type { Capability, SchemaRef } from "./capabilityRegistry";
import { getCapability } from "./capabilityRegistry";

/** Input payload passed as context to runAiAction. */
export type AiActionContext = Record<string, unknown>;

/** Metadata attached to every action result. */
export type AiActionMetadata = {
  rid: string;
  timestamp: string;
  capability: string;
};

export type RunAiActionSuccess = {
  ok: true;
  rid: string;
  data: AiActionContext;
  metadata: AiActionMetadata;
};

export type RunAiActionError = {
  ok: false;
  rid: string;
  error: string;
  message: string;
  status: number;
};

export type RunAiActionResult = RunAiActionSuccess | RunAiActionError;

function validateInputAgainstSchema(
  context: AiActionContext,
  inputSchema: SchemaRef
): { valid: true } | { valid: false; message: string } {
  const required = inputSchema.required;
  if (Array.isArray(required) && required.length > 0) {
    for (const key of required) {
      if (!(key in context)) {
        return { valid: false, message: `Missing required input: ${key}` };
      }
    }
  }

  const properties = inputSchema.properties;
  if (properties && typeof properties === "object") {
    for (const key of Object.keys(context)) {
      const prop = properties[key];
      if (prop && typeof prop === "object" && "type" in prop) {
        const expected = (prop as { type?: string }).type;
        const value = context[key];
        if (expected === "string" && typeof value !== "string" && value !== undefined && value !== null) {
          return { valid: false, message: `Input "${key}" must be a string` };
        }
        if (expected === "number" && typeof value !== "number" && value !== undefined && value !== null) {
          return { valid: false, message: `Input "${key}" must be a number` };
        }
        if (expected === "boolean" && typeof value !== "boolean" && value !== undefined && value !== null) {
          return { valid: false, message: `Input "${key}" must be a boolean` };
        }
        if (expected === "object" && (value === null || (typeof value !== "object"))) {
          return { valid: false, message: `Input "${key}" must be an object` };
        }
        if (expected === "array" && !Array.isArray(value) && value !== undefined && value !== null) {
          return { valid: false, message: `Input "${key}" must be an array` };
        }
      }
    }
  }

  return { valid: true };
}

function resolveCapability(capability: Capability | string): Capability | null {
  if (typeof capability === "string") {
    return getCapability(capability.trim());
  }
  if (
    capability &&
    typeof capability === "object" &&
    typeof capability.name === "string" &&
    Array.isArray(capability.requiredContext) &&
    capability.inputSchema &&
    typeof capability.inputSchema === "object" &&
    capability.outputSchema &&
    typeof capability.outputSchema === "object"
  ) {
    return capability;
  }
  return null;
}

/**
 * Runs an AI action: validates capability and input schema, attaches metadata, returns structured output.
 * No LLM invocation; use for validation and metadata envelope only.
 */
export function runAiAction(
  capability: Capability | string,
  context: AiActionContext
): RunAiActionResult {
  const rid = makeRid("AI");

  const cap = resolveCapability(capability);
  if (!cap) {
    return {
      ok: false,
      rid,
      error: "INVALID_CAPABILITY",
      message:
        typeof capability === "string"
          ? `Capability not registered: ${capability}`
          : "Invalid capability object (missing name, requiredContext, or schemas)",
      status: 400,
    };
  }

  const missingContext = cap.requiredContext.filter((key) => !(key in context));
  if (missingContext.length > 0) {
    return {
      ok: false,
      rid,
      error: "MISSING_CONTEXT",
      message: `Missing required context: ${missingContext.join(", ")}`,
      status: 400,
    };
  }

  const schemaResult = validateInputAgainstSchema(context, cap.inputSchema);
  if (schemaResult.valid === false) {
    return {
      ok: false,
      rid,
      error: "INVALID_INPUT",
      message: schemaResult.message,
      status: 422,
    };
  }

  const timestamp = isoNow();
  const metadata: AiActionMetadata = {
    rid,
    timestamp,
    capability: cap.name,
  };

  return {
    ok: true,
    rid,
    data: { ...context },
    metadata,
  };
}
