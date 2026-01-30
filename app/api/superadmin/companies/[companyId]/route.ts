// app/api/superadmin/companies/[companyId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function qBool(req: NextRequest, key: string, fallback: boolean) {
  try {
    const v = req.nextUrl.searchParams.get(key);
    if (v == null) return fallback;
    const s = String(v).trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
    if (s === "0" || s === "false" || s === "no" || s === "off") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.company.GET", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(400, a, "BAD_REQUEST", "Ugyldig companyId.");

  const includeAgreementJson = qBool(req, "include_agreement_json", true);
  const includeLastEvent = qBool(req, "include_last", true);

  try {
    const admin = supabaseAdmin();

    // Firma (grunnfelt)
    const selectCompany = includeAgreementJson
      ? "id,name,orgnr,status,created_at,updated_at,agreement_json"
      : "id,name,orgnr,status,created_at,updated_at";

    const { data: company, error: cErr } = await admin
      .from("companies")
      .select(selectCompany)
      .eq("id", companyId)
      .maybeSingle();

    if (cErr) return jsonErr(500, a, "DB_ERROR", "Kunne ikke hente firma.", cErr);
    if (!company) return jsonErr(404, a, "NOT_FOUND", "Fant ikke firma.");

    // Siste status-event (valgfritt)
    let last_event: any = null;
    if (includeLastEvent) {
      const { data: ev, error: eErr } = await admin
        .from("audit_events")
        .select("created_at,actor_email,actor_role,summary,detail")
        .eq("entity_type", "company")
        .eq("entity_id", companyId)
        .eq("action", "COMPANY_STATUS_SET")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!eErr && ev && ev.length) {
        const row: any = ev[0];
        last_event = {
          created_at: row.created_at ?? null,
          actor_email: row.actor_email ?? null,
          actor_role: row.actor_role ?? null,
          summary: row.summary ?? null,
          detail: row.detail ?? null,
        };
      }
    }

    return jsonOk(
      a,
      {
        ok: true,
        rid: a.rid,
        company,
        last_event: includeLastEvent ? last_event : undefined,
      },
      200
    );
  } catch (e: any) {
    return jsonErr(500, a, "SERVER_ERROR", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}
