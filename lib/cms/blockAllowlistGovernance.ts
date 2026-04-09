/**
 * U24 — Block allowlist per document type (kode-registry + server/klient-håndheving).
 */

import { parseBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { extractBlockTypeKeysFromBodyPayload } from "@/lib/cms/extractBlocksSource";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import {
  getBlockEditorDataType,
  getBlockEditorDataTypeAliasForDocument,
} from "@/lib/cms/blocks/blockEditorDataTypes";
import { getDocType, type DocumentTypeEntry } from "@/lib/cms/contentDocumentTypes";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { EDITOR_BLOCK_CREATE_OPTIONS } from "@/lib/cms/editorBlockCreateOptions";

const ALL_EDITOR_BLOCK_TYPES: readonly string[] = EDITOR_BLOCK_CREATE_OPTIONS.map((o) => o.type);

function resolveBlockEditorDataTypeForAllowlist(
  documentTypeAlias: string,
  merged?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): BlockEditorDataTypeDefinition | undefined {
  const bdtKey = getBlockEditorDataTypeAliasForDocument(documentTypeAlias, mergedDocumentTypes);
  if (!bdtKey) return undefined;
  if (merged && merged[bdtKey]) return merged[bdtKey];
  return getBlockEditorDataType(bdtKey);
}

/** Effektive tillatte blokktyper: null = alle editor-typer (legacy uten dokumenttype). */
export function getEffectiveAllowedBlockTypeKeys(
  documentTypeAlias: string | null | undefined,
  mergedBlockEditorDataTypes?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): string[] | null {
  const a = documentTypeAlias != null ? String(documentTypeAlias).trim() : "";
  if (!a) return null;
  const dt = getDocType(a);
  if (!dt) return [];
  const bdtKey = getBlockEditorDataTypeAliasForDocument(a, mergedDocumentTypes);
  if (bdtKey) {
    const bdt = resolveBlockEditorDataTypeForAllowlist(a, mergedBlockEditorDataTypes, mergedDocumentTypes);
    if (!bdt) return [];
    return [...bdt.allowedBlockAliases];
  }
  if (dt.allowedBlockTypes === undefined) {
    return [...ALL_EDITOR_BLOCK_TYPES];
  }
  return [...dt.allowedBlockTypes];
}

export function isBlockTypeAllowedForDocumentType(
  documentTypeAlias: string | null | undefined,
  blockType: string,
  mergedBlockEditorDataTypes?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): boolean {
  const allowed = getEffectiveAllowedBlockTypeKeys(documentTypeAlias, mergedBlockEditorDataTypes, mergedDocumentTypes);
  if (allowed === null) return true;
  const t = String(blockType ?? "").trim();
  if (!t) return false;
  return allowed.includes(t);
}

export type BlockAllowlistValidationResult =
  | { ok: true }
  | {
      ok: false;
      error: "INVALID_DOCUMENT_TYPE" | "BLOCK_TYPES_NOT_ALLOWED";
      forbidden: string[];
      documentType: string;
    };

/**
 * Validerer payload som lagres i `content_page_variants.body`.
 * Legacy (uten documentType i envelope): ingen sjekk.
 */
export function validateBodyPayloadBlockAllowlist(
  resolvedBodyPayload: unknown,
  mergedBlockEditorDataTypes?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypes?: Record<string, DocumentTypeDefinition> | null,
): BlockAllowlistValidationResult {
  const env = parseBodyEnvelope(resolvedBodyPayload);
  const doc = env.documentType != null ? String(env.documentType).trim() : "";
  if (!doc) {
    return { ok: true };
  }

  const dt: DocumentTypeEntry | null = getDocType(doc);
  if (!dt) {
    return { ok: false, error: "INVALID_DOCUMENT_TYPE", forbidden: [], documentType: doc };
  }

  const allowed = getEffectiveAllowedBlockTypeKeys(doc, mergedBlockEditorDataTypes, mergedDocumentTypes);
  if (allowed === null) {
    return { ok: true };
  }
  const used = extractBlockTypeKeysFromBodyPayload(resolvedBodyPayload);
  const forbidden = used.filter((t) => !allowed.includes(t));
  if (forbidden.length > 0) {
    return { ok: false, error: "BLOCK_TYPES_NOT_ALLOWED", forbidden: [...new Set(forbidden)], documentType: doc };
  }
  return { ok: true };
}
