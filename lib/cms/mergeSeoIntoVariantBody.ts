import type { PageAiContract } from "@/lib/cms/model/pageAiContract";
import { mergeContractIntoMeta } from "@/lib/cms/model/pageAiContractHelpers";

/**
 * Oppdaterer kun `body.meta.seo` på variant — samme kontrakt som innholdsredigerer (ingen ny tabell).
 */
export function mergeSeoFieldsIntoVariantBody(
  existingBody: unknown,
  seo: { title?: string; description?: string; canonical?: string },
): Record<string, unknown> {
  const root =
    existingBody && typeof existingBody === "object" && !Array.isArray(existingBody)
      ? ({ ...(existingBody as Record<string, unknown>) } as Record<string, unknown>)
      : { version: 1, blocks: [] };

  const meta =
    root.meta && typeof root.meta === "object" && !Array.isArray(root.meta)
      ? ({ ...(root.meta as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  const contract: Partial<PageAiContract> = {};
  const seoPatch: NonNullable<PageAiContract["seo"]> = {};
  if (seo.title !== undefined) seoPatch.title = seo.title;
  if (seo.description !== undefined) seoPatch.description = seo.description;
  if (seo.canonical !== undefined) seoPatch.canonical = seo.canonical;
  if (Object.keys(seoPatch).length > 0) {
    contract.seo = seoPatch;
  }

  const nextMeta = mergeContractIntoMeta(meta, contract);
  return { ...root, meta: nextMeta };
}
