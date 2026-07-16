/**
 * Phase 15G.3B — secure evidence upload validation (no public URLs).
 */

import { createHash } from "node:crypto";

export const COMPLIANCE_EVIDENCE_BUCKET = "compliance-evidence";
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_EVIDENCE_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "application/json",
]);

export type EvidenceUploadMeta = {
  countryCode: string;
  queueItemId: string | null;
  approvalType: string | null;
  mimeType: string;
  byteSize: number;
  uploadedBy: string;
  isFixture: boolean;
  originalFileName: string;
};

export function validateEvidenceUpload(meta: EvidenceUploadMeta): string[] {
  const errors: string[] = [];
  if (!/^[A-Z]{2}$/.test(meta.countryCode)) errors.push("COUNTRY_INVALID");
  if (!ALLOWED_EVIDENCE_MIME.has(meta.mimeType)) errors.push("MIME_NOT_ALLOWED");
  if (meta.byteSize <= 0 || meta.byteSize > MAX_EVIDENCE_BYTES) errors.push("SIZE_INVALID");
  if (!meta.uploadedBy.trim()) errors.push("UPLOADER_REQUIRED");
  if (/\.\.|\\|\/|\0/.test(meta.originalFileName)) errors.push("FILENAME_UNSAFE");
  return errors;
}

export function evidenceObjectPath(meta: EvidenceUploadMeta, sha256: string): string {
  const safeName = meta.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const fixture = meta.isFixture ? "fixture" : "live";
  return `${fixture}/${meta.countryCode}/${sha256.slice(0, 16)}/${safeName}`;
}

export function checksumBytes(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function assertNoSecretInMetadata(meta: Record<string, unknown>): void {
  const blob = JSON.stringify(meta).toLowerCase();
  if (blob.includes("-----begin") || blob.includes("private_key") || blob.includes("client_secret")) {
    throw new Error("SECRET_METADATA_FORBIDDEN");
  }
}
