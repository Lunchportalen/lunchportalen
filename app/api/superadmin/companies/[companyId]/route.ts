// app/api/superadmin/companies/[companyId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

type CompanyStatus = "active" | "paused" | "closed" | "pending";
type AgreementTier = "basis" | "luxus";

type AgreementSnapshot = {
  agreementId: string | null;
  status: string | null;
  planTier: string | null;
  planLabel: string | null;
  pricePerCuvertNok: number | null;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string | null;
};

type CompanyDetails = {
  company: {
    id: string;
    name: string | null;
    orgnr: string | null;
    status: CompanyStatus;
    updated_at: string | null;
    created_at: string | null;
    deleted_at: string | null;
  };
  counts: {
    employeesCount: number;
    adminsCount: number;
  };
  agreement: AgreementSnapshot | null;
  employees: Array<{
    id: string;
    email: string | null;
    role: string | null;
    is_active: boolean | null;
    company_id: string | null;
    location_id: string | null;
  }>;
  locations: Array<{
    id: string;
    name: string | null;
    address_line: string | null;
    postnr: string | null;
    city: string | null;
    slot: string | null;
  }>;
};

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

const safeStr = (v: any) => String(v ?? "").trim();

const isUuid = (v: any): v is string =>
  typeof v === "string" &&
  /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v);

const normStatus = (v: any): CompanyStatus => {
  const s = safeStr(v).toLowerCase();
  if (s === "active" || s === "paused" || s === "closed") return s;
  return "pending";
};

const normTier = (v: any): AgreementTier | null => {
  const s = safeStr(v).toLowerCase();
  if (s === "basis") return "basis";
  if (s === "luxus" || s === "luksus") return "luxus";
  return null;
};

const toNum = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function pickLatestAgreementRow(rows: any[]): any | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const rank = (r: any) => {
    const st = safeStr(r?.status).toUpperCase();
    const w = st === "ACTIVE" ? 3 : st === "SIGNED" ? 2 : st === "PENDING" ? 1 : 0;
    const ts = r?.updated_at ? Date.parse(String(r.updated_at)) : 0;
    return w * 1_000_000_000_000 + ts;
  };

  let best: any = null;
  for (const r of rows) if (!best || rank(r) > rank(best)) best = r;
  return best;
}

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.company.GET", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  try {
    const admin = supabaseAdmin();

    /* =======================
       Company
    ======================= */
    const { data: companyRow, error: companyErr } = await admin
      .from("companies")
      .select("id,name,orgnr,status,updated_at,created_at,deleted_at")
      .eq("id", companyId)
      .maybeSingle();

    if (companyErr) return jsonErr(a.rid, "Kunne ikke hente firma.", 500, companyErr);
    if (!companyRow) return jsonErr(a.rid, "Fant ikke firma.", 404, "NOT_FOUND");

    const company = {
      id: safeStr(companyRow.id),
      name: companyRow.name ?? null,
      orgnr: companyRow.orgnr ?? null,
      status: normStatus(companyRow.status),
      updated_at: companyRow.updated_at ?? null,
      created_at: companyRow.created_at ?? null,
      deleted_at: companyRow.deleted_at ?? null,
    };

    /* =======================
       Locations
    ======================= */
    const { data: locRows } = await admin
      .from("company_locations")
      .select("id,name,address_line,postnr,city,slot")
      .eq("company_id", companyId);

    const locations = (locRows ?? []).map((r: any) => ({
      id: safeStr(r.id),
      name: r.name ?? null,
      address_line: r.address_line ?? null,
      postnr: r.postnr ?? null,
      city: r.city ?? null,
      slot: r.slot ?? null,
    }));

    /* =======================
       Employees + counts
    ======================= */
    const { data: profRows, error: profErr } = await admin
      .from("profiles")
      .select("id,user_id,email,role,is_active,company_id,location_id")
      .eq("company_id", companyId);

    if (profErr) return jsonErr(a.rid, "Kunne ikke hente ansatte.", 500, profErr);

    const employees = (profRows ?? []).map((r: any) => ({
      id: safeStr(r.user_id || r.id),
      email: r.email ?? null,
      role: r.role ?? null,
      is_active: r.is_active ?? null,
      company_id: r.company_id ?? null,
      location_id: r.location_id ?? null,
    }));

    const active = employees.filter((e) => e.is_active !== false);
    const counts = {
      employeesCount: active.filter((e) => e.role === "employee").length,
      adminsCount: active.filter((e) => e.role === "company_admin").length,
    };

    /* =======================
       Agreement (best effort)
    ======================= */
    let agreement: AgreementSnapshot | null = null;

    const { data: agrRows } = await admin
      .from("company_current_agreement")
      .select(
        "id,status,plan_tier,plan_label,price_per_cuvert_nok,start_date,end_date,updated_at"
      )
      .eq("company_id", companyId);

    if (agrRows && agrRows.length) {
      const best = pickLatestAgreementRow(agrRows);
      const tier = normTier(best.plan_tier);
      const price = toNum(best.price_per_cuvert_nok);

      if (tier && price !== null) {
        agreement = {
          agreementId: safeStr(best.id),
          status: safeStr(best.status),
          planTier: tier,
          planLabel: best.plan_label ?? tier.toUpperCase(),
          pricePerCuvertNok: price,
          startDate: best.start_date ?? null,
          endDate: best.end_date ?? null,
          updatedAt: best.updated_at ?? null,
        };
      }
    }

    return jsonOk(
      a.rid,
      {
        company,
        counts,
        agreement,
        employees,
        locations,
      } satisfies CompanyDetails,
      200
    );
  } catch (e: any) {
    return jsonErr(a.rid, "Uventet feil.", 500, {
      code: "SERVER_ERROR",
      detail: { message: safeStr(e?.message ?? e) },
    });
  }
}
