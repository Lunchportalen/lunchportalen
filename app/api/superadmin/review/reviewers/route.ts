export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gateReviewApi } from "@/lib/review/reviewApiGuard";
import {
  assertNoSuperadminSelfReview,
  reviewerRowFromInput,
  type ReviewerProfileInput,
} from "@/lib/review/reviewerOperations";
import type { ApprovalType } from "@/lib/review/approvalIngestionContract";
import type { ReviewerRole } from "@/lib/review/reviewWorkflow";
import type { CountryCode } from "@/lib/markets/supportedMarkets";

export async function GET(req: Request) {
  const g = await gateReviewApi(req);
  if (!g.ok) return g.response;
  const admin = supabaseAdmin() as any;
  const { data, error } = await admin
    .from("compliance_reviewers")
    .select(
      "id, display_label, organization, role, country_scope, locale_scope, permitted_approval_types, credential_reference, credential_valid_from, credential_valid_to, conflict_of_interest_declared, status, is_test_fixture, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) return jsonErr(g.rid, "Kunne ikke hente reviewers", 500, error.message);
  // Never return credential_secret_ref
  return jsonOk(g.rid, { reviewers: data ?? [] });
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

  const input: ReviewerProfileInput = {
    displayLabel: String(body.displayLabel ?? ""),
    organization: String(body.organization ?? ""),
    email: String(body.email ?? ""),
    role: String(body.role ?? "") as ReviewerRole,
    countryScope: (Array.isArray(body.countryScope) ? body.countryScope : []) as CountryCode[] | ["ALL"],
    localeScope: Array.isArray(body.localeScope) ? (body.localeScope as string[]) : null,
    permittedApprovalTypes: (Array.isArray(body.permittedApprovalTypes)
      ? body.permittedApprovalTypes
      : []) as ApprovalType[],
    credentialReference: body.credentialReference ? String(body.credentialReference) : null,
    credentialSecretRef: body.credentialSecretRef ? String(body.credentialSecretRef) : null,
    credentialValidFrom: body.credentialValidFrom ? String(body.credentialValidFrom) : null,
    credentialValidTo: body.credentialValidTo ? String(body.credentialValidTo) : null,
    conflictOfInterestDeclared: Boolean(body.conflictOfInterestDeclared),
    authUserId: body.authUserId ? String(body.authUserId) : null,
    isTestFixture: Boolean(body.isTestFixture),
    actorId: g.userId,
  };

  try {
    assertNoSuperadminSelfReview({
      actorIsSuperadmin: true,
      actorId: g.userId,
      reviewerAuthUserId: input.authUserId,
      separationRequired: !input.isTestFixture,
    });
    const row = reviewerRowFromInput(input);
    const admin = supabaseAdmin() as any;
    const { data, error } = await admin
      .from("compliance_reviewers")
      .upsert(row, { onConflict: "email_hash,role" })
      .select(
        "id, display_label, organization, role, country_scope, locale_scope, status, is_test_fixture",
      )
      .single();
    if (error) return jsonErr(g.rid, "Kunne ikke opprette reviewer", 500, error.message);

    await admin.from("compliance_reviewer_audit").insert({
      reviewer_id: data.id,
      actor_id: g.userId,
      action: "INVITE_OR_UPSERT",
      payload: {
        role: input.role,
        countryScope: input.countryScope,
        isTestFixture: input.isTestFixture,
      },
    });

    return jsonOk(g.rid, { reviewer: data });
  } catch (e) {
    return jsonErr(g.rid, String((e as Error).message), 422, "validation");
  }
}
