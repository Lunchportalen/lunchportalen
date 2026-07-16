/**
 * Phase 15G.3B — deterministic queue seed / assignment helpers.
 */

import { createHash } from "node:crypto";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_MARKET_LOCALES } from "@/lib/i18n/localeRegistry";
import { E_INVOICE_CAPABILITIES } from "@/lib/invoice/eInvoiceRegistry";
import { buildCountryReviewPack, PHASE15G3B_RC_SHA } from "@/lib/review/countryReviewPack";
import { classifyCriticalQuestionsForCountry } from "@/lib/review/criticalQuestions";

export type QueueTaskSeed = {
  domain: "tax" | "legal" | "invoice" | "e_invoice" | "privacy" | "localization" | "marketplace";
  countryCode: string;
  locale: string | null;
  subjectId: string;
  evidenceChecksum: string;
  status: "QUEUED";
  subjectAuthorId: string;
  releaseSha: string;
  taskVersion: string;
  isFixture: boolean;
};

const AUTHOR = "system:phase15g3b-pack-builder";
const TASK_VERSION = "15g3b.1";

export function canonicalSubjectId(parts: {
  approvalLane: string;
  country: string;
  locale?: string | null;
  checksum: string;
}): string {
  const loc = parts.locale ?? "";
  return `${parts.approvalLane}:${parts.country}:${loc}:${PHASE15G3B_RC_SHA}:${parts.checksum.slice(0, 16)}:v${TASK_VERSION}`;
}

export function buildDeterministicReviewQueue(opts?: { isFixture?: boolean }): QueueTaskSeed[] {
  const isFixture = opts?.isFixture ?? false;
  const out: QueueTaskSeed[] = [];

  for (const cc of SUPPORTED_COUNTRY_CODES) {
    const pack = buildCountryReviewPack(cc);
    const checksum = pack.packChecksum;
    const lanes: Array<QueueTaskSeed["domain"]> = [
      "tax",
      "marketplace",
      "invoice",
      "privacy",
      "legal",
    ];
    for (const domain of lanes) {
      out.push({
        domain,
        countryCode: cc,
        locale: null,
        subjectId: canonicalSubjectId({ approvalLane: domain, country: cc, checksum }),
        evidenceChecksum: checksum,
        status: "QUEUED",
        subjectAuthorId: AUTHOR,
        releaseSha: PHASE15G3B_RC_SHA,
        taskVersion: TASK_VERSION,
        isFixture,
      });
    }
    if (E_INVOICE_CAPABILITIES[cc].requirementStatus !== "NOT_APPLICABLE") {
      out.push({
        domain: "e_invoice",
        countryCode: cc,
        locale: null,
        subjectId: canonicalSubjectId({ approvalLane: "e_invoice", country: cc, checksum }),
        evidenceChecksum: checksum,
        status: "QUEUED",
        subjectAuthorId: AUTHOR,
        releaseSha: PHASE15G3B_RC_SHA,
        taskVersion: TASK_VERSION,
        isFixture,
      });
    }
    for (const loc of SUPPORTED_MARKET_LOCALES.filter((l) => l.countryCode === cc)) {
      out.push({
        domain: "localization",
        countryCode: cc,
        locale: loc.locale,
        subjectId: canonicalSubjectId({
          approvalLane: "localization",
          country: cc,
          locale: loc.locale,
          checksum,
        }),
        evidenceChecksum: checksum,
        status: "QUEUED",
        subjectAuthorId: AUTHOR,
        releaseSha: PHASE15G3B_RC_SHA,
        taskVersion: TASK_VERSION,
        isFixture,
      });
    }
    for (const cq of classifyCriticalQuestionsForCountry(cc).filter(
      (q) => q.status === "EXTERNAL_DECISION_REQUIRED",
    )) {
      // Critical questions piggy-back on tax/legal domains already seeded;
      // identity retained for export/linking only (no duplicate domain rows).
      void cq;
    }
  }

  // Deduplicate by subjectId
  const seen = new Set<string>();
  const unique: QueueTaskSeed[] = [];
  for (const t of out) {
    if (seen.has(t.subjectId)) continue;
    seen.add(t.subjectId);
    unique.push(t);
  }
  return unique;
}

export function queueFingerprint(tasks: QueueTaskSeed[]): string {
  return createHash("sha256")
    .update(JSON.stringify(tasks.map((t) => t.subjectId).sort()), "utf8")
    .digest("hex");
}

export function assertQueueDeterministic(): {
  count: number;
  duplicates: number;
  fingerprint: string;
} {
  const a = buildDeterministicReviewQueue();
  const b = buildDeterministicReviewQueue();
  const ids = a.map((t) => t.subjectId);
  const duplicates = ids.length - new Set(ids).size;
  if (queueFingerprint(a) !== queueFingerprint(b)) {
    throw new Error("QUEUE_NOT_DETERMINISTIC");
  }
  return { count: a.length, duplicates, fingerprint: queueFingerprint(a) };
}
