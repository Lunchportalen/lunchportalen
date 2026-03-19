/**
 * AI safety enforcement capability: validateAiOutput.
 * Validates AI output against a schema and enforces safety: type checks, required fields,
 * strip unsafe HTML from strings, strip hallucinated (extra) keys. Wraps lib/ai/validation/validateAiOutput.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability, SchemaRef } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";
import {
  validateAiOutput as validateAiOutputImpl,
  type ValidateAiOutputOptions,
  type ValidateAiOutputResult,
} from "../validation/validateAiOutput";

const CAPABILITY_NAME = "validateAiOutput";

const validateAiOutputCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Enforces AI output safety: validates raw output against an output schema (types, required fields), strips unsafe HTML/scripts from strings, removes hallucinated (extra) keys. Returns validated data or errors.",
  requiredContext: ["rawOutput", "outputSchema"],
  inputSchema: {
    type: "object",
    description: "AI output validation input",
    properties: {
      rawOutput: { type: "object", description: "Raw AI output to validate" },
      outputSchema: {
        type: "object",
        description: "JSON Schema–compatible output schema (properties, required)",
      },
      options: {
        type: "object",
        description: "Optional: allowAdditionalProperties, maxDepth",
        properties: {
          allowAdditionalProperties: { type: "boolean" },
          maxDepth: { type: "number" },
        },
      },
    },
    required: ["rawOutput", "outputSchema"],
  },
  outputSchema: {
    type: "object",
    description: "Validation result",
    required: ["ok"],
    properties: {
      ok: { type: "boolean" },
      data: { type: "object", description: "Present when ok is true" },
      errors: {
        type: "array",
        items: { type: "string" },
        description: "Present when ok is false",
      },
    },
  },
  safetyConstraints: [
    {
      code: "enforcement_only",
      description: "Output is validation result only; strips unsafe content, does not mutate external state.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(validateAiOutputCapability);

export type ValidateAiOutputCapabilityInput = {
  rawOutput: unknown;
  outputSchema: SchemaRef;
  options?: ValidateAiOutputOptions | null;
};

/**
 * AI safety enforcement: validates raw AI output against schema, strips unsafe HTML, strips extra keys.
 * Use before persisting or rendering any AI-generated content.
 */
export function validateAiOutput(
  rawOutput: unknown,
  outputSchema: SchemaRef,
  options?: ValidateAiOutputOptions
): ValidateAiOutputResult {
  return validateAiOutputImpl(rawOutput, outputSchema, options ?? {});
}

/**
 * Invokes the capability with a context object (rawOutput, outputSchema, options).
 * Returns the same result as validateAiOutput(rawOutput, outputSchema, options).
 */
export function validateAiOutputFromContext(input: ValidateAiOutputCapabilityInput): ValidateAiOutputResult {
  const raw = input.rawOutput;
  const schema = input.outputSchema;
  const opts = input.options ?? {};
  return validateAiOutputImpl(raw, schema, opts);
}

export type { ValidateAiOutputOptions, ValidateAiOutputResult } from "../validation/validateAiOutput";
export { stripUnsafeHtml } from "../validation/validateAiOutput";

export { validateAiOutputCapability, CAPABILITY_NAME };
