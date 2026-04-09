// app/api/security/audit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { denyResponse, q, scopeOr401 } from "@/lib/http/routeGuard";
import { requirePermissionOr403 } from "@/lib/security/access";
import { supabaseServer } from "@/lib/supabase/server";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);
  if (!s.ok) return denyResponse(s);
  const { ctx } = s;

  const permDeny = requirePermissionOr403(ctx, "security.audit.read");
  if (permDeny) return permDeny;

  const role = String(ctx.scope.role ?? "").toLowerCase();
  const scopeCompany = String(ctx.scope.companyId ?? "").trim() || null;
  const qCompany = String(q(req, "companyId") ?? "").trim() || null;

  let targetCompanyId: string | null = null;
  if (role === "company_admin") {
    if (!scopeCompany) {
      return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
    }
    targetCompanyId = scopeCompany;
    if (qCompany && qCompany !== scopeCompany) {
      return jsonErr(ctx.rid, "Ugyldig firmafilter.", 403, "TENANT_MISMATCH");
    }
  } else if (role === "superadmin") {
    if (!qCompany) {
      return jsonErr(ctx.rid, "Mangler companyId (påkrevd for superadmin).", 400, "MISSING_COMPANY_ID");
    }
    targetCompanyId = qCompany;
  } else {
    return jsonErr(ctx.rid, "Ingen tilgang.", 403, "FORBIDDEN");
  }

  const limitRaw = Number(q(req, "limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), MAX_LIMIT) : DEFAULT_LIMIT;

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("audit_logs")
    .select("id, company_id, user_id, action, resource, metadata, created_at")
    .eq("company_id", targetCompanyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return jsonErr(ctx.rid, "Kunne ikke hente revisjonslogg.", 500, "AUDIT_QUERY_FAILED", { detail: error.message });
  }

  return jsonOk(ctx.rid, { logs: Array.isArray(data) ? data : [] });
}
