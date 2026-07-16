/**
 * Phase 15G.3A — export 21/21 completeness reports + queues + credentials + sources.
 * Does not mark APPROVED. Does not invent reviewers.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { auditAllCountries, buildPhase15g3aReviewQueues } from "../../lib/review/phase15g3aCompleteness";
import { assertNoFabricatedReviewers, countReviewerRoster } from "../../lib/review/reviewerRosterSlots";
import { auditAllCredentialChecklists } from "../../lib/review/credentialChecklist";
import { auditOfficialSourceClosure } from "../../lib/review/officialSourceInventory";
import { emptyApprovalCounts } from "../../lib/review/approvalIngestionContract";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");
const outDir = join(root, "docs/rc/evidence/phase15g3a");

assertNoFabricatedReviewers();

mkdirSync(outDir, { recursive: true });

const audit = auditAllCountries();
const queues = buildPhase15g3aReviewQueues();
const credentials = auditAllCredentialChecklists();
const sources = auditOfficialSourceClosure();
const roster = countReviewerRoster();
const approvals = emptyApprovalCounts();

for (const c of audit.countries) {
  writeFileSync(join(outDir, `${c.countryCode}.completeness.json`), JSON.stringify(c, null, 2) + "\n", "utf8");
}

writeFileSync(join(outDir, "review-queues.json"), JSON.stringify({ generatedAt: audit.generatedAt, items: queues }, null, 2) + "\n", "utf8");
writeFileSync(join(outDir, "credential-checklists.json"), JSON.stringify(credentials, null, 2) + "\n", "utf8");
writeFileSync(join(outDir, "official-sources.json"), JSON.stringify(sources, null, 2) + "\n", "utf8");
writeFileSync(join(outDir, "reviewer-roster.json"), JSON.stringify({ roster, note: "All slots REVIEWER_REQUIRED — no fabricated identities" }, null, 2) + "\n", "utf8");

const index = {
  phase: "15G.3A",
  releaseSha: audit.releaseSha,
  migrationHead: audit.migrationHead,
  generatedAt: audit.generatedAt,
  summary: audit.summary,
  approvals,
  reviewers: {
    taxReviewersAssigned: 0,
    legalReviewersAssigned: 0,
    invoiceReviewersAssigned: 0,
    privacyReviewersAssigned: 0,
    nativeReviewersAssigned: 0,
    missingReviewerScopes: roster.missingScopes.length,
    expiredReviewerCredentials: roster.expired,
    roster,
  },
  credentials: {
    countriesComplete: credentials.countriesComplete,
    missingTaxRegistrations: credentials.missingTaxRegistrations,
    missingEInvoiceRegistrations: credentials.missingEInvoiceRegistrations,
    missingPeppol: credentials.missingPeppol,
    missingCtc: credentials.missingCtc,
    missingLocalRepresentatives: credentials.missingLocalRepresentatives,
    blocked: credentials.countriesBlocked,
    expired: credentials.expired,
  },
  sources: {
    missingOfficialSourceForTechnicalClaims: sources.missingOfficialSourceForTechnicalClaims,
    unsupportedSourceDomain: sources.unsupportedSourceDomain,
    staleSource: sources.staleSource,
    sourceChecksumDrift: sources.sourceChecksumDrift,
    judgmentQuestionsRemaining: sources.judgmentQuestionsRemaining.length,
  },
  queues: {
    queued: queues.length,
    approved: 0,
  },
  readiness: {
    READY_FOR_GLOBAL_CUTOVER: "0/21",
    GLOBAL_21_READY: "NO",
    AWAITING_EXTERNAL_APPROVAL: "YES",
  },
  countries: audit.countries.map((c) => ({
    country: c.countryCode,
    packComplete: c.packComplete,
    missingMandatoryFields: c.missingMandatoryFields.length,
    unresolvedCriticalQuestions: c.unresolvedCriticalQuestions.length,
    file: `docs/rc/evidence/phase15g3a/${c.countryCode}.completeness.json`,
  })),
};

writeFileSync(join(outDir, "INDEX.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
writeFileSync(
  join(outDir, "15g3a-STATUS.json"),
  JSON.stringify(
    {
      phase: "15G.3A",
      TECHNICAL_GLOBAL_RC_SHA: audit.releaseSha,
      migration_head_staging: audit.migrationHead,
      approvals,
      GLOBAL_21_READY: "NO",
      AWAITING_EXTERNAL_APPROVAL: "YES",
      NO_GO: true,
      PHASE_15G3_FINAL_CERT_PERMITTED: "NO",
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(`Wrote ${audit.countries.length} completeness reports → ${outDir}`);
console.log(`Queues QUEUED=${queues.length} APPROVED=0`);
console.log(JSON.stringify(approvals, null, 2));
