export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gateReviewApi } from "@/lib/review/reviewApiGuard";
import { validateApprovalIngest, countRealApprovals } from "@/lib/review/approvalIngestionService";
import type { ApprovalType } from "@/lib/review/approvalIngestionContract";
import type { ReviewerRole } from "@/lib/review/reviewWorkflow";
import { buildCountryReviewPack } from "@/lib/review/countryReviewPack";
import type { CountryCode } from "@/lib/markets/supportedMarkets";

export async function GET(req: Request) {
  const g = await gateReviewApi(req);
  if (!g.ok) return g.response;
  const admin = supabaseAdmin() as any;
  const { data, error } = await admin
    .from("compliance_approvals")
    .select(
      "id, approval_type, country_code, locale, decision, reason, release_sha, migration_head, is_fixture, approved_at, immutable_signature_hash",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return jsonErr(g.rid, "Kunne ikke hente approvals", 500, error.message);
  const rows = data ?? [];
  return jsonOk(g.rid, {
    approvals: rows,
    realCounts: countRealApprovals(rows),
    note: "Fixture approvals excluded from realCounts / GLOBAL_21_READY",
  });
}

export async function POST(req: Request) {
  const g = await gateReviewApi(req);
  if (!g.ok) return g.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(g.rid, "Ugyldig JSON", 400, "invalid_json");
  }

  const reviewerId = String(body.reviewerId ?? "");
  const country = String(body.country ?? "").toUpperCase();
  const locale = body.locale != null ? String(body.locale) : null;
  const isFixture = Boolean(body.isFixture);
  const admin = supabaseAdmin() as any;

  const { data: reviewer } = await admin
    .from("compliance_reviewers")
    .select(
      "id, role, status, country_scope, locale_scope, permitted_approval_types, credential_valid_to, is_test_fixture, auth_user_id",
    )
    .eq("id", reviewerId)
    .maybeSingle();
  if (!reviewer) return jsonErr(g.rid, "Reviewer mangler", 404, "not_found");
  if (isFixture && !reviewer.is_test_fixture) {
    return jsonErr(g.rid, "Fixture approval krever TEST_FIXTURE reviewer", 422, "fixture");
  }
  if (!isFixture && reviewer.is_test_fixture) {
    return jsonErr(g.rid, "TEST_FIXTURE reviewer kan ikke lage ekte approvals", 422, "fixture");
  }

  const pack = buildCountryReviewPack(country as CountryCode);
  const queueItemId = body.queueItemId ? String(body.queueItemId) : null;
  let subjectAuthorId = "system:phase15g3b-pack-builder";
  let expectedChecksum = pack.packChecksum;
  if (queueItemId) {
    const { data: item } = await admin
      .from("compliance_review_queue")
      .select("subject_author_id, evidence_checksum")
      .eq("id", queueItemId)
      .maybeSingle();
    if (item) {
      subjectAuthorId = item.subject_author_id;
      expectedChecksum = item.evidence_checksum;
    }
  }

  const validated = validateApprovalIngest({
    approvalType: String(body.approvalType) as ApprovalType,
    country,
    locale,
    reviewerId: reviewer.id,
    reviewerRole: reviewer.role as ReviewerRole,
    reviewerStatus: reviewer.status,
    reviewerCountryScope: reviewer.country_scope ?? [],
    reviewerLocaleScope: reviewer.locale_scope,
    permittedApprovalTypes: reviewer.permitted_approval_types ?? [],
    credentialValidTo: reviewer.credential_valid_to,
    subjectAuthorId,
    evidencePackId: String(body.evidencePackId ?? `pack:${country}`),
    evidenceChecksum: String(body.evidenceChecksum ?? ""),
    expectedEvidenceChecksum: expectedChecksum,
    sourceChecksumSet: Array.isArray(body.sourceChecksumSet)
      ? (body.sourceChecksumSet as string[])
      : [],
    expectedSourceChecksums: Array.isArray(body.expectedSourceChecksums)
      ? (body.expectedSourceChecksums as string[])
      : [],
    decision: String(body.decision ?? "") as "APPROVE" | "REJECT" | "REQUEST_CHANGES",
    reason: String(body.reason ?? ""),
    scope: String(body.scope ?? country),
    validFrom: String(body.validFrom ?? new Date().toISOString()),
    validTo: String(body.validTo ?? "2099-01-01T00:00:00.000Z"),
    releaseSha: String(body.releaseSha ?? ""),
    migrationHead: String(body.migrationHead ?? ""),
    isFixture,
  });

  if (validated.ok === false) {
    return jsonErr(g.rid, "Approval avvist", 422, { reasons: validated.reasons });
  }

  const { data, error } = await admin
    .from("compliance_approvals")
    .insert({
      approval_type: body.approvalType,
      country_code: country,
      locale,
      reviewer_id: reviewerId,
      decision: body.decision,
      reason: String(body.reason ?? ""),
      scope: String(body.scope ?? country),
      evidence_pack_id: String(body.evidencePackId ?? `pack:${country}`),
      evidence_checksum: String(body.evidenceChecksum ?? ""),
      source_checksum_set: Array.isArray(body.sourceChecksumSet) ? body.sourceChecksumSet : [],
      release_sha: String(body.releaseSha ?? ""),
      migration_head: String(body.migrationHead ?? ""),
      valid_from: String(body.validFrom ?? validated.approvedAt),
      valid_to: String(body.validTo ?? "2099-01-01T00:00:00.000Z"),
      approved_at: validated.approvedAt,
      immutable_signature_hash: validated.signatureHash,
      is_fixture: isFixture,
      queue_item_id: queueItemId,
    })
    .select("id, decision, is_fixture, immutable_signature_hash, approved_at")
    .single();

  if (error) {
    if (String(error.message).includes("duplicate") || error.code === "23505") {
      return jsonErr(g.rid, "Duplikat approval", 409, "duplicate");
    }
    return jsonErr(g.rid, "Insert feilet", 500, error.message);
  }

  if (queueItemId && !isFixture && body.decision === "APPROVE") {
    await admin.from("compliance_review_queue").update({ status: "APPROVED" }).eq("id", queueItemId);
  }
  if (queueItemId && (body.decision === "REJECT" || body.decision === "REQUEST_CHANGES")) {
    await admin.from("compliance_review_queue").update({ status: "BLOCKED" }).eq("id", queueItemId);
  }

  if (queueItemId) {
    await admin.from("compliance_review_history").insert({
      queue_item_id: queueItemId,
      reviewer_id: reviewerId,
      reviewer_role: reviewer.role,
      decision: body.decision,
      evidence_checksum: String(body.evidenceChecksum ?? ""),
      notes: String(body.reason ?? ""),
    });
  }

  return jsonOk(g.rid, {
    approval: data,
    countsTowardGlobalReady: !isFixture && body.decision === "APPROVE",
  });
}
