/**
 * U27 — Read-only governance/usage-aggregat fra variant-body (ingen migrering, ingen ny sannhetsmotor).
 * U28 — Coverage: allowlist faktisk OK vs brudd (governed varianter).
 */

import { validateBodyPayloadBlockAllowlist } from "@/lib/cms/blockAllowlistGovernance";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { parseBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { extractBlockTypeKeysFromBodyPayload } from "@/lib/cms/extractBlocksSource";

export type GovernanceUsageSummary = {
  /** Antall rader som faktisk ble skannet (kan være cap). */
  scannedVariants: number;
  /** Totalt i DB hvis count-forespørsel lyktes. */
  totalVariantsInDb: number | null;
  /** Avviklet: skanning stoppet før alle rader. */
  scanCapped: boolean;
  governedVariants: number;
  legacyVariants: number;
  /** U28 — Governed der allowlist er grønn. */
  governedAllowlistOk: number;
  /** U28 — Governed der blokktyper bryter allowlist. */
  governedAllowlistFail: number;
  /** U28 — Governed med ukjent documentType i register. */
  invalidDocumentTypeVariants: number;
  byDocumentType: Record<string, number>;
  blockTypeCounts: Record<string, number>;
  /** Unike side-IDer med minst én legacy-variant (av skannede rader). */
  legacyPageIds: string[];
  /** Maks antall IDer returnert i liste (klient/review). */
  legacyPageIdSampleCap: number;
};

const LEGACY_PAGE_ID_CAP = 200;

function uniquePageIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Aggregerer tellinger fra rader med `page_id` + `body` (typisk content_page_variants).
 */
export function summarizeGovernanceFromVariantRows(
  rows: ReadonlyArray<{ page_id: string; body: unknown }>,
  mergedBlockEditorDataTypes?: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypeDefinitions?: Record<string, DocumentTypeDefinition> | null,
): Omit<GovernanceUsageSummary, "totalVariantsInDb" | "scanCapped"> {
  let governedVariants = 0;
  let legacyVariants = 0;
  let governedAllowlistOk = 0;
  let governedAllowlistFail = 0;
  let invalidDocumentTypeVariants = 0;
  const byDocumentType: Record<string, number> = {};
  const blockTypeCounts: Record<string, number> = {};
  const legacyPageIds: string[] = [];

  for (const row of rows) {
    const env = parseBodyEnvelope(row.body);
    const hasDt = env.documentType != null && String(env.documentType).trim() !== "";
    if (hasDt) {
      governedVariants++;
      const alias = String(env.documentType).trim();
      byDocumentType[alias] = (byDocumentType[alias] ?? 0) + 1;
      const av = validateBodyPayloadBlockAllowlist(row.body, mergedBlockEditorDataTypes, mergedDocumentTypeDefinitions);
      if (av.ok === true) {
        governedAllowlistOk++;
      } else if (av.error === "INVALID_DOCUMENT_TYPE") {
        invalidDocumentTypeVariants++;
      } else {
        governedAllowlistFail++;
      }
    } else {
      legacyVariants++;
      legacyPageIds.push(row.page_id);
    }
    for (const k of extractBlockTypeKeysFromBodyPayload(row.body)) {
      blockTypeCounts[k] = (blockTypeCounts[k] ?? 0) + 1;
    }
  }

  const cappedLegacy = uniquePageIds(legacyPageIds).slice(0, LEGACY_PAGE_ID_CAP);

  return {
    scannedVariants: rows.length,
    governedVariants,
    legacyVariants,
    governedAllowlistOk,
    governedAllowlistFail,
    invalidDocumentTypeVariants,
    byDocumentType,
    blockTypeCounts,
    legacyPageIds: cappedLegacy,
    legacyPageIdSampleCap: LEGACY_PAGE_ID_CAP,
  };
}
