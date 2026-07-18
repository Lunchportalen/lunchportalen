import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { requireSuperadminApi } from "@/lib/superadmin/auth";
import {
  evaluateNorwayLegalGate,
  listNorwayAcceptancesForSubject,
  roleDocsSnapshot,
} from "@/lib/legal/norwayAcceptanceGate";
import {
  NORWAY_LEGAL_STATUS,
  type NorwaySubjectRole,
} from "@/lib/legal/norwayDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only Norway acceptance inspection.
 * Superadmin must not fabricate acceptance via this route (GET only).
 */
export async function GET(req: NextRequest) {
  const rid = makeRid();
  const guard = await requireSuperadminApi();
  if (guard.ok === false) {
    return jsonErr(rid, guard.message, guard.status, guard.status === 401 ? "NOT_AUTHENTICATED" : "FORBIDDEN");
  }

  const url = new URL(req.url);
  const subjectType = String(url.searchParams.get("subjectType") || "") as NorwaySubjectRole;
  const subjectId = String(url.searchParams.get("subjectId") || "").trim();
  if (!subjectId || !["provider", "company", "employee"].includes(subjectType)) {
    return jsonErr(rid, "subjectType og subjectId kreves.", 400, "VALIDATION");
  }

  const [rows, gate] = await Promise.all([
    listNorwayAcceptancesForSubject({ subjectType, subjectId }),
    evaluateNorwayLegalGate({ subjectType, subjectId }),
  ]);

  return jsonOk(rid, {
    norwayLegalStatus: NORWAY_LEGAL_STATUS,
    subjectType,
    subjectId,
    currentDocuments: roleDocsSnapshot(subjectType),
    gate,
    acceptances: rows.map((r) => ({
      id: r.id,
      documentType: r.document_type,
      documentVersion: r.document_version,
      documentChecksum: r.document_checksum,
      acceptedAt: r.accepted_at,
      organizationId: r.organization_id,
      actorUserId: r.actor_user_id,
      auditHash: r.audit_hash,
      locale: r.locale,
      clientIp: r.client_ip,
      userAgent: r.user_agent,
    })),
    fabricateForbidden: true,
  });
}
