export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gateReviewApi } from "@/lib/review/reviewApiGuard";
import {
  buildRegistrationRequirementSeeds,
  summarizeRegistrationSeeds,
} from "@/lib/review/registrationOperations";

export async function GET(req: Request) {
  const g = await gateReviewApi(req);
  if (!g.ok) return g.response;
  const admin = supabaseAdmin() as any;
  const { data, error } = await admin
    .from("compliance_registration_records")
    .select(
      "id, country_code, requirement_type, status, authority_or_provider, reference_id, secret_manager_ref, valid_from, valid_to, owner_label, verified_at, is_fixture, notes",
    )
    .order("country_code");
  if (error) return jsonErr(g.rid, "Kunne ikke hente registreringer", 500, error.message);

  const rows = data ?? [];
  const seeds = buildRegistrationRequirementSeeds();
  return jsonOk(g.rid, {
    records: rows,
    seedSummary: summarizeRegistrationSeeds(seeds),
    liveSummary: {
      verified: rows.filter((r: { status: string }) => r.status === "VERIFIED").length,
      blocked: rows.filter((r: { status: string }) => r.status === "BLOCKED").length,
      expired: rows.filter((r: { status: string }) => r.status === "EXPIRED").length,
      notApplicable: rows.filter((r: { status: string }) => r.status === "NOT_APPLICABLE").length,
    },
    note: "secret_manager_ref only — secret values never stored or returned as secrets",
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

  const action = String(body.action ?? "seed");
  const admin = supabaseAdmin() as any;

  if (action === "seed") {
    const seeds = buildRegistrationRequirementSeeds();
    let upserted = 0;
    for (const s of seeds) {
      const { error } = await admin.from("compliance_registration_records").upsert(
        {
          country_code: s.countryCode,
          requirement_type: s.requirementType,
          status: s.status,
          authority_or_provider: s.authorityOrProvider,
          notes: s.naReason,
          is_fixture: Boolean(body.isFixture),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "country_code,requirement_type" },
      );
      if (error) return jsonErr(g.rid, "Seed feilet", 500, error.message);
      upserted += 1;
    }
    return jsonOk(g.rid, { upserted, summary: summarizeRegistrationSeeds(seeds) });
  }

  if (action === "update") {
    const countryCode = String(body.countryCode ?? "").toUpperCase();
    const requirementType = String(body.requirementType ?? "");
    const status = String(body.status ?? "");
    if (!countryCode || !requirementType || !status) {
      return jsonErr(g.rid, "countryCode, requirementType, status kreves", 422, "validation");
    }
    if (body.secretValue) {
      return jsonErr(g.rid, "Secret values forbidden — use secretManagerRef only", 422, "secret_forbidden");
    }
    const secretRef = body.secretManagerRef ? String(body.secretManagerRef) : null;
    if (secretRef && !/^(vault:|sm:|aws-sm:|gcp-sm:)/i.test(secretRef)) {
      return jsonErr(g.rid, "secretManagerRef format invalid", 422, "secret_ref");
    }
    const { data, error } = await admin
      .from("compliance_registration_records")
      .upsert(
        {
          country_code: countryCode,
          requirement_type: requirementType,
          status,
          authority_or_provider: body.authorityOrProvider ? String(body.authorityOrProvider) : null,
          reference_id: body.referenceId ? String(body.referenceId) : null,
          secret_manager_ref: secretRef,
          valid_from: body.validFrom ?? null,
          valid_to: body.validTo ?? null,
          evidence_object_id: body.evidenceObjectId ?? null,
          owner_label: body.ownerLabel ? String(body.ownerLabel) : null,
          reviewer_id: body.reviewerId ?? null,
          verified_at: status === "VERIFIED" ? new Date().toISOString() : null,
          notes: body.notes ? String(body.notes) : null,
          is_fixture: Boolean(body.isFixture),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "country_code,requirement_type" },
      )
      .select("id, country_code, requirement_type, status, secret_manager_ref, reference_id")
      .single();
    if (error) return jsonErr(g.rid, "Update feilet", 500, error.message);
    return jsonOk(g.rid, { record: data });
  }

  return jsonErr(g.rid, "Ukjent action", 422, "validation");
}
