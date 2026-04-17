// app/api/superadmin/companies/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { osloTodayISODate } from "@/lib/date/oslo";
import { buildContractOverviewFromLedger, pickBestAgreementLedgerRow } from "@/lib/agreements/contractBindingCompute";
import {
  deriveSuperadminRegistrationPipelineNext,
  deriveSuperadminRegistrationPipelinePrimaryHref,
  indexLedgerAgreementsByCompanyId,
} from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";

/**
 * ✅ FASIT
 * - companies.status er ENESTE sannhetskilde (enum): PENDING|ACTIVE|PAUSED|CLOSED
 * - CLOSED skjules som default (include_closed=1 / includeClosed=1 for å vise)
 * - Superadmin-only
 */

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

type CompanyStatusEnum = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";
type CompanyStatus = "pending" | "active" | "paused" | "closed";

function normalizeCompanyStatus(raw: string | null): CompanyStatusEnum | null {
  const s = safeStr(raw).toUpperCase();
  if (s === "PENDING") return "PENDING";
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  return null;
}

function toClientCompanyStatus(raw: unknown): CompanyStatus {
  const s = normalizeCompanyStatus(raw == null ? null : String(raw));
  if (s === "ACTIVE") return "active";
  if (s === "PAUSED") return "paused";
  if (s === "CLOSED") return "closed";
  return "pending";
}

function safeText(v: any, max = 200) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}
function safeStr(v: any) {
  return String(v ?? "").trim();
}
function asInt(v: string | null, fallback: number) {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}
const ALLOWED_LIMITS = new Set([10, 25, 50, 100]);
function normalizeLimit(v: string | null, fallback: number) {
  const n = asInt(v, fallback);
  return ALLOWED_LIMITS.has(n) ? n : fallback;
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function pickBool(req: NextRequest, key: string, fallback: boolean) {
  try {
    const v = req.nextUrl.searchParams.get(key);
    if (v == null) return fallback;
    const s = safeStr(v).toLowerCase();
    if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
    if (s === "0" || s === "false" || s === "no" || s === "off") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function errMessage(err: any) {
  return safeStr(err?.message || err?.details || err?.hint || err?.code || "");
}

function isMissingColumn(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function isMissingRelation(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42p01" || msg.includes("does not exist") || msg.includes("relation");
}

function computePlanLabel(planTier: any, deliveryDays: any) {
  const base = safeStr(planTier).toUpperCase() || null;
  const raw = JSON.stringify(deliveryDays ?? {});
  if (raw.toUpperCase().includes("LUXUS")) return "LUXUS";
  if (raw.toUpperCase().includes("BASIS")) return "BASIS";
  return base || null;
}

async function bestEffortAudit(admin: any, row: any) {
  try {
    await admin.from("audit_events").insert(row);
  } catch {
    // best effort only
  }
}

/**
 * GET /api/superadmin/companies
 *
 * Query:
 * - q
 * - status=pending|active|paused|closed|all (case-insensitive)
 * - include_closed=1 (or includeClosed=1)
 * - page, limit (10/25/50/100)
 * - sort=created_at|updated_at|name|status|orgnr
 * - dir=asc|desc
 */
export async function GET(req: NextRequest): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.companies.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const url = new URL(req.url);

    const q = safeText(url.searchParams.get("q"), 80) ?? "";
    const statusRaw = url.searchParams.get("status");
    const statusRawSafe = safeStr(statusRaw);
    const hasStatusFilter = statusRawSafe.length > 0 && statusRawSafe.toLowerCase() !== "all";
    const statusEnum = hasStatusFilter ? normalizeCompanyStatus(statusRaw) : null;

    if (hasStatusFilter && !statusEnum) {
      return jsonErr(ctx.rid, "Ugyldig status.", 400, { code: "BAD_REQUEST", detail: { status: statusRaw } });
    }

    // ✅ accept both include_closed and includeClosed
    const includeClosed = pickBool(req, "includeClosed", false) || pickBool(req, "include_closed", false);

    const page = clamp(asInt(url.searchParams.get("page"), 1) || 1, 1, 1_000_000);
    const limit = normalizeLimit(url.searchParams.get("limit"), 25);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sortRaw = String(url.searchParams.get("sort") ?? "updated_at").trim().toLowerCase();
    const dirRaw = String(url.searchParams.get("dir") ?? "desc").trim().toLowerCase();
    const allowedSorts = ["created_at", "updated_at", "name", "status", "orgnr"] as const;
    const sort: (typeof allowedSorts)[number] = (allowedSorts as readonly string[]).includes(sortRaw)
      ? (sortRaw as (typeof allowedSorts)[number])
      : "updated_at";
    const dir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";

    const admin = supabaseAdmin();

    // Production columns are fixed for companies table.
    const selectCols = "id,name,orgnr,status,created_at,updated_at";

    const buildQuery = (sortCol: string) => {
      let query = admin
        .from("companies")
        .select(selectCols, { count: "exact" })
        .order(sortCol, { ascending: dir === "asc" })
        .range(from, to);

      // closed hidden by default
      if (!includeClosed) query = query.neq("status", "CLOSED");
      if (statusEnum) query = query.eq("status", statusEnum);

      if (q) {
        const esc = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
        const like = `%${esc}%`;

        if (isUuid(q)) query = query.or(`id.eq.${q},name.ilike.${like},orgnr.ilike.${like}`);
        else query = query.or(`name.ilike.${like},orgnr.ilike.${like}`);
      }

      return query;
    };

    const { data, error, count } = await buildQuery(sort);

    if (error) {
      console.error("SUPABASE companies query failed", error);
      return jsonErr(ctx.rid, "Kunne ikke hente data.", 500, "DB_ERROR");
    }

    const companies = (data ?? []) as Array<{
      id: string;
      name: string;
      orgnr: string | null;
      status: CompanyStatus | string;
      created_at: string;
      updated_at?: string | null;
    }>;

    const total = typeof count === "number" ? count : companies.length;
    const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
    const ids = companies.map((c) => c.id).filter(Boolean);

    /* ---------------------------------------------------------
       2) Counts (profiles)
       profiles schema: id,user_id,email,role,company_id,location_id
    --------------------------------------------------------- */
    const countsByCompany = new Map<string, { employeesCount: number; adminsCount: number }>();

    if (ids.length) {
      const { data: profData, error: profError } = await admin
        .from("profiles")
        .select("company_id, role")
        .in("company_id", ids);

      if (profError) {
        console.error("SUPABASE profiles query failed", profError);
        return jsonErr(ctx.rid, "Kunne ikke hente data.", 500, "DB_ERROR");
      }

      for (const row of (profData ?? []) as any[]) {
        const cid = safeStr(row?.company_id);
        if (!cid) continue;

        const role = safeStr(row?.role).toLowerCase();
        const cur = countsByCompany.get(cid) ?? { employeesCount: 0, adminsCount: 0 };

        if (role === "company_admin") cur.adminsCount += 1;
        else cur.employeesCount += 1;

        countsByCompany.set(cid, cur);
      }
    }

    /* ---------------------------------------------------------
       2b) Registrering + ledger-avtaler (samme semantikk som registreringsdetalj)
    --------------------------------------------------------- */
    const registrationCompanyIds = new Set<string>();
    let pendingIdByCompany = new Map<string, string>();
    let activeIdByCompany = new Map<string, string>();

    if (ids.length) {
      const { data: regData, error: regError } = await admin.from("company_registrations").select("company_id").in("company_id", ids);

      if (regError) {
        if (!isMissingRelation(regError) && !isMissingColumn(regError)) {
          console.error("SUPABASE company_registrations list query failed", regError);
          return jsonErr(ctx.rid, "Kunne ikke hente data.", 500, "DB_ERROR");
        }
      } else {
        for (const row of regData ?? []) {
          const cid = safeStr((row as any)?.company_id);
          if (cid) registrationCompanyIds.add(cid);
        }
      }

      const { data: agrLedgerRows, error: agrLedgerErr } = await admin
        .from("agreements")
        .select("id,company_id,status,created_at")
        .in("company_id", ids)
        .in("status", ["PENDING", "ACTIVE"]);

      if (agrLedgerErr) {
        if (!isMissingRelation(agrLedgerErr) && !isMissingColumn(agrLedgerErr)) {
          console.error("SUPABASE agreements pipeline query failed", agrLedgerErr);
          return jsonErr(ctx.rid, "Kunne ikke hente data.", 500, "DB_ERROR");
        }
      } else {
        const idx = indexLedgerAgreementsByCompanyId((agrLedgerRows ?? []) as Record<string, unknown>[]);
        pendingIdByCompany = idx.pendingIdByCompany;
        activeIdByCompany = idx.activeIdByCompany;
      }
    }

    /* ---------------------------------------------------------
       3) Agreement snapshot (best-effort)
       - Optional view/table: company_current_agreement
       - Never blocks list if missing
    --------------------------------------------------------- */
    const agreementByCompany = new Map<string, any>();

    if (ids.length) {
      const { data: agrData, error: agrError } = await admin
        .from("company_current_agreement")
        .select("id,company_id,status,plan_tier,price_per_cuvert_nok,delivery_days,start_date,end_date,updated_at")
        .in("company_id", ids);

      if (!agrError) {
        const rank = (r: any) => {
          const st = safeStr(r?.status).toUpperCase();
          const w = st === "ACTIVE" ? 2 : st === "PAUSED" ? 1 : 0;
          const ts = r?.updated_at ? Date.parse(String(r.updated_at)) : 0;
          return w * 1_000_000_000_000 + ts;
        };

        for (const r of agrData ?? []) {
          const cid = safeStr((r as any).company_id);
          if (!cid) continue;
          const cur = agreementByCompany.get(cid);
          if (!cur || rank(r) > rank(cur)) agreementByCompany.set(cid, r);
        }
      } else {
        if (!isMissingRelation(agrError) && !isMissingColumn(agrError)) {
          console.error("SUPABASE agreement snapshot query failed", agrError);
          return jsonErr(ctx.rid, "Kunne ikke hente data.", 500, "DB_ERROR");
        }
      }
    }

    /* ---------------------------------------------------------
       3b) Ledger-rader (company_agreements) for kontrakt/binding
       - Samme operative grunnlag som firmadetalj
       - Fail-soft ved manglende tabell/kolonner
    --------------------------------------------------------- */
    const ledgerBestByCompany = new Map<string, any>();

    if (ids.length) {
      const { data: ledData, error: ledError } = await admin
        .from("company_agreements")
        .select(
          "id,company_id,status,start_date,end_date,binding_months,notice_months,plan_tier,delivery_days,updated_at,created_at"
        )
        .in("company_id", ids);

      if (!ledError && Array.isArray(ledData)) {
        const byC = new Map<string, any[]>();
        for (const r of ledData) {
          const cid = safeStr((r as any).company_id);
          if (!cid) continue;
          const arr = byC.get(cid) ?? [];
          arr.push(r);
          byC.set(cid, arr);
        }
        for (const [cid, arr] of byC.entries()) {
          const best = pickBestAgreementLedgerRow(arr);
          if (best) ledgerBestByCompany.set(cid, best);
        }
      } else if (ledError && !isMissingRelation(ledError) && !isMissingColumn(ledError)) {
        console.error("SUPABASE company_agreements list query failed", ledError);
        return jsonErr(ctx.rid, "Kunne ikke hente data.", 500, "DB_ERROR");
      }
    }

    const items = companies.map((c) => {
      const st = toClientCompanyStatus(c.status);
      const counts = countsByCompany.get(c.id) ?? { employeesCount: 0, adminsCount: 0 };
      const agr = agreementByCompany.get(c.id) ?? null;
      const led = ledgerBestByCompany.get(c.id) ?? null;
      const overview = led ? buildContractOverviewFromLedger(led, osloTodayISODate()) : null;

      const planLabelFromOverview =
        overview?.plan_tier === "LUXUS" || overview?.plan_tier === "BASIS" ? overview.plan_tier : null;
      const planLabel =
        planLabelFromOverview ?? computePlanLabel(agr?.plan_tier ?? null, agr?.delivery_days ?? null) ?? null;

      const agreementStatus = overview?.status ?? (agr ? safeStr(agr.status).toUpperCase() : null);
      const contractStartDate = overview?.start_date ?? (agr?.start_date != null ? safeStr(agr.start_date) : null);
      const contractEndDate = overview?.end_date ?? (agr?.end_date != null ? safeStr(agr.end_date) : null);
      const bindingMonthsRemaining = overview?.binding_months_remaining ?? null;
      const effectiveBindingEndDate = overview?.effective_binding_end_date ?? null;

      const registrationExists = registrationCompanyIds.has(c.id);
      const ledgerPendingAgreementId = pendingIdByCompany.get(c.id) ?? null;
      const ledgerActiveAgreementId = activeIdByCompany.get(c.id) ?? null;
      const pipe = deriveSuperadminRegistrationPipelineNext({
        company_status: safeStr(c.status) || null,
        ledger_pending_agreement_id: ledgerPendingAgreementId,
        ledger_active_agreement_id: ledgerActiveAgreementId,
      });
      const pipelinePrimaryHref = deriveSuperadminRegistrationPipelinePrimaryHref({
        company_id: c.id,
        company_status: safeStr(c.status) || null,
        ledger_pending_agreement_id: ledgerPendingAgreementId,
        ledger_active_agreement_id: ledgerActiveAgreementId,
        registration_exists: registrationExists,
        pipe,
      });

      return {
        id: c.id,
        name: c.name,
        orgnr: c.orgnr ?? null,
        status: st,
        planLabel: planLabel ?? null,
        agreementStatus: agreementStatus || null,
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
        bindingMonthsRemaining: bindingMonthsRemaining ?? null,
        effectiveBindingEndDate: effectiveBindingEndDate || null,
        employeesCount: counts.employeesCount,
        adminsCount: counts.adminsCount,
        createdAt: c.created_at ?? null,
        updatedAt: (c as any).updated_at ?? null,
        archivedAt: null,
        registrationExists,
        ledgerPendingAgreementId,
        ledgerActiveAgreementId,
        pipelineStageLabel: pipe.stage_label,
        pipelineNextLabel: pipe.next_label,
        pipelineNextHref: pipe.next_href,
        pipelinePrimaryHref,
      };
    });

    return jsonOk(
      ctx.rid,
      {
        items,
        page,
        limit,
        total,
        totalPages,
        source: {
          companies: "companies",
          profiles: "profiles",
          agreement: "company_current_agreement",
          ledger: "company_agreements",
          company_registrations: "company_registrations",
          agreements_ledger: "agreements",
        },
        filters: {
          q: q || null,
          status: statusEnum ? statusEnum.toLowerCase() : null,
          includeClosed,
          sort,
          dir,
          view: includeClosed ? "all" : "active",
        },
      },
      200
    );
  } catch (e: any) {
    return jsonErr(ctx.rid, "Uventet feil.", 500, {
      code: "SERVER_ERROR",
      detail: { message: String(e?.message ?? e) },
    });
  }
}

/**
 * POST /api/superadmin/companies
 * (valgfritt) Opprett firma (minimal)
 * Body: { name: string, orgnr?: string|null, status?: pending|active|paused|closed }
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.companies.POST", ["superadmin"]);
  if (deny) return deny;

  try {
    const body = (await readJson(req)) ?? {};

    const name = safeText(body?.name, 120);
    const orgnr = safeText(body?.orgnr, 40);
    const statusRaw = body?.status == null ? null : safeStr(body?.status);
    const status = statusRaw ? normalizeCompanyStatus(statusRaw) : "PENDING";

    if (!name) return jsonErr(ctx.rid, "Mangler name.", 400, "BAD_REQUEST");
    if (!status) return jsonErr(ctx.rid, "Ugyldig status.", 400, { code: "BAD_REQUEST", detail: { status: statusRaw } });

    const admin = supabaseAdmin();

    const { data: insData, error: insError } = await admin
      .from("companies")
      .insert({ name, orgnr: orgnr ?? null, status })
      .select("id,name,orgnr,status,created_at,updated_at")
      .single();

    if (insError || !insData) {
      return jsonErr(ctx.rid, insError?.message ?? "Ukjent feil.", 500, {
        code: "DB_ERROR",
        detail: insError,
      });
    }

    await bestEffortAudit(admin, {
      actor_user_id: ctx.scope?.userId ?? null,
      actor_email: ctx.scope?.email ?? null,
      actor_role: ctx.scope?.role ?? null,
      action: "COMPANY_CREATED",
      entity_type: "company",
      entity_id: insData.id,
      summary: `Company created: ${insData.name}`,
      detail: { name: insData.name, orgnr: insData.orgnr ?? null, status: insData.status, rid: ctx.rid },
      rid: ctx.rid,
      created_at: new Date().toISOString(),
    });

    return jsonOk(ctx.rid, { company: insData }, 201);
  } catch (e: any) {
    return jsonErr(ctx.rid, "Uventet feil.", 500, {
      code: "SERVER_ERROR",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
