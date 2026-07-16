/**
 * Phase 15G.3B — regenerate 21 machine + human review-ready packs.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { auditAllCountryReviewPacks } from "../../lib/review/countryReviewPack";
import { classifyAllCriticalQuestions } from "../../lib/review/criticalQuestions";
import { assertQueueDeterministic, buildDeterministicReviewQueue } from "../../lib/review/queueOperations";
import { buildReviewerStaffingPlan } from "../../lib/review/staffingPlan";
import {
  buildRegistrationRequirementSeeds,
  summarizeRegistrationSeeds,
} from "../../lib/review/registrationOperations";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../docs/rc/evidence/phase15g3b");
const humanDir = join(outDir, "human");
mkdirSync(humanDir, { recursive: true });

const audit = auditAllCountryReviewPacks();
const questions = classifyAllCriticalQuestions();
const queue = assertQueueDeterministic();
const staffing = buildReviewerStaffingPlan();
const regs = summarizeRegistrationSeeds(buildRegistrationRequirementSeeds());

for (const p of audit.packs) {
  writeFileSync(join(outDir, `${p.identity.countryCode}.pack.json`), JSON.stringify(p, null, 2) + "\n");
  const md = `# ${p.identity.countryCode} — review-ready pack (15G.3B)

- RC SHA: \`${p.release.sha}\`
- Migration head: \`${p.release.migrationHead}\`
- Pack checksum: \`${p.packChecksum}\`
- Review-ready: **${p.reviewReady ? "YES" : "NO"}**
- Missing mandatory fields: **${p.missingMandatoryCount}**
- External decisions required: **${p.externalDecisionCount}**
- Unclassified critical questions: **${p.unclassifiedCriticalCount}**

## Approvals (real)

Tax/Legal/Invoice/Privacy/Localization: NONE · E-invoice: ${p.approvals.eInvoice}

## Fields by status

${Object.entries(
  p.fields.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  ),
)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

## External decisions (sample)

${p.fields
  .filter((f) => f.status === "EXTERNAL_DECISION_REQUIRED")
  .slice(0, 12)
  .map((f) => `- \`${f.field_key}\` — ${f.completion_criteria}`)
  .join("\n")}

## Critical questions

${p.criticalQuestions.map((q) => `- **${q.status}** \`${q.questionId}\`: ${q.completionArtifact}`).join("\n")}

AI/Cursor must not mark APPROVED. Real external reviewers required.
`;
  writeFileSync(join(humanDir, `${p.identity.countryCode}.md`), md, "utf8");
}

writeFileSync(
  join(outDir, "review-queues.json"),
  JSON.stringify({ items: buildDeterministicReviewQueue(), ...queue }, null, 2) + "\n",
);
writeFileSync(join(outDir, "staffing-plan.json"), JSON.stringify(staffing, null, 2) + "\n");
writeFileSync(
  join(outDir, "INDEX.json"),
  JSON.stringify(
    {
      phase: "15G.3B",
      releaseSha: audit.releaseSha,
      migrationHead: audit.migrationHead,
      generatedAt: audit.generatedAt,
      summary: audit.summary,
      criticalQuestions: {
        total: questions.total,
        closedFactual: questions.closedFactual,
        externalDecisionRequired: questions.externalDecisionRequired,
        unclassified: questions.unclassified,
      },
      queue,
      staffing: { minimumCoverage: staffing.minimumCoverage, filled: staffing.filled, unfilled: staffing.unfilledScopes.length },
      registrations: regs,
      REVIEW_OPERATIONS_READY: audit.summary.reviewReady === 21 && audit.summary.missingMandatoryFields === 0,
      GLOBAL_21_READY: "NO",
    },
    null,
    2,
  ) + "\n",
);

console.log(JSON.stringify({ ...audit.summary, queue, regs }, null, 2));
