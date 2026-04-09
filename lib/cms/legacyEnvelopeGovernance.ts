/**
 * U26 — Trygg overgang fra flat/legacy body til kanonisk envelope uten ny sannhetsmotor.
 */

import {
  isBlockTypeAllowedForDocumentType,
  validateBodyPayloadBlockAllowlist,
} from "@/lib/cms/blockAllowlistGovernance";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { parseBodyEnvelope, serializeBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { getDocType } from "@/lib/cms/contentDocumentTypes";

export function validateBlockTypesForDocumentTypeAlias(
  documentTypeAlias: string,
  blockTypes: ReadonlyArray<string | undefined>,
  mergedBlockEditorDataTypes?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): { ok: true } | { ok: false; forbidden: string[] } {
  const forbidden: string[] = [];
  for (const t of blockTypes) {
    const key = String(t ?? "").trim();
    if (!key) continue;
    if (!isBlockTypeAllowedForDocumentType(documentTypeAlias, key, mergedBlockEditorDataTypes, mergedDocumentTypes)) {
      forbidden.push(key);
    }
  }
  return forbidden.length === 0 ? { ok: true } : { ok: false, forbidden: [...new Set(forbidden)] };
}

/** U26 — AI apply preflight når side har dokumenttype (legacy uten DT = ingen ekstra sjekk). */
export function validateEditorBlockTypesForGovernedApply(
  documentTypeAlias: string | null,
  editorBlocks: ReadonlyArray<{ type: string }>,
  mergedBlockEditorDataTypes?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): { ok: true } | { ok: false; message: string } {
  if (!documentTypeAlias || documentTypeAlias.trim() === "") return { ok: true };
  const r = validateBlockTypesForDocumentTypeAlias(
    documentTypeAlias.trim(),
    editorBlocks.map((b) => b.type),
    mergedBlockEditorDataTypes,
    mergedDocumentTypes,
  );
  if (r.ok === false) {
    return {
      ok: false,
      message: `Blokktyper ikke tillatt for dokumenttype «${documentTypeAlias}»: ${r.forbidden.join(", ")}`,
    };
  }
  return { ok: true };
}

/**
 * Bygger serialisert envelope fra legacy (uten documentType) og validerer allowlist.
 * Brukes ikke til automatisk migrering i batch — kun til forhåndsjekk og dokumentasjon.
 */
export function previewNormalizeLegacyBodyToEnvelope(
  documentTypeAlias: string,
  rawBody: unknown,
  mergedBlockEditorDataTypes?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): { ok: true; payload: unknown } | { ok: false; reason: string } {
  const alias = documentTypeAlias.trim();
  if (!getDocType(alias)) {
    return { ok: false, reason: "Ukjent dokumenttype." };
  }
  const env = parseBodyEnvelope(rawBody);
  if (env.documentType != null && String(env.documentType).trim() !== "") {
    return { ok: false, reason: "Innhold har allerede dokumenttype i envelope." };
  }
  const blocksBody =
    env.blocksBody !== "" && env.blocksBody != null ? env.blocksBody : { version: 1, blocks: [] };
  const fields =
    env.fields && typeof env.fields === "object" && !Array.isArray(env.fields) ? env.fields : {};
  const serialized = serializeBodyEnvelope({
    documentType: alias,
    fields: fields as Record<string, unknown>,
    blocksBody,
  });
  const v = validateBodyPayloadBlockAllowlist(serialized, mergedBlockEditorDataTypes, mergedDocumentTypes);
  if (v.ok === false) {
    const reason =
      v.error === "INVALID_DOCUMENT_TYPE"
        ? "Dokumenttype matcher ikke register."
        : `Blokktyper ikke tillatt: ${v.forbidden.join(", ")}`;
    return {
      ok: false,
      reason,
    };
  }
  return { ok: true, payload: serialized };
}
