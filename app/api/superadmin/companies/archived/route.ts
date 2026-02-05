// app/api/superadmin/companies/archived/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

function safeStr(v: any) {
  return String(v ?? "").trim();
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

const ALLOWED_LIMITS = new Set([10, 25, 50, 100]);
function normalizeLimit(v: string | null, fallback: number) {
  const n = asInt(v, fallback);
  return ALLOWED_LIMITS.has(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du mÃ¥ vÃ¦re innlogget.", 401, "UNAUTHENTICATED");
}

export async function GET(req: NextRequest): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.companies.archived.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const url = new URL(req.url);

    const q = safeText(url.searchParams.get("q"), 80) ?? "";

    const page = clamp(asInt(url.searchParams.get("page"), 1) || 1, 1, 1_000_000);
    const limit = normalizeLimit(url.searchParams.get("limit"), 25);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sortRaw = String(url.searchParams.get("sort") ?? "updated_at").trim().toLowerCase();
    const dirRaw = String(url.searchParams.get("dir") ?? "desc").trim().toLowerCase();
    const dir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";

    const orderColumn = sortRaw === "name" ? "company_name_snapshot" : "deleted_at";

    const admin = supabaseAdmin();

    let query = admin
      .from("company_deletions")
      .select("company_id,company_name_snapshot,orgnr_snapshot,deleted_at,counts_json,mode", { count: "exact" })
      .order(orderColumn as any, { ascending: dir === "asc" })
      .range(from, to);

    if (q) {
      const esc = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
      const like = `%${esc}%`;
      query = query.or(`company_name_snapshot.ilike.${like},orgnr_snapshot.ilike.${like}`);
    }

    const listRes = await query;
    if (listRes.error) return jsonErr(ctx.rid, "Kunne ikke hente arkiverte firma.", 500, { code: "DB_ERROR", detail: listRes.error });

    const rows = (listRes.data ?? []) as any[];
    const total = listRes.count ?? rows.length;
    const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

    const items = rows.map((r) => {
      const counts = (r?.counts_json ?? {}) as any;
      return {
        id: safeStr(r?.company_id),
        name: safeStr(r?.company_name_snapshot) || "Ukjent firma",
        orgnr: r?.orgnr_snapshot ?? null,
        status: "closed",
        planLabel: null,
        employeesCount: Number.isFinite(Number(counts?.employees)) ? Number(counts.employees) : null,
        adminsCount: null,
        createdAt: null,
        updatedAt: r?.deleted_at ?? null,
        archivedAt: r?.deleted_at ?? null,
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
          companies: "company_deletions",
          profiles: "profiles",
          agreement: "company_current_agreement",
        },
        filters: {
          q: q || null,
          status: "archived",
          includeClosed: true,
          sort: sortRaw,
          dir,
        },
      },
      200
    );
  } catch (e: any) {
    return jsonErr(ctx.rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: { message: String(e?.message ?? e) } });
  }
}
