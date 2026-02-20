// app/api/superadmin/enterprise/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { logIncident } from "@/lib/observability/incident";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function toInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : fallback;
}

function isMissingSchema(err: any) {
  const code = safeStr(err?.code).toUpperCase();
  const message = safeStr(err?.message).toLowerCase();
  const details = safeStr(err?.details).toLowerCase();
  const hint = safeStr(err?.hint).toLowerCase();

  if (code === "42P01" || code === "42703" || code === "3F000") return true;
  if (message.includes("does not exist") && (message.includes("relation") || message.includes("column"))) return true;
  if (details.includes("does not exist") || hint.includes("does not exist")) return true;
  return false;
}

export async function GET(req: NextRequest): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return s.res ?? s.response;

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.enterprise.GET", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const page = toInt(url.searchParams.get("page"), 1);
  const limit = Math.min(100, Math.max(1, toInt(url.searchParams.get("limit"), 25)));
  const offset = (page - 1) * limit;

  try {
    const admin = supabaseAdmin();
    const res = await admin
      .from("enterprise_groups")
      .select("id,name,orgnr,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (res.error) {
      if (isMissingSchema(res.error)) {
        await logIncident({
          scope: "enterprise",
          severity: "warn",
          rid: a.rid,
          message: "Enterprise schema mangler; returnerer tom liste.",
          meta: { code: res.error.code, message: res.error.message },
        });
        return jsonOk(a.rid, { items: [], count: 0 });
      }
      return jsonErr(a.rid, "Kunne ikke hente konsern.", 500, { code: "DB_ERROR", detail: res.error });
    }

    const items = Array.isArray(res.data) ? res.data : [];
    const count = Number(res.count ?? 0);
    if (items.length === 0) {
      await logIncident({
        scope: "enterprise",
        severity: "info",
        rid: a.rid,
        message: "No enterprise groups found (valid empty state)",
      });
    }
    return jsonOk(a.rid, {
      items: items.map((r: any) => ({
        id: safeStr(r?.id),
        name: safeStr(r?.name),
        orgnr: safeStr(r?.orgnr) || null,
        created_at: r?.created_at ?? null,
      })),
      count,
    });
  } catch (e: any) {
    return jsonErr(a.rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: String(e?.message ?? e) });
  }
}
