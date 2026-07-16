export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gateReviewApi } from "@/lib/review/reviewApiGuard";
import {
  ALLOWED_EVIDENCE_MIME,
  COMPLIANCE_EVIDENCE_BUCKET,
  assertNoSecretInMetadata,
  checksumBytes,
  evidenceObjectPath,
  validateEvidenceUpload,
} from "@/lib/review/evidenceUpload";

export async function GET(req: Request) {
  const g = await gateReviewApi(req);
  if (!g.ok) return g.response;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const admin = supabaseAdmin() as any;

  if (id) {
    const { data: obj, error } = await admin
      .from("compliance_evidence_objects")
      .select("id, storage_bucket, storage_path, mime_type, sha256, country_code")
      .eq("id", id)
      .maybeSingle();
    if (error || !obj) return jsonErr(g.rid, "Evidence mangler", 404, "not_found");
    const { data: signed, error: sErr } = await admin.storage
      .from(obj.storage_bucket)
      .createSignedUrl(obj.storage_path, 60);
    if (sErr) return jsonErr(g.rid, "Signert URL feilet", 500, sErr.message);
    return jsonOk(g.rid, { id: obj.id, sha256: obj.sha256, signedUrl: signed?.signedUrl, expiresInSec: 60 });
  }

  const { data, error } = await admin
    .from("compliance_evidence_objects")
    .select("id, country_code, mime_type, byte_size, sha256, uploaded_by, is_fixture, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return jsonErr(g.rid, "Liste feilet", 500, error.message);
  return jsonOk(g.rid, { objects: data ?? [] });
}

export async function POST(req: Request) {
  const g = await gateReviewApi(req);
  if (!g.ok) return g.response;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonErr(g.rid, "file kreves", 422, "validation");

  const countryCode = String(form.get("countryCode") ?? "").toUpperCase();
  const queueItemId = form.get("queueItemId") ? String(form.get("queueItemId")) : null;
  const approvalType = form.get("approvalType") ? String(form.get("approvalType")) : null;
  const isFixture = String(form.get("isFixture") ?? "") === "true";
  const mimeType = file.type || "application/octet-stream";
  const buf = Buffer.from(await file.arrayBuffer());

  const meta = {
    countryCode,
    queueItemId,
    approvalType,
    mimeType,
    byteSize: buf.byteLength,
    uploadedBy: g.userId,
    isFixture,
    originalFileName: file.name || "evidence.bin",
  };
  const errors = validateEvidenceUpload(meta);
  if (errors.length) return jsonErr(g.rid, "Upload avvist", 422, { errors });
  if (!ALLOWED_EVIDENCE_MIME.has(mimeType)) {
    return jsonErr(g.rid, "MIME ikke tillatt", 422, "mime");
  }

  try {
    assertNoSecretInMetadata({ countryCode, approvalType, name: file.name });
  } catch (e) {
    return jsonErr(g.rid, String((e as Error).message), 422, "secret");
  }

  const sha256 = checksumBytes(buf);
  const path = evidenceObjectPath(meta, sha256);
  const admin = supabaseAdmin() as any;

  await admin.storage.createBucket(COMPLIANCE_EVIDENCE_BUCKET, { public: false }).catch(() => undefined);

  const { error: upErr } = await admin.storage.from(COMPLIANCE_EVIDENCE_BUCKET).upload(path, buf, {
    contentType: mimeType,
    upsert: false,
  });
  if (upErr && !String(upErr.message).includes("exists")) {
    return jsonErr(g.rid, "Storage upload feilet", 500, upErr.message);
  }

  const { data, error } = await admin
    .from("compliance_evidence_objects")
    .upsert(
      {
        country_code: countryCode,
        queue_item_id: queueItemId,
        approval_type: approvalType,
        storage_bucket: COMPLIANCE_EVIDENCE_BUCKET,
        storage_path: path,
        mime_type: mimeType,
        byte_size: buf.byteLength,
        sha256,
        uploaded_by: g.userId,
        is_fixture: isFixture,
      },
      { onConflict: "storage_bucket,storage_path" },
    )
    .select("id, sha256, storage_path, is_fixture")
    .single();

  if (error) return jsonErr(g.rid, "Evidence metadata feilet", 500, error.message);
  return jsonOk(g.rid, { evidence: data, publicUrl: null });
}
