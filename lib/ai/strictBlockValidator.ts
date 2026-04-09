/**
 * Structural validation: exact component types, no unknown fields, all schema fields present, value kinds.
 */

import {
  COMPONENT_REGISTRY,
  isAiComponentType,
  isRegistryEnumDef,
  type AiComponentType,
  type RegistryFieldDef,
} from "@/lib/cms/blocks/componentRegistry";

function str(v: unknown): string {
  return typeof v === "string" ? String(v) : "";
}

function validateFieldValue(field: string, def: RegistryFieldDef, value: unknown): void {
  if (isRegistryEnumDef(def)) {
    if (typeof value !== "string") {
      throw new Error(`Invalid field: ${field}`);
    }
    if (!def.includes(value)) {
      throw new Error(`Invalid field: ${field}`);
    }
    return;
  }
  if (def === "text" || def === "textarea" || def === "media" || def === "link") {
    if (typeof value !== "string") {
      throw new Error(`Invalid field: ${field}`);
    }
    return;
  }
}

/**
 * One flat block: `type` + exactly the keys in {@link COMPONENT_REGISTRY}[type].fields.
 */
export function validateStrictBlock(block: Record<string, unknown>): void {
  const type = str(block.type).trim();
  if (!type) {
    throw new Error("Invalid component type");
  }
  if (!isAiComponentType(type)) {
    throw new Error("Invalid component type");
  }

  const def = COMPONENT_REGISTRY[type as AiComponentType];
  const schemaFields = def.fields as Record<string, RegistryFieldDef>;

  for (const key of Object.keys(block)) {
    if (key !== "type" && !(key in schemaFields)) {
      throw new Error(`Invalid field: ${key}`);
    }
  }

  for (const field of Object.keys(schemaFields)) {
    if (!(field in block)) {
      throw new Error(`Missing field: ${field}`);
    }
    validateFieldValue(field, schemaFields[field]!, block[field]);
  }
}

/**
 * Validates an array of blocks (same rules as {@link validateStrictBlock} per item).
 */
export function validateStrict(blocks: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(blocks)) {
    throw new Error("Ugyldig svar: forventet liste med blokker.");
  }
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < blocks.length; i++) {
    const raw = blocks[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Blokk ${i + 1}: ugyldig form.`);
    }
    const b = raw as Record<string, unknown>;
    validateStrictBlock(b);
    out.push(b);
  }
  return out;
}
