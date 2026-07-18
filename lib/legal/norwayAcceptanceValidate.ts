/**
 * Pure validation helpers for Norway clickwrap (unit-testable, no DB).
 */
import {
  getNorwayDocument,
  NORWAY_REQUIRED_DOCS_BY_ROLE,
  type NorwaySubjectRole,
} from "@/lib/legal/norwayDocuments";
import type { LegalDocumentType } from "@/lib/legal/legalDocumentRegistry";
import { requiresReconsent } from "@/lib/legal/legalAcceptance";

export type NorwayAcceptanceInput = {
  documentType: string;
  documentVersion: string;
  documentChecksum: string;
  accepted: unknown;
};

export function validateNorwayAcceptanceBatch(p: {
  role: NorwaySubjectRole;
  acceptances: NorwayAcceptanceInput[] | null | undefined;
}): { ok: true; items: Array<{ documentType: LegalDocumentType; documentVersion: string; documentChecksum: string }> } | { ok: false; code: string } {
  if (!Array.isArray(p.acceptances) || p.acceptances.length === 0) {
    return { ok: false, code: "ACCEPTANCE_REQUIRED" };
  }
  const required = NORWAY_REQUIRED_DOCS_BY_ROLE[p.role];
  const seen = new Set<string>();
  const items: Array<{ documentType: LegalDocumentType; documentVersion: string; documentChecksum: string }> = [];

  for (const raw of p.acceptances) {
    if (raw?.accepted !== true) return { ok: false, code: "UNCHECKED_BLOCKED" };
    const documentType = String(raw.documentType || "") as LegalDocumentType;
    if (!required.includes(documentType)) return { ok: false, code: "DOCUMENT_NOT_ALLOWED_FOR_ROLE" };
    if (seen.has(documentType)) return { ok: false, code: "DUPLICATE_ACCEPTANCE" };
    const doc = getNorwayDocument(documentType);
    if (!doc) return { ok: false, code: "DOCUMENT_NOT_FOUND" };
    if (doc.version !== String(raw.documentVersion || "") || doc.checksum !== String(raw.documentChecksum || "")) {
      return { ok: false, code: "STALE_OR_MISMATCHED_VERSION" };
    }
    seen.add(documentType);
    items.push({
      documentType,
      documentVersion: doc.version,
      documentChecksum: doc.checksum,
    });
  }

  for (const type of required) {
    if (!seen.has(type)) return { ok: false, code: "ACCEPTANCE_REQUIRED" };
  }
  return { ok: true, items };
}

export function roleCannotAcceptOtherRoleDocs(
  actorRole: NorwaySubjectRole,
  documentType: LegalDocumentType,
): boolean {
  return !NORWAY_REQUIRED_DOCS_BY_ROLE[actorRole].includes(documentType);
}

export function needsReacceptance(prev: { documentVersion: string; documentChecksum: string } | null, documentType: LegalDocumentType): boolean {
  const doc = getNorwayDocument(documentType);
  if (!doc) return true;
  return requiresReconsent(prev, { version: doc.version, checksum: doc.checksum });
}
