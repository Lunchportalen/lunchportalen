// app/api/kitchen/batch/reset/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { cutoffStatusForDate0805, isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
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

function resetAllowed(dateISO: string) {
  const status = cutoffStatusForDate0805(dateISO);
  if (status === "TODAY_OPEN") return { ok: true as const };
  if (status === "PAST") return { ok: false as const, code: "DATE_LOCKED_PAST", message: "Datoen er passert og kan ikke endres." };
  if (status === "FUTURE_OPEN") return { ok: false as const, code: "FUTURE_DATE", message: "Kan ikke resette fremtidig produksjon." };
  return { ok: false as const, code: "LOCKED_AFTER_0805", message: "Reset er låst etter kl. 08:05." };
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
  if (safeStr(scope?.role).toLowerCase() !== "superadmin") {
    return jsonErr(rid, "Reset er ikke tillatt for kjøkken.", 403, "FORBIDDEN_ROLE");
  }

  // confirm cookie-session
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");

  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(rid, "Service role mangler.", 500, { code: "CONFIG_ERROR", detail: { detail: safeStr(e?.message ?? e) } });
  }

  try {
    const body = await readJson(req);

    const dateRaw = safeStr(body?.date) || osloTodayISODate();
    const date = isIsoDate(dateRaw) ? dateRaw : "";
    const slot = normSlot(body?.slot);
    const location_id = safeStr(body?.location_id);

    if (!date) return jsonErr(rid, "Ugyldig dato.", 400, { code: "INVALID_DATE", detail: { date: dateRaw } });
    if (!location_id) return jsonErr(rid, "Mangler location_id.", 400, "MISSING_LOCATION");

    const allowed = resetAllowed(date);
    if (!allowed.ok) {
      return jsonErr(rid, allowed.message, 423, { code: allowed.code, detail: { date, cutoff: "08:05" } });
    }

    const userId = safeStr(auth?.user?.id) || safeStr(scope?.userId);
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("company_id, location_id, disabled_at, is_active")
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle();

    if (profErr || !prof) return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
    if ((prof as any).disabled_at || (prof as any).is_active === false) {
      return jsonErr(rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
    }

    const companyId = safeStr((prof as any).company_id);
    const profileLocationId = safeStr((prof as any).location_id);
    if (!companyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");
    if (profileLocationId && location_id !== profileLocationId) {
      return jsonErr(rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
    }

    const { data: locRow, error: locErr } = await admin
      .from("company_locations")
      .select("id, company_id")
      .eq("id", location_id)
      .maybeSingle();

    if (locErr || !locRow?.id || safeStr((locRow as any).company_id) !== companyId) {
      return jsonErr(rid, "Lokasjon tilhører ikke firmaet.", 403, "FORBIDDEN");
    }

    // delete is idempotent: ok selv om 0 rows
    const { error: delErr, count } = await admin
      .from("kitchen_batch")
      .delete({ count: "exact" })
      .eq("delivery_date", date)
      .eq("delivery_window", slot)
      .eq("company_location_id", location_id);

    if (delErr) {
      return jsonErr(rid, "Kunne ikke resette batch.", 500, { code: "DB_ERROR", detail: {
        message: delErr.message,
        code: (delErr as any).code ?? null,
      } });
    }

    // MUST audit (fail-closed)
    await auditWriteMust({
      rid,
      action: "KITCHEN_BATCH_RESET",
      entity_type: "kitchen_batch",
      entity_id: batchKey(date, slot, location_id),
      company_id: companyId,
      location_id,
      actor_user_id: userId,
      actor_email: scope.email ?? null,
      actor_role: scope.role ?? null,
      summary: "Batch reset",
      detail: { route: "/api/kitchen/batch/reset", date, slot, location_id, deleted_count: count ?? null },
    });

    return jsonOk(rid, { reset: { date, slot, location_id, deleted_count: count ?? 0 } }, 200);
  } catch (e: any) {
    return jsonErr(rid, String(e?.message ?? e), 500, { code: "UNHANDLED", detail: { at: "kitchen/batch/reset" } });
  }
}
