/**
 * U98 — When invariant scalar fields change, replicate invariant layer to sibling locale variants (same page + environment).
 */

import { parseBodyEnvelope, serializeBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { listInvariantPropertyAliases } from "@/lib/cms/contentNodeEnvelope";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

/** Merge incoming invariant keys into a stored body JSON (preserves culture + blocks). */
export function mergeInvariantLayerIntoBody(
  existingBody: unknown,
  patchInvariant: Record<string, unknown>,
  mergedDoc: DocumentTypeDefinition | null | undefined,
): unknown {
  const e = parseBodyEnvelope(existingBody);
  const allowed = new Set(listInvariantPropertyAliases(mergedDoc));
  const nextInv = isPlainObject(e.invariantFields) ? { ...e.invariantFields } : {};
  for (const [k, v] of Object.entries(patchInvariant)) {
    if (allowed.has(k)) nextInv[k] = v;
  }
  return serializeBodyEnvelope({
    documentType: e.documentType,
    invariantFields: nextInv,
    cultureFields: isPlainObject(e.cultureFields) ? e.cultureFields : {},
    blocksBody: e.blocksBody,
    cmsSaveStamp: e.cmsSaveStamp,
    cmsVariantPublish: e.cmsVariantPublish,
  });
}
