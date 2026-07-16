// Superadmin — global compliance + review operations (Phase 15G.3B)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { requireSuperadmin } from "@/lib/superadmin/auth";
import { evaluateGlobal21Ready } from "@/lib/markets/globalActivationGate";
import { auditAllCountryReviewPacks } from "@/lib/review/countryReviewPack";
import { classifyAllCriticalQuestions } from "@/lib/review/criticalQuestions";
import { assertQueueDeterministic } from "@/lib/review/queueOperations";
import { countReviewerRoster, assertNoFabricatedReviewers } from "@/lib/review/reviewerRosterSlots";
import { buildReviewerStaffingPlan } from "@/lib/review/staffingPlan";
import {
  buildRegistrationRequirementSeeds,
  summarizeRegistrationSeeds,
} from "@/lib/review/registrationOperations";
import { emptyApprovalCounts } from "@/lib/review/approvalIngestionContract";

export default async function GlobalCompliancePage() {
  await requireSuperadmin();
  assertNoFabricatedReviewers();

  const packs = auditAllCountryReviewPacks();
  const questions = classifyAllCriticalQuestions();
  const queue = assertQueueDeterministic();
  const roster = countReviewerRoster();
  const staffing = buildReviewerStaffingPlan();
  const regs = summarizeRegistrationSeeds(buildRegistrationRequirementSeeds());
  const approvals = emptyApprovalCounts();
  const global = evaluateGlobal21Ready({ stagingGoldenPathPass: 0 });

  const reviewOpsReady =
    packs.summary.reviewReady === 21 &&
    packs.summary.missingMandatoryFields === 0 &&
    questions.unclassified === 0;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-[27px] pb-12">
      <h1 className="text-2xl font-semibold tracking-tight">Global compliance readiness</h1>
      <p className="mt-2 text-sm text-neutral-600">
        15G.3B review operations workspace. RESEARCHED ≠ APPROVED. Fixture approvals never count toward global
        cutover. APIs under <code>/api/superadmin/review/*</code>.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Operations</p>
          <p className="mt-1 text-lg font-semibold">
            {reviewOpsReady ? "REVIEW_OPERATIONS_READY" : "OPS_INCOMPLETE"}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Packs {packs.summary.reviewReady}/21 · GLOBAL_21_READY={global.global21Ready ? "YES" : "NO"}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Real approvals</p>
          <p className="mt-1 text-sm">
            Tax {approvals.TAX_APPROVED}/21 · Legal {approvals.LEGAL_APPROVED}/21 · Invoice{" "}
            {approvals.INVOICE_APPROVED}/21 · E-invoice {approvals.E_INVOICE_APPROVED_OR_NOT_APPLICABLE}/21 · Privacy{" "}
            {approvals.PRIVACY_APPROVED}/21 · Native {approvals.LOCALIZATION_APPROVED}/24
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Queue health</p>
          <p className="mt-1 text-sm">
            Expected tasks {queue.count} · duplicates {queue.duplicates} · fingerprint{" "}
            {queue.fingerprint.slice(0, 12)}…
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Country packs</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Missing mandatory fields: {packs.summary.missingMandatoryFields} · External decisions:{" "}
          {packs.summary.externalDecisionsRequired} · Unclassified questions:{" "}
          {packs.summary.unclassifiedCriticalQuestions}
        </p>
        <ul className="mt-2 max-h-56 list-disc space-y-1 overflow-auto pl-5 text-sm text-neutral-700">
          {packs.packs.map((p) => (
            <li key={p.identity.countryCode}>
              {p.identity.countryCode}: {p.reviewReady ? "review-ready" : "incomplete"} · ext decisions{" "}
              {p.externalDecisionCount} · critical Q {p.criticalQuestions.length}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Critical questions</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Closed factual {questions.closedFactual} · EXTERNAL_DECISION_REQUIRED {questions.externalDecisionRequired} ·
          Unclassified {questions.unclassified} · Without task {questions.withoutTask}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Reviewer inventory & scope gaps</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Slot template: assigned {roster.assigned}/{roster.totalSlots} · REVIEWER_REQUIRED {roster.reviewerRequired}.
          Staffing unfilled scopes: {staffing.unfilledScopes.length} (no names invented).
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Critical path: {staffing.criticalPathCountries.join(", ")}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Credentials / registrations</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Workflow ready: {regs.workflowReady ? "YES" : "NO"} · Countries verified: {regs.countriesVerified}/21 ·
          Blocked deps: {regs.blockedDependencies} · Expired: {regs.expiredDependencies} · Secret leakage:{" "}
          {regs.secretLeakage}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Operator APIs</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>
            <Link className="underline" href="/api/superadmin/review/packs">
              Packs summary
            </Link>
          </li>
          <li>POST /api/superadmin/review/reviewers — invite/onboard</li>
          <li>POST /api/superadmin/review/queue — seed / assign / expire_stale</li>
          <li>POST /api/superadmin/review/approvals — append-only ingest (fixture isolated)</li>
          <li>POST /api/superadmin/review/evidence — private upload + signed download</li>
          <li>POST /api/superadmin/review/registrations — seed/update (secret_manager_ref only)</li>
        </ul>
        <p className="mt-2 text-sm text-neutral-600">
          Decision forms require reason, evidence checksum, exact RC SHA, migration head, and immutable signature hash.
          Self-approval is rejected server-side.
        </p>
      </section>
    </div>
  );
}
