/**
 * Deterministic validation: AI output must be flat JSON blocks only (no JSX/HTML).
 */

import {
  COMPONENT_REGISTRY,
  type AiComponentType,
  type RegistryFieldDef,
  isRegistryEnumDef,
} from "@/lib/cms/blocks/componentRegistry";
import { validateStrictBlock } from "@/lib/ai/strictBlockValidator";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function str(v: unknown): string {
  return typeof v === "string" ? String(v) : "";
}

/**
 * Reject raw markup in serialized model output (defense in depth).
 */
export function rejectAiHardcodedMarkup(serialized: string): void {
  if (serialized.includes("<") || serialized.includes("</")) {
    throw new Error("AI tried to generate HTML");
  }
}

/**
 * Every block must declare `type` and match {@link COMPONENT_REGISTRY} exactly (no extra keys).
 */
export function validateComponents(blocks: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(blocks)) {
    throw new Error("Ugyldig svar: forventet liste med blokker.");
  }
  if (blocks.length === 0) {
    throw new Error("Ingen blokker i svaret.");
  }
  if (blocks.length > 24) {
    throw new Error("For mange blokker (maks 24).");
  }

  const out: Array<Record<string, unknown>> = [];

  for (let i = 0; i < blocks.length; i++) {
    const item = blocks[i];
    if (!isPlainObject(item)) {
      throw new Error(`Blokk ${i + 1}: ugyldig form.`);
    }

    try {
      validateStrictBlock(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Blokk ${i + 1}: ${msg}`);
    }

    const type = str(item.type).trim() as AiComponentType;
    const schema = COMPONENT_REGISTRY[type].fields as Record<string, RegistryFieldDef>;
    const cleaned: Record<string, unknown> = { type };

    for (const field of Object.keys(schema)) {
      const v = item[field];
      const def = schema[field]!;
      if (isRegistryEnumDef(def)) {
        cleaned[field] = str(v);
        continue;
      }
      if (typeof v === "string") {
        cleaned[field] = v;
        continue;
      }
      throw new Error(`Blokk ${i + 1} (${type}): felt «${field}» har ugyldig type.`);
    }

    out.push(cleaned);
  }

  return out;
}
