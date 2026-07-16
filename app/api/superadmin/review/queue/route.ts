export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gateReviewApi } from "@/lib/review/reviewApiGuard";
import { buildDeterministicReviewQueue, assertQueueDeterministic } from "@/lib/review/queueOperations";
import { PHASE15G3B_RC_SHA } from "@/lib/review/countryReviewPack";

export async function GET(req: Request) {
  const g = await gateReviewApi(req);
  if (!g.ok) return g.response;
  const admin = supabaseAdmin() as any;
  const { data, error } = await admin
    .from("compliance_review_queue")
    .select(
      "id, domain, country_code, locale, subject_id, evidence_checksum, status, subject_author_id, assignee_reviewer_id, task_version, release_sha, is_fixture, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return jsonErr(g.rid, "Kunne ikke hente kø", 500, error.message);

  const rows = data ?? [];
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const expected = assertQueueDeterministic();

  return jsonOk(g.rid, {
    expectedTaskCount: expected.count,
    fingerprint: expected.fingerprint,
    byStatus,
    duplicates: expected.duplicates,
    items: rows,
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

  if (action === "seed" || action === "reseed_missing") {
    const tasks = buildDeterministicReviewQueue({ isFixture: Boolean(body.isFixture) });
    let inserted = 0;
    let skipped = 0;
    for (const t of tasks) {
      const { data: existing } = await admin
        .from("compliance_review_queue")
        .select("id")
        .eq("subject_id", t.subjectId)
        .maybeSingle();
      if (existing) {
        skipped += 1;
        continue;
      }
      const { error } = await admin.from("compliance_review_queue").insert({
        domain: t.domain,
        country_code: t.countryCode,
        locale: t.locale,
        subject_id: t.subjectId,
        evidence_checksum: t.evidenceChecksum,
        status: "QUEUED",
        subject_author_id: t.subjectAuthorId,
        task_version: t.taskVersion,
        release_sha: t.releaseSha,
        is_fixture: t.isFixture,
      });
      if (error) return jsonErr(g.rid, "Seed feilet", 500, error.message);
      inserted += 1;
    }
    return jsonOk(g.rid, { action, inserted, skipped, expected: tasks.length, releaseSha: PHASE15G3B_RC_SHA });
  }

  if (action === "assign") {
    const reviewerId = String(body.reviewerId ?? "");
    const queueItemId = String(body.queueItemId ?? "");
    if (!reviewerId || !queueItemId) return jsonErr(g.rid, "reviewerId og queueItemId kreves", 422, "validation");

    const { data: reviewer } = await admin
      .from("compliance_reviewers")
      .select("id, status, role, country_scope, locale_scope")
      .eq("id", reviewerId)
      .maybeSingle();
    if (!reviewer || reviewer.status !== "ACTIVE") {
      return jsonErr(g.rid, "Reviewer må være ACTIVE", 422, "reviewer_inactive");
    }

    const { data: item } = await admin
      .from("compliance_review_queue")
      .select("id, country_code, locale, domain, status")
      .eq("id", queueItemId)
      .maybeSingle();
    if (!item) return jsonErr(g.rid, "Køelement mangler", 404, "not_found");

    const scope: string[] = reviewer.country_scope ?? [];
    if (!(scope.includes("ALL") || scope.includes(item.country_code))) {
      return jsonErr(g.rid, "Reviewer scope dekker ikke landet", 403, "scope_mismatch");
    }

    const { data, error } = await admin
      .from("compliance_review_queue")
      .update({ assignee_reviewer_id: reviewerId, status: "IN_REVIEW" })
      .eq("id", queueItemId)
      .select("id, status, assignee_reviewer_id")
      .single();
    if (error) return jsonErr(g.rid, "Assign feilet", 500, error.message);
    return jsonOk(g.rid, { item: data });
  }

  if (action === "expire_stale") {
    const checksum = String(body.evidenceChecksumNow ?? "");
    if (!checksum) return jsonErr(g.rid, "evidenceChecksumNow kreves", 422, "validation");
    const { data, error } = await admin
      .from("compliance_review_queue")
      .update({ status: "EXPIRED" })
      .neq("evidence_checksum", checksum)
      .in("status", ["QUEUED", "IN_REVIEW", "APPROVED"])
      .eq("release_sha", PHASE15G3B_RC_SHA)
      .select("id");
    if (error) return jsonErr(g.rid, "Expire feilet", 500, error.message);
    return jsonOk(g.rid, { expired: (data ?? []).length });
  }

  return jsonErr(g.rid, "Ukjent action", 422, "validation");
}
