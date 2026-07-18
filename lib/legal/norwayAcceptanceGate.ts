/**
 * Phase 16NO.2 — server-side Norway legal acceptance gate.
 * Fail-closed. Superadmin cannot fabricate acceptance.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  acceptanceAuditHash,
  recordAcceptance,
  requiresReconsent,
  type AcceptanceRecord,
} from "@/lib/legal/legalAcceptance";
import {
  getNorwayDocument,
  NORWAY_LEGAL_COUNTRY,
  NORWAY_LEGAL_LOCALE,
  NORWAY_REQUIRED_DOCS_BY_ROLE,
  requiredNorwayDocumentsForRole,
  type NorwaySubjectRole,
} from "@/lib/legal/norwayDocuments";
import type { LegalDocumentType } from "@/lib/legal/legalDocumentRegistry";

function admin() {
  return supabaseAdmin() as any;
}

export type NorwayAcceptanceRow = {
  id: string;
  subject_type: NorwaySubjectRole;
  subject_id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  country_code: string;
  locale: string;
  document_type: string;
  document_version: string;
  document_checksum: string;
  accepted_at: string;
  acceptance_method: string;
  audit_hash: string;
  client_ip: string | null;
  user_agent: string | null;
};

export async function listNorwayAcceptancesForSubject(p: {
  subjectType: NorwaySubjectRole;
  subjectId: string;
}): Promise<NorwayAcceptanceRow[]> {
  const { data, error } = await admin()
    .from("legal_acceptances")
    .select(
      "id, subject_type, subject_id, organization_id, actor_user_id, country_code, locale, document_type, document_version, document_checksum, accepted_at, acceptance_method, audit_hash, client_ip, user_agent",
    )
    .eq("subject_type", p.subjectType)
    .eq("subject_id", p.subjectId)
    .eq("country_code", NORWAY_LEGAL_COUNTRY)
    .eq("locale", NORWAY_LEGAL_LOCALE)
    .order("accepted_at", { ascending: false });
  if (error) throw new Error(`LEGAL_ACCEPTANCE_READ_FAILED:${error.message}`);
  return (data ?? []) as NorwayAcceptanceRow[];
}

export async function latestAcceptance(
  rows: NorwayAcceptanceRow[],
  documentType: LegalDocumentType,
): Promise<NorwayAcceptanceRow | null> {
  return rows.find((r) => r.document_type === documentType) ?? null;
}

export async function evaluateNorwayLegalGate(p: {
  subjectType: NorwaySubjectRole;
  subjectId: string;
}): Promise<{
  ok: boolean;
  missing: LegalDocumentType[];
  stale: LegalDocumentType[];
  required: LegalDocumentType[];
}> {
  const required = [...NORWAY_REQUIRED_DOCS_BY_ROLE[p.subjectType]];
  const rows = await listNorwayAcceptancesForSubject(p);
  const missing: LegalDocumentType[] = [];
  const stale: LegalDocumentType[] = [];
  for (const type of required) {
    const doc = getNorwayDocument(type);
    if (!doc) {
      missing.push(type);
      continue;
    }
    const prev = await latestAcceptance(rows, type);
    if (!prev) {
      missing.push(type);
      continue;
    }
    if (
      requiresReconsent(
        { documentVersion: prev.document_version, documentChecksum: prev.document_checksum },
        { version: doc.version, checksum: doc.checksum },
      )
    ) {
      stale.push(type);
    }
  }
  return { ok: missing.length === 0 && stale.length === 0, missing, stale, required };
}

export async function assertNorwayLegalAcceptances(p: {
  subjectType: NorwaySubjectRole;
  subjectId: string;
}): Promise<void> {
  const gate = await evaluateNorwayLegalGate(p);
  if (!gate.ok) {
    throw Object.assign(new Error("NORWAY_LEGAL_ACCEPTANCE_REQUIRED"), {
      code: "NORWAY_LEGAL_ACCEPTANCE_REQUIRED",
      missing: gate.missing,
      stale: gate.stale,
      required: gate.required,
    });
  }
}

export async function persistNorwayAcceptance(p: {
  subjectType: NorwaySubjectRole;
  subjectId: string;
  organizationId: string | null;
  actorUserId: string;
  documentType: LegalDocumentType;
  documentVersion: string;
  documentChecksum: string;
  accepted: boolean;
  clientIp: string | null;
  userAgent: string | null;
}): Promise<{ ok: true; acceptance: AcceptanceRecord; auditHash: string } | { ok: false; code: string }> {
  if (p.accepted !== true) return { ok: false, code: "ACCEPTANCE_NOT_EXPLICIT" };
  if (!p.actorUserId) return { ok: false, code: "ACTOR_REQUIRED" };

  const allowed = NORWAY_REQUIRED_DOCS_BY_ROLE[p.subjectType];
  if (!allowed.includes(p.documentType)) {
    return { ok: false, code: "DOCUMENT_NOT_ALLOWED_FOR_ROLE" };
  }

  const doc = getNorwayDocument(p.documentType);
  if (!doc) return { ok: false, code: "DOCUMENT_NOT_FOUND" };
  if (doc.version !== p.documentVersion || doc.checksum !== p.documentChecksum) {
    return { ok: false, code: "DOCUMENT_VERSION_MISMATCH" };
  }

  const id = randomUUID();
  const acceptedAt = new Date().toISOString();
  const record = recordAcceptance({
    id,
    subjectType: p.subjectType,
    subjectId: p.subjectId,
    doc: {
      countryCode: doc.countryCode,
      locale: doc.locale,
      documentType: doc.documentType,
      version: doc.version,
      validFrom: doc.effectiveDate,
      checksum: doc.checksum,
      officialLegalSources: [],
      reviewerStatus: "NATIVE_REVIEWED",
      nativeReviewerStatus: "NATIVE_REVIEWED",
      bodyStub: doc.body,
    },
    acceptedAt,
    method: "clickwrap",
  });
  const auditHash = acceptanceAuditHash(record);

  const { error } = await admin().from("legal_acceptances").insert({
    id: record.id,
    subject_type: record.subjectType,
    subject_id: record.subjectId,
    organization_id: p.organizationId,
    actor_user_id: p.actorUserId,
    country_code: record.countryCode,
    locale: record.locale,
    document_type: record.documentType,
    document_version: record.documentVersion,
    document_checksum: record.documentChecksum,
    accepted_at: record.acceptedAt,
    acceptance_method: "clickwrap",
    audit_hash: auditHash,
    client_ip: p.clientIp,
    user_agent: p.userAgent,
  });
  if (error) return { ok: false, code: `PERSIST_FAILED:${error.message}` };
  return { ok: true, acceptance: record, auditHash };
}

export function roleDocsSnapshot(role: NorwaySubjectRole) {
  return requiredNorwayDocumentsForRole(role).map((d) => ({
    documentType: d.documentType,
    version: d.version,
    checksum: d.checksum,
    effectiveDate: d.effectiveDate,
    title: d.title,
    norwayLegalStatus: d.norwayLegalStatus,
  }));
}

export async function persistNorwayAcceptanceBatch(p: {
  subjectType: NorwaySubjectRole;
  subjectId: string;
  organizationId: string | null;
  actorUserId: string;
  items: Array<{ documentType: LegalDocumentType; documentVersion: string; documentChecksum: string }>;
  clientIp: string | null;
  userAgent: string | null;
}): Promise<{ ok: true; auditHashes: string[] } | { ok: false; code: string }> {
  if (!p.actorUserId) return { ok: false, code: "ACTOR_REQUIRED" };
  const auditHashes: string[] = [];
  for (const item of p.items) {
    const result = await persistNorwayAcceptance({
      subjectType: p.subjectType,
      subjectId: p.subjectId,
      organizationId: p.organizationId,
      actorUserId: p.actorUserId,
      documentType: item.documentType,
      documentVersion: item.documentVersion,
      documentChecksum: item.documentChecksum,
      accepted: true,
      clientIp: p.clientIp,
      userAgent: p.userAgent,
    });
    if (result.ok === false) return { ok: false, code: result.code };
    auditHashes.push(result.auditHash);
  }
  try {
    const { auditLog } = await import("@/lib/audit/log");
    const { makeRid } = await import("@/lib/http/respond");
    auditLog({
      action: "NORWAY_LEGAL_ACCEPTANCE",
      userId: p.actorUserId,
      role: p.subjectType,
      companyId: p.subjectType === "company" || p.subjectType === "employee" ? p.organizationId : null,
      locationId: null,
      resource: "legal_acceptances",
      resourceId: p.subjectId,
      metadata: {
        subjectType: p.subjectType,
        documentTypes: p.items.map((i) => i.documentType),
        auditHashes,
        locale: NORWAY_LEGAL_LOCALE,
        country: NORWAY_LEGAL_COUNTRY,
      },
      timestamp: Date.now(),
      rid: makeRid(),
    });
  } catch {
    // audit best-effort; acceptance rows are source of truth
  }
  return { ok: true, auditHashes };
}

export function buildNorwayLegalPendingPayload(p: {
  role: NorwaySubjectRole;
  items: Array<{ documentType: LegalDocumentType; documentVersion: string; documentChecksum: string }>;
  clientIp: string | null;
  userAgent: string | null;
}) {
  return {
    role: p.role,
    locale: NORWAY_LEGAL_LOCALE,
    country: NORWAY_LEGAL_COUNTRY,
    accepted_at: new Date().toISOString(),
    client_ip: p.clientIp,
    user_agent: p.userAgent,
    documents: p.items,
  };
}
