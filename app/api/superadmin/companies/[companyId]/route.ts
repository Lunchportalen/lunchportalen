// app/api/superadmin/companies/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getScope, requireSuperadmin, type Role } from "@/lib/auth/scope";

/**
 * ✅ FASIT
 * - companies.status er ENESTE sannhetskilde (lowercase): pending|active|paused|closed
 * - CLOSED skjules som default (include_closed=1 for å vise)
 * - "Sist endret" kommer fra audit_events (action=COMPANY_STATUS_SET)
 * - Superadmin-only
 */

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function rid() {
  return crypto.randomBytes(8).toString("hex");
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

/**
 * GET /api/superadmin/companies
 *
 * Query:
 * - q=... (search name/orgnr)
 * - status=pending|active|paused|closed (optional)
 * - include_closed=1 (default 0)
 * - page=1.. (default 1)
 * - limit=1..200 (default 50)
 * - sort=updated_at|created_at|name (default updated_at)
 * - dir=asc|desc (default desc)
 * - include_last=1 (default 1) include last_event from audit
 * - include_stats=1 (default 1)
 *
 * Response:
 * { ok, rid, page, limit, total, stats?, companies:[... { last_event? } ] }
 */
export async function GET(req: NextRequest) {
  const requestId = rid();

  // ✅ Auth + superadmin guard (FASIT)
  let scope: Awaited<ReturnType<typeof getScope>>;
  try {
    scope = await getScope(req);
    requireSuperadmin(scope);
  } catch (e: any) {
    return jsonErr(e?.status ?? 403, requestId, e?.code ?? "FORBIDDEN", e?.message ?? "Ingen tilgang.");
  }

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
    if (listRes.error) return jsonErr(500, requestId, "db_error", "Kunne ikke hente firma.", listRes.error);

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
      actor_role: Role | string | null;
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
          if (!lastByCompany[row.entity_id]) lastByCompany[row.entity_id] = row; // newest wins (already sorted)
        }
      }
    }

    return jsonOk({
      ok: true,
      rid: requestId,
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
    });
  } catch (e: any) {
    return jsonErr(500, requestId, "server_error", "Uventet feil.", String(e?.message ?? e));
  }
}

/**
 * POST /api/superadmin/companies
 * (valgfritt) Opprett firma (minimal)
 * Body: { name: string, orgnr?: string|null, status?: pending|active|paused|closed }
 *
 * NB: Hvis dere ikke ønsker å opprette firma her, kan du slette denne.
 */
export async function POST(req: NextRequest) {
  const requestId = rid();

  let scope: Awaited<ReturnType<typeof getScope>>;
  try {
    scope = await getScope(req);
    requireSuperadmin(scope);
  } catch (e: any) {
    return jsonErr(e?.status ?? 403, requestId, e?.code ?? "FORBIDDEN", e?.message ?? "Ingen tilgang.");
  }

  try {
    const body = await req.json().catch(() => ({}));

    const name = safeText(body?.name, 120);
    const orgnr = safeText(body?.orgnr, 40);
    const status = normStatus(body?.status) ?? "pending";

    if (!name) return jsonErr(400, requestId, "bad_request", "Mangler name.");

    const admin = supabaseAdmin();

    const ins = await admin
      .from("companies")
      .insert({ name, orgnr: orgnr ?? null, status })
      .select("id,name,orgnr,status,created_at,updated_at")
      .single();

    if (ins.error || !ins.data) return jsonErr(500, requestId, "db_error", "Kunne ikke opprette firma.", ins.error);

    // audit (best effort)
    await admin.from("audit_events").insert({
      actor_user_id: scope.user_id ?? null,
      actor_email: scope.email ?? null,
      actor_role: scope.role ?? null,
      action: "COMPANY_CREATED",
      entity_type: "company",
      entity_id: ins.data.id,
      summary: `Company created: ${ins.data.name}`,
      detail: { name: ins.data.name, orgnr: ins.data.orgnr ?? null, status: ins.data.status, rid: requestId },
    });

    return jsonOk({ ok: true, rid: requestId, company: ins.data }, 201);
  } catch (e: any) {
    return jsonErr(500, requestId, "server_error", "Uventet feil.", String(e?.message ?? e));
  }
}
