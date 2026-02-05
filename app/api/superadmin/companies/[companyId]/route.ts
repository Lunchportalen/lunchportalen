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
  agreement: null | {
    tier: AgreementTier;
    days: string[];
    price_per_unit: number;
    binding_start: string | null;
    binding_end: string | null;
  };
  employees: Array<{
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    is_active: boolean | null;
    deleted_at: string | null;
    last_seen_at: string | null;
  }>;
  locations: Array<{
    id: string;
    name: string | null;
    address_line: string | null;
    postnr: string | null;
    city: string | null;
    slot: string | null;
  }>;
  kpi?: {
    orders_30d: number;
    delivered_30d: number;
    cancel_30d: number;
  };
};

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
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

function normStatus(v: any): CompanyStatus {
  const s = safeStr(v).toLowerCase();
  if (s === "active") return "active";
  if (s === "paused") return "paused";
  if (s === "closed") return "closed";
  return "pending";
}

function normTier(v: any): AgreementTier | null {
  const s = safeStr(v).toLowerCase();
  if (s === "basis") return "basis";
  if (s === "luxus" || s === "luksus") return "luxus";
  return null;
}

function errMessage(err: any) {
  return safeStr(err?.message || err?.details || err?.hint || err?.code || "");
}

function isMissingRelation(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

function isMissingColumn(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function normalizeDays(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map((d) => safeStr(d)).filter(Boolean);

  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .filter(([, v]) => {
        if (v === true) return true;
        if (v && typeof v === "object") return Boolean((v as any).enabled);
        return false;
      })
      .map(([k]) => safeStr(k))
      .filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((d) => safeStr(d))
      .filter(Boolean);
  }

  return [];
}

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

    /* ---------------------------------------------------------
       Company (required) — allow schema drift
    --------------------------------------------------------- */
    const companyFull = await admin
      .from("companies")
      .select("id,name,orgnr,status,updated_at,created_at,deleted_at")
      .eq("id", companyId)
      .maybeSingle();

    let companyRow: any = null;

    if (companyFull.error) {
      if (isMissingColumn(companyFull.error)) {
        const companyFallback = await admin.from("companies").select("id,name").eq("id", companyId).maybeSingle();
        if (companyFallback.error) {
          return jsonErr(a.rid, "Kunne ikke hente firma.", 500, { code: "DB_ERROR", detail: companyFallback.error });
        }
        companyRow = companyFallback.data ?? null;
      } else {
        return jsonErr(a.rid, "Kunne ikke hente firma.", 500, { code: "DB_ERROR", detail: companyFull.error });
      }
    } else {
      companyRow = companyFull.data ?? null;
    }

    if (!companyRow) return jsonErr(a.rid, "Fant ikke firma.", 404, "NOT_FOUND");

    const company: CompanyDetails["company"] = {
      id: safeStr(companyRow?.id),
      name: companyRow?.name ?? null,
      orgnr: companyRow?.orgnr ?? null,
      status: normStatus(companyRow?.status),
      updated_at: companyRow?.updated_at ?? null,
      created_at: companyRow?.created_at ?? null,
      deleted_at: companyRow?.deleted_at ?? null,
    };

    /* ---------------------------------------------------------
       Employees (best-effort) — TS-safe, no response reassignment
    --------------------------------------------------------- */
    let employees: CompanyDetails["employees"] = [];

    const profFull = await admin
      .from("profiles")
      .select("user_id,email,name,full_name,role,is_active,deleted_at,last_active_at,last_seen_at")
      .eq("company_id", companyId);

    let profData: any[] = [];

    if (profFull.error) {
      if (isMissingColumn(profFull.error)) {
        const profFallback = await admin
          .from("profiles")
          .select("user_id,email,name,role,is_active,deleted_at,last_active_at")
          .eq("company_id", companyId);

        if (profFallback.error) {
          if (!isMissingRelation(profFallback.error) && !isMissingColumn(profFallback.error)) {
            return jsonErr(a.rid, "Kunne ikke hente ansatte.", 500, { code: "DB_ERROR", detail: profFallback.error });
          }
          profData = [];
        } else {
          profData = (profFallback.data ?? []) as any[];
        }
      } else {
        if (!isMissingRelation(profFull.error) && !isMissingColumn(profFull.error)) {
          return jsonErr(a.rid, "Kunne ikke hente ansatte.", 500, { code: "DB_ERROR", detail: profFull.error });
        }
        profData = [];
      }
    } else {
      profData = (profFull.data ?? []) as any[];
    }

    employees = profData.map((r: any) => {
      const fullName = safeStr(r?.full_name);
      const displayName = fullName || safeStr(r?.name) || null;

      return {
        id: safeStr(r?.user_id || r?.id),
        name: displayName,
        email: r?.email ?? null,
        role: r?.role ?? null,
        is_active: r?.is_active ?? null,
        deleted_at: r?.deleted_at ?? null,
        last_seen_at: r?.last_seen_at ?? r?.last_active_at ?? null,
      };
    });

    employees.sort((x, y) => safeStr(x.name ?? x.email).localeCompare(safeStr(y.name ?? y.email), "nb"));

    /* ---------------------------------------------------------
       Locations (best-effort) — TS-safe, no response reassignment
    --------------------------------------------------------- */
    let locations: CompanyDetails["locations"] = [];

    const locFull = await admin
      .from("company_locations")
      .select("id,name,address_line,postnr,city,slot")
      .eq("company_id", companyId);

    let locData: any[] = [];

    if (locFull.error) {
      if (isMissingColumn(locFull.error)) {
        const locFallback = await admin
          .from("company_locations")
          .select("id,name,postnr,city")
          .eq("company_id", companyId);

        if (locFallback.error) {
          if (!isMissingRelation(locFallback.error) && !isMissingColumn(locFallback.error)) {
            return jsonErr(a.rid, "Kunne ikke hente lokasjoner.", 500, { code: "DB_ERROR", detail: locFallback.error });
          }
          locData = [];
        } else {
          locData = (locFallback.data ?? []) as any[];
        }
      } else {
        if (!isMissingRelation(locFull.error) && !isMissingColumn(locFull.error)) {
          return jsonErr(a.rid, "Kunne ikke hente lokasjoner.", 500, { code: "DB_ERROR", detail: locFull.error });
        }
        locData = [];
      }
    } else {
      locData = (locFull.data ?? []) as any[];
    }

    locations = locData.map((r: any) => ({
      id: safeStr(r?.id),
      name: r?.name ?? null,
      address_line: r?.address_line ?? null,
      postnr: r?.postnr ?? null,
      city: r?.city ?? null,
      slot: r?.slot ?? null,
    }));

    locations.sort((x, y) => safeStr(x.name ?? x.id).localeCompare(safeStr(y.name ?? y.id), "nb"));

    /* ---------------------------------------------------------
       Agreement (best-effort) — never blocks firmadetails
    --------------------------------------------------------- */
    let agreement: CompanyDetails["agreement"] = null;

    const agreementRes = await admin
      .from("company_current_agreement")
      .select("status,plan_tier,delivery_days,price_per_cuvert_nok,updated_at,start_date,end_date,binding_start,binding_end")
      .eq("company_id", companyId);

    if (agreementRes.error) {
      if (!isMissingRelation(agreementRes.error) && !isMissingColumn(agreementRes.error)) {
        return jsonErr(a.rid, "Kunne ikke hente avtale.", 500, { code: "DB_ERROR", detail: agreementRes.error });
      }
    } else if (agreementRes.data && agreementRes.data.length) {
      const rank = (r: any) => {
        const st = safeStr(r?.status).toUpperCase();
        const weight = st === "ACTIVE" ? 2 : st === "PAUSED" ? 1 : 0;
        const ts = r?.updated_at ? Date.parse(String(r.updated_at)) : 0;
        return weight * 1_000_000_000_000 + ts;
      };

      let best: any = null;
      for (const r of agreementRes.data ?? []) {
        if (!best || rank(r) > rank(best)) best = r;
      }

      const tier = normTier(best?.plan_tier);
      const days = normalizeDays(best?.delivery_days);
      const price = toNum(best?.price_per_cuvert_nok);
      const bindingStart = best?.binding_start ?? best?.start_date ?? null;
      const bindingEnd = best?.binding_end ?? best?.end_date ?? null;

      if (tier && price !== null) {
        agreement = {
          tier,
          days,
          price_per_unit: price,
          binding_start: bindingStart,
          binding_end: bindingEnd,
        };
      }
    }

    return jsonOk(a.rid, { company, agreement, employees, locations }, 200);
  } catch (e: any) {
    return jsonErr(a.rid, "Uventet feil.", 500, {
      code: "SERVER_ERROR",
      detail: { message: safeStr(e?.message ?? e) },
    });
  }
}

