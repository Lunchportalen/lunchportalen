/**
 * Official source ingestion pipeline (Phase 15G.1).
 * Approvals are never auto-set. Evidence change expires linked approvals.
 */

import { createHash } from "node:crypto";
import { assertOfficialSourceUrl, isOfficialSourceUrl } from "@/lib/tax/sources/allowedOfficialDomains";

export const SOURCE_PARSER_VERSION = "15g1.1.0";

export type SourceType =
  | "tax_rate_table"
  | "tax_guidance"
  | "invoice_mandate"
  | "e_invoice_mandate"
  | "legal_statute"
  | "privacy_guidance"
  | "dor_bulletin";

export type ReviewerStatus = "UNREVIEWED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";

export type TaxSourceRecord = {
  id: string;
  countryCode: string;
  jurisdictionCode: string | null;
  authorityName: string;
  officialDomain: string;
  sourceUrl: string;
  sourceTitle: string;
  legalReference: string | null;
  publicationDate: string | null;
  retrievedAt: string;
  validFrom: string | null;
  validTo: string | null;
  language: string;
  checksum: string;
  sourceType: SourceType;
  parserVersion: string;
  extractedClaims: readonly string[];
  reviewerStatus: ReviewerStatus;
  reviewerId: string | null;
  reviewedAt: string | null;
};

export type SourceIngestInput = {
  id: string;
  countryCode: string;
  jurisdictionCode?: string | null;
  authorityName: string;
  sourceUrl: string;
  sourceTitle: string;
  legalReference?: string | null;
  publicationDate?: string | null;
  retrievedAt: string;
  validFrom?: string | null;
  validTo?: string | null;
  language: string;
  sourceType: SourceType;
  bodyOrCanonicalText: string;
  extractedClaims?: readonly string[];
};

export function checksumCanonicalText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function ingestOfficialSource(input: SourceIngestInput): TaxSourceRecord {
  assertOfficialSourceUrl(input.sourceUrl);
  const officialDomain = new URL(input.sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
  return {
    id: input.id,
    countryCode: input.countryCode.toUpperCase(),
    jurisdictionCode: input.jurisdictionCode ?? null,
    authorityName: input.authorityName,
    officialDomain,
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
    legalReference: input.legalReference ?? null,
    publicationDate: input.publicationDate ?? null,
    retrievedAt: input.retrievedAt,
    validFrom: input.validFrom ?? null,
    validTo: input.validTo ?? null,
    language: input.language,
    checksum: checksumCanonicalText(input.bodyOrCanonicalText),
    sourceType: input.sourceType,
    parserVersion: SOURCE_PARSER_VERSION,
    extractedClaims: input.extractedClaims ?? [],
    reviewerStatus: "UNREVIEWED",
    reviewerId: null,
    reviewedAt: null,
  };
}

export function detectDuplicateSources(
  sources: readonly TaxSourceRecord[],
): Array<{ a: string; b: string; reason: string }> {
  const dups: Array<{ a: string; b: string; reason: string }> = [];
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i]!;
      const b = sources[j]!;
      if (a.sourceUrl === b.sourceUrl && a.checksum === b.checksum) {
        dups.push({ a: a.id, b: b.id, reason: "SAME_URL_AND_CHECKSUM" });
      } else if (a.checksum === b.checksum && a.countryCode === b.countryCode) {
        dups.push({ a: a.id, b: b.id, reason: "SAME_CHECKSUM_SAME_COUNTRY" });
      }
    }
  }
  return dups;
}

export function detectChecksumDrift(
  stored: TaxSourceRecord,
  freshCanonicalText: string,
): { drifted: boolean; previousChecksum: string; nextChecksum: string } {
  const next = checksumCanonicalText(freshCanonicalText);
  return {
    drifted: stored.checksum !== next,
    previousChecksum: stored.checksum,
    nextChecksum: next,
  };
}

/** Evidence older than maxAgeDays without re-retrieval is stale. */
export function isEvidenceStale(source: TaxSourceRecord, nowIso: string, maxAgeDays = 180): boolean {
  const retrieved = Date.parse(source.retrievedAt);
  const now = Date.parse(nowIso);
  if (Number.isNaN(retrieved) || Number.isNaN(now)) return true;
  const ageMs = now - retrieved;
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

export function isEvidenceExpired(source: TaxSourceRecord, asOfDay: string): boolean {
  if (source.reviewerStatus === "EXPIRED") return true;
  if (source.validTo && asOfDay >= source.validTo) return true;
  return false;
}

export function blockUnsupportedSource(url: string): { ok: true } | { ok: false; code: "UNSUPPORTED_SOURCE" } {
  if (!isOfficialSourceUrl(url)) return { ok: false, code: "UNSUPPORTED_SOURCE" };
  return { ok: true };
}

/**
 * Approval cannot be recorded without linked evidence that is official + reviewed linkage ready.
 * Never auto-approves the underlying rule.
 */
export function assertCanQueueForApproval(source: TaxSourceRecord): void {
  if (!isOfficialSourceUrl(source.sourceUrl)) {
    throw new Error(`APPROVAL_BLOCKED_UNSUPPORTED_SOURCE:${source.id}`);
  }
  if (!source.checksum) throw new Error(`APPROVAL_BLOCKED_MISSING_CHECKSUM:${source.id}`);
  if (source.extractedClaims.length === 0) {
    throw new Error(`APPROVAL_BLOCKED_NO_CLAIMS:${source.id}`);
  }
}

/** When source checksum changes, linked APPROVED items must become EXPIRED. */
export function expireApprovalsOnEvidenceChange(
  previousChecksum: string,
  nextChecksum: string,
  linkedStatuses: Array<{ id: string; status: string }>,
): Array<{ id: string; status: "EXPIRED"; reason: "EVIDENCE_CHECKSUM_CHANGED" }> {
  if (previousChecksum === nextChecksum) return [];
  return linkedStatuses
    .filter((s) => s.status === "APPROVED")
    .map((s) => ({ id: s.id, status: "EXPIRED" as const, reason: "EVIDENCE_CHECKSUM_CHANGED" as const }));
}

export function buildManualReviewerQueue(
  sources: readonly TaxSourceRecord[],
): TaxSourceRecord[] {
  return sources.filter(
    (s) => s.reviewerStatus === "UNREVIEWED" || s.reviewerStatus === "PENDING_REVIEW",
  );
}

export function exportCountryEvidencePack(
  countryCode: string,
  sources: readonly TaxSourceRecord[],
): {
  countryCode: string;
  generatedAt: string;
  sourceCount: number;
  approvedCount: number;
  missingOfficial: number;
  sources: TaxSourceRecord[];
} {
  const filtered = sources.filter((s) => s.countryCode === countryCode.toUpperCase());
  return {
    countryCode: countryCode.toUpperCase(),
    generatedAt: new Date().toISOString(),
    sourceCount: filtered.length,
    approvedCount: filtered.filter((s) => s.reviewerStatus === "APPROVED").length,
    missingOfficial: filtered.filter((s) => !isOfficialSourceUrl(s.sourceUrl)).length,
    sources: filtered,
  };
}
