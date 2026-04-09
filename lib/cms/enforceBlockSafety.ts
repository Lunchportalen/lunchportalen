/**

 * Global block data safety before render (additive defaults).

 * Complements {@link enforceBlockComponentSafety} (layout tokens per type).

 */



import { COMPONENT_REGISTRY } from "@/lib/cms/blocks/componentRegistry";



const VARIANT_BLOCK_TYPES = new Set(

  Object.keys(COMPONENT_REGISTRY).filter((k) => {

    const fields = COMPONENT_REGISTRY[k as keyof typeof COMPONENT_REGISTRY]?.fields;

    return fields && "variant" in fields;

  }),

);



/**

 * Ensures a safe `variant` token exists on `data` for registry block types that declare `variant`.

 * Mutates `data` in place (same contract as normalizeBlockForRender).

 */

export function enforceBlockSafety(type: string, data: Record<string, unknown>): Record<string, unknown> {

  if (!VARIANT_BLOCK_TYPES.has(type)) {

    return data;

  }

  const v = data.variant;

  if (v == null || (typeof v === "string" && v.trim() === "")) {

    data.variant = "center";

  }

  return data;

}

