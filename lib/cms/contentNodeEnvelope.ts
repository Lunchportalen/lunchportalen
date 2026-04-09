/**
 * U98 — Content node field layers: invariant vs culture, aligned with Document Type property.variation.
 */

import {
  parseBodyEnvelope,
  type CmsVariantPublishLayer,
  type ParsedBodyEnvelope,
} from "@/lib/cms/bodyEnvelopeContract";
import type { DocumentTypeDefinition, PropertyTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";

export type { CmsVariantPublishLayer };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

export function getPropertyVariation(p: PropertyTypeDefinition): "invariant" | "culture" {
  return p.variation === "invariant" ? "invariant" : "culture";
}

export function listInvariantPropertyAliases(doc: DocumentTypeDefinition | null | undefined): string[] {
  if (!doc) return [];
  return doc.properties.filter((p) => getPropertyVariation(p) === "invariant").map((p) => p.alias);
}

/** Scalar document-type properties rendered in the inspector (excludes block body). */
export function listScalarDocumentTypeProperties(doc: DocumentTypeDefinition | null | undefined): PropertyTypeDefinition[] {
  if (!doc) return [];
  return doc.properties.filter((p) => {
    const hints = p.editorHints;
    const kind = hints && typeof hints === "object" && "kind" in hints ? String((hints as { kind?: string }).kind) : "";
    return kind === "scalar_text" || p.dataTypeAlias === "cms_text_line" || p.dataTypeAlias === "cms_text_area";
  });
}

/**
 * After parseBodyEnvelope, move keys from culture → invariant when schema says invariant (legacy rows used flat `fields`).
 */
export function normalizeEditorFieldLayers(
  body: unknown,
  mergedDoc: DocumentTypeDefinition | null | undefined,
): { invariantFields: Record<string, unknown>; cultureFields: Record<string, unknown> } {
  const e: ParsedBodyEnvelope = parseBodyEnvelope(body);
  const invariantFields = isPlainObject(e.invariantFields) ? { ...e.invariantFields } : {};
  const cultureFields = isPlainObject(e.cultureFields) ? { ...e.cultureFields } : {};
  if (!mergedDoc) {
    return { invariantFields, cultureFields };
  }
  const invAliases = new Set(listInvariantPropertyAliases(mergedDoc));
  for (const alias of invAliases) {
    if (alias in cultureFields && !(alias in invariantFields)) {
      invariantFields[alias] = cultureFields[alias];
      delete cultureFields[alias];
    }
  }
  return { invariantFields, cultureFields };
}

export function mergeFieldLayersForParseCompat(invariantFields: Record<string, unknown>, cultureFields: Record<string, unknown>) {
  return { ...invariantFields, ...cultureFields };
}

export function stampVariantPublishLayer(pageStatus: "draft" | "published"): CmsVariantPublishLayer {
  return {
    state: pageStatus,
    updatedAt: new Date().toISOString(),
  };
}
