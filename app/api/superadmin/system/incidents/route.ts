export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function toInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
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

export async function GET(req: NextRequest): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.system.incidents.GET", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const page = Math.max(1, toInt(url.searchParams.get("page"), 1));

  // Support both limit and pageSize (client currently uses pageSize)
  const requested =
    url.searchParams.get("limit") ??
    url.searchParams.get("pageSize") ??
    url.searchParams.get("page_size");

  const limit = Math.min(100, Math.max(1, toInt(requested, 25)));
  const offset = (page - 1) * limit;

  try {
    const admin = supabaseAdmin();

    // Minimal safe select. Do NOT assume advanced columns exist in early Phase 1.
    const res = await admin
      .from("system_incidents")
      .select("id,severity,type,status,count,first_seen,last_seen,scope_company_id,scope_user_id,scope_order_id,details,rid", { count: "exact" })
      .order("last_seen", { ascending: false })
      .range(offset, offset + limit - 1);

    if (res.error) {
      // Phase 1: table/column missing -> safe empty list
      if (isMissingRelation(res.error) || isMissingColumn(res.error)) {
        return jsonOk(a.rid, { items: [], total: 0 }, 200);
      }
      return jsonErr(a.rid, "Kunne ikke hente hendelser.", 500, {
        code: "DB_ERROR",
        detail: res.error,
      });
    }

    return jsonOk(a.rid, { items: res.data ?? [], total: res.count ?? 0 }, 200);
  } catch (e: any) {
    return jsonErr(a.rid, "Uventet feil.", 500, {
      code: "SERVER_ERROR",
      detail: { message: safeStr(e?.message ?? e) },
    });
  }
}
