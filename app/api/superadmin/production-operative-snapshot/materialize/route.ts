export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson, denyResponse } from "@/lib/http/routeGuard";
import { materializeProductionOperativeSnapshot } from "@/lib/server/kitchen/materializeProductionOperativeSnapshot";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * POST — materialiser canonical operative produksjons-snapshot for ett firma og én dato.
 * Body: { "date": "YYYY-MM-DD", "companyId": "uuid" }
 */
export async function POST(req: NextRequest) {
  const s = await scopeOr401(req);
  if (!s.ok) return denyResponse(s);

  const deny = requireRoleOr403(s.ctx, "api.superadmin.production_operative_snapshot.materialize.POST", ["superadmin"]);
  if (deny) return deny;

  const rid = s.ctx.rid;
  const body = await readJson(req);
  const dateISO = safeStr(body?.date);
  const companyId = safeStr(body?.companyId);
  if (!dateISO || !companyId) {
    return jsonErr(rid, "Mangler date eller companyId.", 400, "BAD_REQUEST", { detail: { date: dateISO, companyId } });
  }

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: unknown) {
    return jsonErr(rid, "Service role mangler.", 500, "CONFIG_ERROR", {
      detail: safeStr(e instanceof Error ? e.message : e),
    });
  }

  const result = await materializeProductionOperativeSnapshot(admin as any, { dateISO, companyId });
  if (result.ok === false) {
    return jsonErr(rid, result.message, 400, "MATERIALIZE_FAILED");
  }

  return jsonOk(rid, result, 200);
}
