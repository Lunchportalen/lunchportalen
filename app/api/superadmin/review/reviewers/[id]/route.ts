export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gateReviewApi } from "@/lib/review/reviewApiGuard";

const ALLOWED_STATUS = new Set(["INVITED", "ACTIVE", "SUSPENDED", "EXPIRED"]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gateReviewApi(req);
  if (!g.ok) return g.response;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(g.rid, "Ugyldig JSON", 400, "invalid_json");
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status != null) {
    const status = String(body.status);
    if (!ALLOWED_STATUS.has(status)) return jsonErr(g.rid, "Ugyldig status", 422, "validation");
    patch.status = status;
  }
  if (Array.isArray(body.countryScope)) patch.country_scope = body.countryScope;
  if (body.localeScope === null || Array.isArray(body.localeScope)) patch.locale_scope = body.localeScope;
  if (Array.isArray(body.permittedApprovalTypes)) {
    patch.permitted_approval_types = body.permittedApprovalTypes;
  }
  if (typeof body.conflictOfInterestDeclared === "boolean") {
    patch.conflict_of_interest_declared = body.conflictOfInterestDeclared;
  }
  if (body.credentialReference !== undefined) {
    patch.credential_reference = body.credentialReference ? String(body.credentialReference) : null;
  }
  if (body.credentialSecretRef !== undefined) {
    const ref = body.credentialSecretRef ? String(body.credentialSecretRef) : null;
    if (ref && !/^(vault:|sm:|aws-sm:|gcp-sm:)/i.test(ref)) {
      return jsonErr(g.rid, "credentialSecretRef må være secret-manager URI", 422, "secret_ref");
    }
    patch.credential_secret_ref = ref;
  }
  if (body.credentialValidFrom !== undefined) patch.credential_valid_from = body.credentialValidFrom;
  if (body.credentialValidTo !== undefined) patch.credential_valid_to = body.credentialValidTo;

  const admin = supabaseAdmin() as any;
  const { data, error } = await admin
    .from("compliance_reviewers")
    .update(patch)
    .eq("id", id)
    .select(
      "id, display_label, organization, role, country_scope, locale_scope, status, is_test_fixture, credential_reference, credential_valid_to",
    )
    .single();
  if (error) return jsonErr(g.rid, "Kunne ikke oppdatere reviewer", 500, error.message);

  await admin.from("compliance_reviewer_audit").insert({
    reviewer_id: id,
    actor_id: g.userId,
    action: "PATCH",
    payload: { keys: Object.keys(patch) },
  });

  return jsonOk(g.rid, { reviewer: data });
}
