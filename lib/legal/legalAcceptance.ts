/**
 * Legal document acceptance + re-consent (Phase 15G.2).
 * Technical completion of versioning/acceptance — not LEGAL_APPROVED.
 */

import { createHash } from "node:crypto";
import type { LegalDocumentVersion } from "@/lib/legal/legalDocumentRegistry";

export type AcceptanceRecord = {
  id: string;
  subjectType: "provider" | "company" | "employee";
  subjectId: string;
  countryCode: string;
  locale: string;
  documentType: string;
  documentVersion: string;
  documentChecksum: string;
  acceptedAt: string;
  acceptanceMethod: "clickwrap" | "api" | "admin_import_forbidden";
};

export function assertLocaleMatch(doc: LegalDocumentVersion, locale: string): void {
  if (doc.locale !== locale) {
    throw new Error(`WRONG_LOCALE_FALLBACK_FORBIDDEN:${locale}->${doc.locale}`);
  }
}

export function requiresReconsent(
  previous: Pick<AcceptanceRecord, "documentVersion" | "documentChecksum"> | null,
  next: Pick<LegalDocumentVersion, "version" | "checksum">,
): boolean {
  if (!previous) return true;
  return previous.documentVersion !== next.version || previous.documentChecksum !== next.checksum;
}

export function recordAcceptance(args: {
  id: string;
  subjectType: AcceptanceRecord["subjectType"];
  subjectId: string;
  doc: LegalDocumentVersion;
  acceptedAt: string;
  method: "clickwrap" | "api";
}): AcceptanceRecord {
  assertLocaleMatch(args.doc, args.doc.locale);
  if (args.method === ("admin_import_forbidden" as never)) {
    throw new Error("ADMIN_IMPORT_ACCEPTANCE_FORBIDDEN");
  }
  return {
    id: args.id,
    subjectType: args.subjectType,
    subjectId: args.subjectId,
    countryCode: args.doc.countryCode,
    locale: args.doc.locale,
    documentType: args.doc.documentType,
    documentVersion: args.doc.version,
    documentChecksum: args.doc.checksum,
    acceptedAt: args.acceptedAt,
    acceptanceMethod: args.method,
  };
}

export function assertNoRawI18nKeys(body: string): void {
  if (/\b[a-z]+(\.[a-z0-9_]+){2,}\b/.test(body) && body.includes("i18n.")) {
    throw new Error("RAW_I18N_KEY_IN_LEGAL_BODY");
  }
  if (body.includes("{{") || body.includes("t(")) {
    throw new Error("TEMPLATE_KEY_IN_LEGAL_BODY");
  }
}

export function acceptanceAuditHash(record: AcceptanceRecord): string {
  return createHash("sha256")
    .update(
      [
        record.subjectType,
        record.subjectId,
        record.countryCode,
        record.locale,
        record.documentType,
        record.documentVersion,
        record.documentChecksum,
        record.acceptedAt,
      ].join("|"),
      "utf8",
    )
    .digest("hex");
}
