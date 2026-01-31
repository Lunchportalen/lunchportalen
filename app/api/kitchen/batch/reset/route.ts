// app/api/kitchen/batch/reset/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import { auditWriteMust } from "@/lib/audit/auditWrite";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normSlot(v: any) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}
function batchKey(date: string, slot: string, location_id: string) {
  return `${date}__${slot}__${location_id}`;
}

/**
 * POST /api/kitchen/batch/reset
 * Body:
 *  { date?: "YYYY-MM-DD", slot?: string, location_id: string }
 *
 * Effekt:
 *  Sletter batch-row (entall table: kitchen_batch) for key (date+slot+location)
 *  Best effort: sletter selv om row ikke finnes (idempotent)
 *
 * MUST audit (fail-closed)
 */
export async function POST(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "kitchen.batch.reset", ["kitchen", "superadmin"]);
  if (denyRole) return denyRole;

  // confirm cookie-session
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget.");

  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(500, rid, "CONFIG_ERROR", "Service role mangler.", { detail: safeStr(e?.message ?? e) });
  }

  try {
    const body = await readJson(req);

    const dateRaw = safeStr(body?.date) || osloTodayISODate();
    const date = isIsoDate(dateRaw) ? dateRaw : "";
    const slot = normSlot(body?.slot);
    const location_id = safeStr(body?.location_id);

    if (!date) return jsonErr(400, rid, "INVALID_DATE", "Ugyldig dato.", { date: dateRaw });
    if (!location_id) return jsonErr(400, rid, "MISSING_LOCATION", "Mangler location_id.");

    // delete is idempotent: ok selv om 0 rows
    const { error: delErr, count } = await admin
      .from("kitchen_batch")
      .delete({ count: "exact" })
      .eq("delivery_date", date)
      .eq("delivery_window", slot)
      .eq("company_location_id", location_id);

    if (delErr) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke resette batch.", {
        message: delErr.message,
        code: (delErr as any).code ?? null,
      });
    }

    // MUST audit (fail-closed)
    await auditWriteMust({
      rid,
      action: "KITCHEN_BATCH_RESET",
      entity_type: "kitchen_batch",
      entity_id: batchKey(date, slot, location_id),
      company_id: null,
      location_id,
      actor_user_id: safeStr(scope.userId) || auth.user.id,
      actor_email: scope.email ?? null,
      actor_role: scope.role ?? null,
      summary: "Batch reset",
      detail: { route: "/api/kitchen/batch/reset", date, slot, location_id, deleted_count: count ?? null },
    });

    return jsonOk({
      ok: true,
      rid,
      reset: { date, slot, location_id, deleted_count: count ?? 0 },
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", String(e?.message ?? e), { at: "kitchen/batch/reset" });
  }
}


