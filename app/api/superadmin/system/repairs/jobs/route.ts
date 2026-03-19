export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.system.repairs.jobs.GET", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
  const requested = url.searchParams.get("limit") ?? url.searchParams.get("pageSize") ?? url.searchParams.get("page_size");
  const limit = Math.min(100, Math.max(1, toInt(requested, 25)));
  const offset = (page - 1) * limit;

  try {
    const admin = supabaseAdmin();
    const res = await admin
      .from("repair_jobs")
      .select("id,job_type,payload,state,attempts,next_run_at,last_error,created_at,updated_at,rid", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (res.error) {
      if (isMissingRelation(res.error) || isMissingColumn(res.error)) {
        return jsonOk(ctx.rid, { items: [], total: 0 }, 200);
      }
      return jsonErr(ctx.rid, "Kunne ikke hente reparasjonskø.", 500, {
        code: "DB_ERROR",
        detail: res.error,
      });
    }

    return jsonOk(ctx.rid, { items: res.data ?? [], total: res.count ?? 0 }, 200);
  } catch (e: any) {
    return jsonErr(ctx.rid, "Uventet feil.", 500, {
      code: "SERVER_ERROR",
      detail: { message: safeStr(e?.message ?? e) },
    });
  }
}
