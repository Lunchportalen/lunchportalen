import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { requireUser, authErrorToResponse } from "@/lib/server/auth/requireUser";
import { persistNorwayAcceptance } from "@/lib/legal/norwayAcceptanceGate";
import { norwayClientMeta } from "@/lib/legal/norwayClientMeta";
import type { NorwaySubjectRole } from "@/lib/legal/norwayDocuments";
import type { LegalDocumentType } from "@/lib/legal/legalDocumentRegistry";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isProviderAuthRole } from "@/lib/auth/getAuthContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rid = makeRid();
  let ctx;
  try {
    ctx = await requireUser(req);
  } catch (e) {
    return authErrorToResponse(e);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "VALIDATION");
  }

  const subjectType = String(body?.subjectType || "") as NorwaySubjectRole;
  const subjectId = String(body?.subjectId || "").trim();
  const organizationId = body?.organizationId ? String(body.organizationId).trim() : null;
  const documentType = String(body?.documentType || "") as LegalDocumentType;
  const documentVersion = String(body?.documentVersion || "").trim();
  const documentChecksum = String(body?.documentChecksum || "").trim();
  const accepted = body?.accepted === true;

  if (!subjectId) return jsonErr(rid, "subjectId mangler.", 400, "VALIDATION");
  if (!["provider", "company", "employee"].includes(subjectType)) {
    return jsonErr(rid, "Ugyldig subjectType.", 400, "VALIDATION");
  }

  const role = String(ctx.scope.role || "");
  const isProvider = isProviderAuthRole(role as any) || role === "provider";

  if (role === "superadmin") {
    return jsonErr(rid, "Superadmin kan ikke fabrikkere aksept.", 403, "SUPERADMIN_FABRICATE_FORBIDDEN");
  }
  if (subjectType === "provider" && !isProvider) {
    return jsonErr(rid, "Kun leverandør kan akseptere leverandørvilkår.", 403, "ROLE_MISMATCH");
  }
  if (subjectType === "company" && role !== "company_admin") {
    return jsonErr(rid, "Kun bedriftsadmin kan akseptere bedriftsvilkår.", 403, "ROLE_MISMATCH");
  }
  if (subjectType === "employee" && role !== "employee") {
    return jsonErr(rid, "Kun ansatt kan akseptere sluttbrukervilkår.", 403, "ROLE_MISMATCH");
  }

  // Cross-tenant: subject must match actor scope.
  if (subjectType === "company") {
    if (!ctx.scope.companyId || ctx.scope.companyId !== subjectId) {
      return jsonErr(rid, "Tilgang nektet for annet firma.", 403, "CROSS_TENANT_DENIED");
    }
  }
  if (subjectType === "employee") {
    if (ctx.scope.userId !== subjectId) {
      return jsonErr(rid, "Tilgang nektet for annen bruker.", 403, "CROSS_TENANT_DENIED");
    }
  }
  if (subjectType === "provider") {
    const { data: mem } = await (supabaseAdmin() as any)
      .from("provider_memberships")
      .select("provider_id")
      .eq("user_id", ctx.scope.userId)
      .eq("provider_id", subjectId)
      .maybeSingle();
    if (!mem?.provider_id) {
      return jsonErr(rid, "Tilgang nektet for annen leverandør.", 403, "CROSS_TENANT_DENIED");
    }
  }

  const meta = norwayClientMeta(req);
  const result = await persistNorwayAcceptance({
    subjectType,
    subjectId,
    organizationId: organizationId || (subjectType === "company" ? subjectId : ctx.scope.companyId),
    actorUserId: ctx.scope.userId!,
    documentType,
    documentVersion,
    documentChecksum,
    accepted,
    clientIp: meta.ip,
    userAgent: meta.userAgent,
  });

  if (result.ok === false) {
    const status =
      result.code === "ACCEPTANCE_NOT_EXPLICIT" || result.code === "DOCUMENT_VERSION_MISMATCH"
        ? 422
        : result.code === "DOCUMENT_NOT_ALLOWED_FOR_ROLE" || result.code === "ACTOR_REQUIRED"
          ? 403
          : 400;
    return jsonErr(rid, "Aksept avvist.", status, result.code);
  }

  return jsonOk(rid, {
    acceptance: result.acceptance,
    auditHash: result.auditHash,
  });
}
