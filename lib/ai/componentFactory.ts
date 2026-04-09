/**
 * Default shapes for AI components. Does not write source files at runtime (security / review).
 * Unknown types require a human-added component + registry entry.
 */

import {
  COMPONENT_REGISTRY,
  isAiComponentType,
  isRegistryEnumDef,
  type AiComponentType,
  type RegistryFieldDef,
} from "@/lib/cms/blocks/componentRegistry";

function emptyBlock(type: AiComponentType): Record<string, unknown> {
  const fields = COMPONENT_REGISTRY[type].fields as Record<string, RegistryFieldDef>;
  const o: Record<string, unknown> = { type };
  for (const key of Object.keys(fields)) {
    const def = fields[key]!;
    if (isRegistryEnumDef(def)) {
      o[key] = def.includes("center") ? "center" : (def[0] ?? "");
    } else {
      o[key] = "";
    }
  }
  return o;
}

/**
 * Deterministic starter object for a registered AI component (prompt repair / tests).
 */
export function createComponent(type: string): Record<string, unknown> {
  if (!isAiComponentType(type)) {
    throw new Error(
      `Unknown component «${type}». Legg til type i COMPONENT_REGISTRY, renderBlock, editor og ev. components/blocks/${type}.tsx (manuelt).`,
    );
  }
  return emptyBlock(type);
}

/**
 * Fill missing keys with defaults; does not create new component types.
 */
export function mergeComponentDefaults(type: string, partial: Record<string, unknown>): Record<string, unknown> {
  const base = createComponent(type);
  return { ...base, ...partial, type };
}
