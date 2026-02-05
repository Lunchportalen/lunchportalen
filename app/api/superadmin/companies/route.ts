// app/api/superadmin/companies/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";

/**
 * ✅ FASIT
 * - companies.status er ENESTE sannhetskilde (lowercase): pending|active|paused|closed
 * - CLOSED skjules som default (include_closed=1 for å vise)
 * - Superadmin-only
 */

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

const ALLOWED = new Set(["pending", "active", "paused", "closed"] as const);
type CompanyStatus = "pending" | "active" | "paused" | "closed";

function normStatus(v: any): CompanyStatus | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!ALLOWED.has(s as any)) return null;
  return s as CompanyStatus;
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

function computePlanLabel(planTier: any, deliveryDays: any) {
  const base = safeStr(planTier).toUpperCase() || null;
  const raw = JSON.stringify(deliveryDays ?? {});
  if (raw.includes("LUXUS")) return "LUXUS";
  if (raw.includes("BASIS")) return "BASIS";
  return base || null;
}

async function bestEffortAudit(admin: any, row: any) {
  try {
    await admin.from("audit_events").insert(row);
  } catch {
    // best effort
  }
}

/**
 * GET /api/superadmin/companies
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
    const statusRaw = safeStr(url.searchParams.get("status") ?? "");
    const status = statusRaw && statusRaw !== "all" ? normStatus(statusRaw) : null;

    const includeClosed = pickBool(req, "includeClosed", false) || pickBool(req, "include_closed", false);

    const archived =
      pickBool(req, "archived", false) ||
      safeStr(url.searchParams.get("tab")).toLowerCase() === "archived" ||
      safeStr(url.searchParams.get("view")).toLowerCase() === "archived";

    const page = clamp(asInt(url.searchParams.get("page"), 1) || 1, 1, 1_000_000);
    const limit = normalizeLimit(url.searchParams.get("limit"), 25);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sortRaw = String(url.searchParams.get("sort") ?? "created_at").trim().toLowerCase();
    const dirRaw = String(url.searchParams.get("dir") ?? "desc").trim().toLowerCase();
    const allowedSorts = ["created_at", "updated_at", "name", "status", "orgnr", "deleted_at"] as const;
    const sort: (typeof allowedSorts)[number] = (allowedSorts as readonly string[]).includes(sortRaw)
      ? (sortRaw as (typeof allowedSorts)[number])
      : "created_at";
    const dir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";

    const admin = supabaseAdmin();

    const selectFull = "id,name,orgnr,status,created_at,updated_at,deleted_at";
    const selectNoUpdated = "id,name,orgnr,status,created_at,deleted_at";

    const buildQuery = (selectCols: string, sortCol: string) => {
      let query = admin
        .from("companies")
        .select(selectCols, { count: "exact" })
        .order(sortCol, { ascending: dir === "asc" })
        .range(from, to);

      if (archived) {
        query = query.not("deleted_at", "is", null);
      } else {
        query = query.is("deleted_at", null);
      }

      if (!archived && !includeClosed) query = query.neq("status", "closed");
      if (status) query = query.eq("status", status);

      if (q) {
        const esc = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
        const like = `%${esc}%`;
        if (isUuid(q)) {
          query = query.or(`id.eq.${q},name.ilike.${like},orgnr.ilike.${like}`);
        } else {
          query = query.or(`name.ilike.${like},orgnr.ilike.${like}`);
        }
      }

      return query;
    };

    let data: any[] | null | undefined;
    let error: any;
    let count: number | null | undefined;

    ({ data, error, count } = await buildQuery(selectFull, sort));

    if (error && isMissingColumn(error)) {
      const msg = errMessage(error).toLowerCase();
      if (msg.includes("deleted_at")) {
        return jsonErr(ctx.rid, error.message, 500, "DB_ERROR");
      }
      const fallbackSort = sort === "updated_at" ? "created_at" : sort;
      ({ data, error, count } = await buildQuery(selectNoUpdated, fallbackSort));
    }

    if (error) {
      console.error("SUPABASE companies query failed", error);
      return jsonErr(ctx.rid, error.message, 500, "DB_ERROR");
    }

    const companies = (data ?? []) as Array<{
      id: string;
      name: string;
      orgnr: string | null;
      status: CompanyStatus | string;
      created_at: string;
      updated_at?: string;
      deleted_at?: string | null;
    }>;
    const total = count ?? companies.length;
    const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

    const ids = companies.map((c) => c.id).filter(Boolean);

    // 2) Counts (profiles)
    const countsByCompany = new Map<string, { employeesCount: number; adminsCount: number }>();
    if (ids.length) {
      const { data: profData, error: profError } = await admin
        .from("profiles")
        .select("company_id, role, is_active")
        .in("company_id", ids);
      if (profError) {
        console.error("SUPABASE companies profiles query failed", profError);
        return jsonErr(ctx.rid, profError.message, 500, "DB_ERROR");
      }

      for (const row of (profData ?? []) as any[]) {
        const cid = safeStr(row?.company_id);
        if (!cid) continue;
        if (row?.is_active === false) continue;
        const role = safeStr(row?.role).toLowerCase() || "employee";

        const current = countsByCompany.get(cid) ?? { employeesCount: 0, adminsCount: 0 };
        if (role === "company_admin") current.adminsCount += 1;
        if (role === "employee") current.employeesCount += 1;
        countsByCompany.set(cid, current);
      }
    }

    // 3) Agreement snapshot (company_current_agreement)
    const agreementByCompany = new Map<string, any>();
    if (ids.length) {
      const { data: agrData, error: agrError } = await admin
        .from("company_current_agreement")
        .select("id,company_id,status,plan_tier,price_per_cuvert_nok,delivery_days,start_date,end_date,updated_at")
        .in("company_id", ids);
      if (agrError) {
        console.error("SUPABASE companies agreement query failed", agrError);
        return jsonErr(ctx.rid, agrError.message, 500, "DB_ERROR");
      }

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
    }

    const items = companies.map((c) => {
      const s = normStatus(c.status) ?? "pending";
      const counts = countsByCompany.get(c.id) ?? { employeesCount: 0, adminsCount: 0 };
      const agr = agreementByCompany.get(c.id) ?? null;
      const planLabel = computePlanLabel(agr?.plan_tier ?? null, agr?.delivery_days ?? null);

      return {
        id: c.id,
        name: c.name,
        orgnr: c.orgnr ?? null,
        status: s,
        planLabel: planLabel ?? "—",
        employeesCount: counts.employeesCount,
        adminsCount: counts.adminsCount,
        createdAt: c.created_at ?? null,
        updatedAt: c.updated_at ?? null,
        archivedAt: c.deleted_at ?? null,
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
        },
        filters: {
          q: q || null,
          status: status || "all",
          includeClosed,
          archived,
          sort,
          dir,
        },
      },
      200
    );
  } catch (e: any) {
    return jsonErr(ctx.rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: { message: String(e?.message ?? e) } });
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
    const status = normStatus(body?.status) ?? "pending";

    if (!name) return jsonErr(ctx.rid, "Mangler name.", 400, "BAD_REQUEST");

    const admin = supabaseAdmin();

    const { data: insData, error: insError } = await admin
      .from("companies")
      .insert({ name, orgnr: orgnr ?? null, status })
      .select("id,name,orgnr,status,created_at,updated_at")
      .single();

    if (insError || !insData) {
      return jsonErr(ctx.rid, insError?.message ?? "Ukjent feil.", 500, { code: "DB_ERROR", detail: insError });
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

    return jsonOk(
      ctx.rid,
      {
        company: insData,
      },
      201
    );
  } catch (e: any) {
    return jsonErr(ctx.rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: { message: String(e?.message ?? e) } });
  }
}
