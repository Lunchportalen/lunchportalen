// app/api/superadmin/companies/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * ✅ FASIT
 * - companies.status er ENESTE sannhetskilde (lowercase): pending|active|paused|closed
 * - CLOSED skjules som default (include_closed=1 for å vise)
 * - "Sist endret" kommer fra audit_events (action=COMPANY_STATUS_SET)
 * - Superadmin-only
 */

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
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
function asInt(v: string | null, fallback: number) {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
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
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.companies.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const url = new URL(req.url);

    const q = safeText(url.searchParams.get("q"), 80) ?? "";
    const status = normStatus(url.searchParams.get("status")); // optional
    const includeClosed = url.searchParams.get("include_closed") === "1";

    const page = clamp(asInt(url.searchParams.get("page"), 1) || 1, 1, 10_000);
    const limit = clamp(asInt(url.searchParams.get("limit"), 50) || 50, 1, 200);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sortRaw = String(url.searchParams.get("sort") ?? "updated_at").trim().toLowerCase();
    const dirRaw = String(url.searchParams.get("dir") ?? "desc").trim().toLowerCase();
    const sort: "updated_at" | "created_at" | "name" = (["updated_at", "created_at", "name"] as const).includes(sortRaw as any)
      ? (sortRaw as any)
      : "updated_at";
    const dir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";

    const includeLast = (url.searchParams.get("include_last") ?? "1") === "1";
    const includeStats = (url.searchParams.get("include_stats") ?? "1") === "1";

    const admin = supabaseAdmin();

    // 1) List query (companies only)
    let query = admin
      .from("companies")
      .select("id,name,orgnr,status,created_at,updated_at", { count: "exact" })
      .order(sort, { ascending: dir === "asc" })
      .range(from, to);

    // Default: skjul CLOSED
    if (!includeClosed) query = query.neq("status", "closed");

    // Optional status filter
    if (status) query = query.eq("status", status);

    // Optional search on name/orgnr
    if (q) {
      const esc = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
      const like = `%${esc}%`;
      query = query.or(`name.ilike.${like},orgnr.ilike.${like}`);
    }

    const listRes = await query;
    if (listRes.error) return jsonErr(500, ctx, "DB_ERROR", "Kunne ikke hente firma.", listRes.error);

    const companies = (listRes.data ?? []) as Array<{
      id: string;
      name: string;
      orgnr: string | null;
      status: CompanyStatus | string;
      created_at: string;
      updated_at: string;
    }>;
    const total = listRes.count ?? companies.length;

    // 2) Stats (dashboard)
    let stats:
      | {
          companiesTotal: number;
          companiesPending: number;
          companiesActive: number;
          companiesPaused: number;
          companiesClosed: number;
        }
      | undefined;

    if (includeStats) {
      const [p, a, pa, c] = await Promise.all([
        admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "pending"),
        admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "active"),
        admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "paused"),
        admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "closed"),
      ]);

      stats = {
        companiesPending: p.count ?? 0,
        companiesActive: a.count ?? 0,
        companiesPaused: pa.count ?? 0,
        companiesClosed: c.count ?? 0,
        companiesTotal: (p.count ?? 0) + (a.count ?? 0) + (pa.count ?? 0) + (c.count ?? 0),
      };
    }

    // 3) Last event per company (audit_events)
    type LastEventRow = {
      entity_id: string;
      created_at: string;
      actor_email: string | null;
      actor_role: string | null;
      summary: string | null;
      detail: any | null;
    };

    const lastByCompany: Record<string, LastEventRow> = {};
    if (includeLast && companies.length) {
      const ids = companies.map((c) => c.id);

      const aud = await admin
        .from("audit_events")
        .select("entity_id,created_at,actor_email,actor_role,summary,detail")
        .eq("entity_type", "company")
        .eq("action", "COMPANY_STATUS_SET")
        .in("entity_id", ids)
        .order("created_at", { ascending: false });

      if (!aud.error && aud.data) {
        for (const row of aud.data as LastEventRow[]) {
          if (!lastByCompany[row.entity_id]) lastByCompany[row.entity_id] = row;
        }
      }
    }

    return jsonOk(
      ctx,
      {
        ok: true,
        rid: ctx.rid,
        page,
        limit,
        total,
        q: q || null,
        status: status || null,
        include_closed: includeClosed,
        sort,
        dir,
        ...(stats ? { stats } : {}),
        companies: companies.map((c) => {
          const s = normStatus(c.status) ?? "pending";
          const last = lastByCompany[c.id];
          return {
            id: c.id,
            name: c.name,
            orgnr: c.orgnr ?? null,
            status: s,
            created_at: c.created_at,
            updated_at: c.updated_at,
            last_event: includeLast
              ? last
                ? {
                    created_at: last.created_at,
                    actor_email: last.actor_email,
                    actor_role: last.actor_role,
                    summary: last.summary,
                    detail: last.detail,
                  }
                : null
              : undefined,
          };
        }),
      },
      200
    );
  } catch (e: any) {
    return jsonErr(500, ctx, "SERVER_ERROR", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}

/**
 * POST /api/superadmin/companies
 * (valgfritt) Opprett firma (minimal)
 * Body: { name: string, orgnr?: string|null, status?: pending|active|paused|closed }
 */
export async function POST(req: NextRequest): Promise<Response> {
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

    if (!name) return jsonErr(400, ctx, "BAD_REQUEST", "Mangler name.");

    const admin = supabaseAdmin();

    const ins = await admin
      .from("companies")
      .insert({ name, orgnr: orgnr ?? null, status })
      .select("id,name,orgnr,status,created_at,updated_at")
      .single();

    if (ins.error || !ins.data) return jsonErr(500, ctx, "DB_ERROR", "Kunne ikke opprette firma.", ins.error);

    // audit (best effort)
    await bestEffortAudit(admin, {
      actor_user_id: ctx.scope?.userId ?? null,
      actor_email: ctx.scope?.email ?? null,
      actor_role: ctx.scope?.role ?? null,
      action: "COMPANY_CREATED",
      entity_type: "company",
      entity_id: ins.data.id,
      summary: `Company created: ${ins.data.name}`,
      detail: { name: ins.data.name, orgnr: ins.data.orgnr ?? null, status: ins.data.status, rid: ctx.rid },
      rid: ctx.rid,
      created_at: new Date().toISOString(),
    });

    return jsonOk(ctx, { ok: true, rid: ctx.rid, company: ins.data }, 201);
  } catch (e: any) {
    return jsonErr(500, ctx, "SERVER_ERROR", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}
