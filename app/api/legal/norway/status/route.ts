import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { requireUser, authErrorToResponse } from "@/lib/server/auth/requireUser";
import { evaluateNorwayLegalGate, listNorwayAcceptancesForSubject } from "@/lib/legal/norwayAcceptanceGate";
import { NORWAY_LEGAL_STATUS, type NorwaySubjectRole } from "@/lib/legal/norwayDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rid = makeRid();
  try {
    await requireUser(req);
  } catch (e) {
    return authErrorToResponse(e);
  }

  const subjectType = String(req.nextUrl.searchParams.get("subjectType") || "") as NorwaySubjectRole;
  const subjectId = String(req.nextUrl.searchParams.get("subjectId") || "").trim();
  if (!subjectId || !["provider", "company", "employee"].includes(subjectType)) {
    return jsonErr(rid, "subjectType/subjectId mangler.", 400, "VALIDATION");
  }

  const gate = await evaluateNorwayLegalGate({ subjectType, subjectId });
  const rows = await listNorwayAcceptancesForSubject({ subjectType, subjectId });
  return jsonOk(rid, {
    norwayLegalStatus: NORWAY_LEGAL_STATUS,
    gate,
    acceptances: rows.map((r) => ({
      documentType: r.document_type,
      documentVersion: r.document_version,
      documentChecksum: r.document_checksum,
      acceptedAt: r.accepted_at,
      organizationId: r.organization_id,
      actorUserId: r.actor_user_id,
      auditHash: r.audit_hash,
    })),
  });
}
