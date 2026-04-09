/**
 * U95 — Document type / property → Block Editor Data Type references (read-only, code registry).
 */
import { documentTypes } from "@/lib/cms/contentDocumentTypes";

export type BlockEditorDataTypeReference = {
  documentTypeAlias: string;
  documentTypeName: string;
  propertyKey: "body.blocks";
};

export function listReferencesForBlockEditorDataTypeAlias(dataTypeAlias: string): BlockEditorDataTypeReference[] {
  const a = String(dataTypeAlias ?? "").trim();
  if (!a) return [];
  return documentTypes
    .filter((d) => d.blockEditorDataTypeAlias === a)
    .map((d) => ({
      documentTypeAlias: d.alias,
      documentTypeName: d.name,
      propertyKey: "body.blocks" as const,
    }));
}

export function blockEditorDataTypeReferencesByAlias(): Record<string, BlockEditorDataTypeReference[]> {
  const out: Record<string, BlockEditorDataTypeReference[]> = {};
  for (const d of documentTypes) {
    const key = d.blockEditorDataTypeAlias?.trim();
    if (!key) continue;
    if (!out[key]) out[key] = [];
    out[key].push({
      documentTypeAlias: d.alias,
      documentTypeName: d.name,
      propertyKey: "body.blocks",
    });
  }
  return out;
}
