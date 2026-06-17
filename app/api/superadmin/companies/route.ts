// app/api/superadmin/companies/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import {
  loadSuperadminProviderList,
  type SuperadminProviderListStatus,
} from "@/lib/server/superadmin/loadSuperadminProviderList";

/**
 * Superadmin list: provider-first (cateringfirma/leverandører).
 * Lunch customer companies live under provider detail via companies.provider_id.
 */

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

type CompanyStatusEnum = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";

function normalizeCompanyStatus(raw: string | null): CompanyStatusEnum | null {
  const s = safeStr(raw).toUpperCase();
  if (s === "PENDING") return "PENDING";
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  return null;
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

    const sortRaw = String(url.searchParams.get("sort") ?? "updated_at").trim().toLowerCase();
    const dirRaw = String(url.searchParams.get("dir") ?? "desc").trim().toLowerCase();
    const allowedSorts = ["created_at", "updated_at", "name", "status", "orgnr"] as const;
    const sort: (typeof allowedSorts)[number] = (allowedSorts as readonly string[]).includes(sortRaw)
      ? (sortRaw as (typeof allowedSorts)[number])
      : "updated_at";
    const dir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";

    const admin = supabaseAdmin();

    const listStatus: SuperadminProviderListStatus | null =
      statusEnum === "PENDING" ? "pending"
      : statusEnum === "ACTIVE" ? "active"
      : statusEnum === "PAUSED" ? "paused"
      : statusEnum === "CLOSED" ? "closed"
      : null;

    const providerList = await loadSuperadminProviderList(admin, {
      q,
      status: listStatus,
      includeClosed,
      page,
      limit,
      sort,
      dir,
    });

    const items = providerList.items.map((p) => ({
      id: p.id,
      name: p.name,
      orgnr: p.orgnr,
      status: p.status,
      entityKind: p.entityKind,
      customersCount: p.customersCount,
      activeAgreementsCount: p.activeAgreementsCount,
      employeesCount: 0,
      adminsCount: 0,
      planLabel: null,
      agreementStatus: p.activeAgreementsCount > 0 ? "ACTIVE" : null,
      contractStartDate: null,
      contractEndDate: null,
      bindingMonthsRemaining: null,
      effectiveBindingEndDate: null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      archivedAt: null,
      registrationExists: false,
      ledgerPendingAgreementId: null,
      ledgerActiveAgreementId: null,
      pipelineStageLabel: null,
      pipelineNextLabel: null,
      pipelineNextHref: null,
      pipelinePrimaryHref: `/superadmin/companies/${encodeURIComponent(p.id)}`,
    }));

    return jsonOk(
      ctx.rid,
      {
        items,
        page,
        limit,
        total: providerList.total,
        totalPages: providerList.totalPages,
        source: {
          list: "providers",
          customers: "companies.provider_id",
          agreements: "agreements",
        },
        filters: {
          q: q || null,
          status: statusEnum ? statusEnum.toLowerCase() : null,
          includeClosed,
          sort,
          dir,
          view: includeClosed ? "all" : "active",
          entityKind: "provider",
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
