export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { osloTodayISODate } from "@/lib/date/oslo";
import {
  buildContractOverviewFromLedger,
  pickBestAgreementLedgerRow,
  type ContractOverview,
} from "@/lib/agreements/contractBindingCompute";
import {
  buildAgreementDocumentOverview,
  type AgreementDocumentOverview,
} from "@/lib/agreements/buildAgreementDocumentOverview";
import {
  deriveSuperadminRegistrationPipelineNext,
  deriveSuperadminRegistrationPipelinePrimaryHref,
  indexLedgerAgreementsByCompanyId,
} from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

type CompanyStatus = "active" | "paused" | "closed" | "pending";

type AgreementSnapshot = {
  id: string;
  status: "PENDING" | "ACTIVE" | "TERMINATED" | string;
  tier: "BASIS" | "LUXUS" | null;
  delivery_days: string[];
  starts_at: string | null;
  slot_start: string | null;
  slot_end: string | null;
  updated_at: string | null;
};

type CompanyDetails = {
  company: {
    id: string;
    name: string | null;
    orgnr: string | null;
    status: CompanyStatus;
    updated_at: string | null;
    created_at: string | null;
  };
  counts: {
    employeesCount: number;
    adminsCount: number;
  };
  agreement: AgreementSnapshot | null;
  /** Operativt avtalegrunnlag (company_agreements) — kun superadmin via denne ruten. */
  contract_overview: ContractOverview | null;
  /** Avtaledokumenter / vilkårsregistrering — kun operativt lag som allerede finnes. */
  agreement_documents: AgreementDocumentOverview[];
  employees: Array<{
    id: string;
    email: string | null;
    role: string | null;
    active: boolean | null;
    company_id: string | null;
    location_id: string | null;
  }>;
  locations: Array<{
    id: string;
    name: string | null;
    address: string | null;
    active: boolean | null;
  }>;
  /** Samme operative kjede som firmaliste / registreringsinnboks (kun visning). */
  registration_pipeline: {
    registration_exists: boolean;
    ledger_pending_agreement_id: string | null;
    ledger_active_agreement_id: string | null;
    pipeline_stage_label: string;
    pipeline_next_label: string;
    pipeline_next_href: string | null;
    pipeline_primary_href: string;
  };
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: unknown) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    safeStr(v)
  );
}

function normCompanyStatus(v: unknown): CompanyStatus {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "PAUSED") return "paused";
  if (s === "CLOSED") return "closed";
  return "pending";
}

function normTier(v: unknown): "BASIS" | "LUXUS" | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s;
  return null;
}

function normalizeDays(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => safeStr(x).toUpperCase())
    .filter((x) => x === "MON" || x === "TUE" || x === "WED" || x === "THU" || x === "FRI");
}

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = safeStr(s?.ctx?.rid) || "rid_missing";
  return jsonErr(rid, "Du ma vere innlogget.", 401, "UNAUTHENTICATED");
}

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const g: any = await scopeOr401(req);
  if (!g?.ok) return denyResponse(g);

  const deny = requireRoleOr403(g.ctx, "superadmin.companies.read", ["superadmin"]);
  if (deny) return deny;

  const rid = g.ctx.rid;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(rid, "Ugyldig firma.", 400, "BAD_INPUT");

  try {
    const admin = supabaseAdmin();

    const companyRes = await admin
      .from("companies")
      .select("id,name,orgnr,status,updated_at,created_at,agreement_json")
      .eq("id", companyId)
      .maybeSingle();

    if (companyRes.error) return jsonErr(rid, "Kunne ikke hente firma.", 500, "COMPANY_LOOKUP_FAILED");
    if (!companyRes.data?.id) return jsonErr(rid, "Fant ikke firma.", 404, "COMPANY_NOT_FOUND");

    const company = {
      id: safeStr(companyRes.data.id),
      name: (companyRes.data as any).name ?? null,
      orgnr: (companyRes.data as any).orgnr ?? null,
      status: normCompanyStatus((companyRes.data as any).status),
      updated_at: (companyRes.data as any).updated_at ?? null,
      created_at: (companyRes.data as any).created_at ?? null,
    };

    const locationsRes = await admin
      .from("company_locations")
      .select("id,name,address,active")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    const locations = (locationsRes.data ?? []).map((row: any) => ({
      id: safeStr(row.id),
      name: row.name ?? null,
      address: row.address ?? null,
      active: typeof row.active === "boolean" ? row.active : null,
    }));

    const profilesRes = await admin
      .from("profiles")
      .select("id,user_id,role,active,company_id,location_id")
      .eq("company_id", companyId);

    if (profilesRes.error) return jsonErr(rid, "Kunne ikke hente ansatte.", 500, "PROFILES_LOOKUP_FAILED");

    const employees = (profilesRes.data ?? []).map((row: any) => ({
      id: safeStr(row.user_id ?? row.id),
      email: null,
      role: row.role ?? null,
      active: typeof row.active === "boolean" ? row.active : null,
      company_id: row.company_id ?? null,
      location_id: row.location_id ?? null,
    }));

    const counts = {
      employeesCount: employees.filter((e) => safeStr(e.role).toLowerCase() === "employee").length,
      adminsCount: employees.filter((e) => safeStr(e.role).toLowerCase() === "company_admin").length,
    };

    const [agreementsRes, ledgerRes, termsAccRes, regRes] = await Promise.all([
      admin
        .from("agreements")
        .select("id,company_id,status,created_at,tier,delivery_days,starts_at,slot_start,slot_end,updated_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(10),
      admin
        .from("company_agreements")
        .select(
          "id,status,start_date,end_date,binding_months,notice_months,plan_tier,delivery_days,updated_at,created_at"
        )
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(20),
      admin
        .from("company_terms_acceptance")
        .select("id, version, accepted_at, credit_check_system, binding_months, notice_months, created_at")
        .eq("company_id", companyId)
        .order("accepted_at", { ascending: false })
        .limit(50),
      admin.from("company_registrations").select("company_id").eq("company_id", companyId).maybeSingle(),
    ]);

    if (regRes.error) {
      return jsonErr(rid, "Kunne ikke sjekke firmaregistrering.", 500, "REGISTRATION_LOOKUP_FAILED");
    }
    const registration_exists = !!regRes.data?.company_id;

    const statusForPipeline = safeStr((companyRes.data as any).status) || null;
    let ledger_pending_agreement_id: string | null = null;
    let ledger_active_agreement_id: string | null = null;
    if (!agreementsRes.error && Array.isArray(agreementsRes.data)) {
      const idx = indexLedgerAgreementsByCompanyId(agreementsRes.data as Record<string, unknown>[]);
      ledger_pending_agreement_id = idx.pendingIdByCompany.get(companyId) ?? null;
      ledger_active_agreement_id = idx.activeIdByCompany.get(companyId) ?? null;
    }
    const pipe = deriveSuperadminRegistrationPipelineNext({
      company_status: statusForPipeline,
      ledger_pending_agreement_id,
      ledger_active_agreement_id,
    });
    const pipeline_primary_href = deriveSuperadminRegistrationPipelinePrimaryHref({
      company_id: companyId,
      company_status: statusForPipeline,
      ledger_pending_agreement_id,
      ledger_active_agreement_id,
      registration_exists,
      pipe,
    });
    const registration_pipeline = {
      registration_exists,
      ledger_pending_agreement_id,
      ledger_active_agreement_id,
      pipeline_stage_label: pipe.stage_label,
      pipeline_next_label: pipe.next_label,
      pipeline_next_href: pipe.next_href,
      pipeline_primary_href,
    };

    let agreement: AgreementSnapshot | null = null;
    if (!agreementsRes.error && Array.isArray(agreementsRes.data) && agreementsRes.data.length) {
      const best = pickBestAgreementLedgerRow(agreementsRes.data);
      if (best?.id) {
        agreement = {
          id: safeStr(best.id),
          status: safeStr(best.status).toUpperCase(),
          tier: normTier(best.tier),
          delivery_days: normalizeDays(best.delivery_days),
          starts_at: best.starts_at ?? null,
          slot_start: best.slot_start ?? null,
          slot_end: best.slot_end ?? null,
          updated_at: best.updated_at ?? null,
        };
      }
    }

    let contract_overview: ContractOverview | null = null;
    let ledgerAgreementId: string | null = null;
    if (!ledgerRes.error && Array.isArray(ledgerRes.data) && ledgerRes.data.length) {
      const bestLedger = pickBestAgreementLedgerRow(ledgerRes.data);
      ledgerAgreementId = bestLedger?.id ? safeStr(bestLedger.id) : null;
      contract_overview = buildContractOverviewFromLedger(bestLedger, osloTodayISODate());
    }

    const termsRows = !termsAccRes.error && Array.isArray(termsAccRes.data) ? termsAccRes.data : [];
    const agreement_documents = buildAgreementDocumentOverview({
      companyId,
      agreementJson: (companyRes.data as any)?.agreement_json ?? null,
      termsAcceptanceRows: termsRows as any[],
      companyAgreementId: ledgerAgreementId,
      legacyAgreementId: agreement?.id ?? null,
    });

    const data: CompanyDetails = {
      company,
      counts,
      agreement,
      contract_overview,
      agreement_documents,
      employees,
      locations,
      registration_pipeline,
    };

    return jsonOk(rid, data, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke hente firmadetaljer.", 500, "COMPANY_DETAILS_UNEXPECTED");
  }
}
