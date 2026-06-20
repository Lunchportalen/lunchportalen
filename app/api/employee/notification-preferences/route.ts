export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { menuWeekOpeningEnabledFromPref } from "@/lib/notifications/menuWeekOpeningCore";
import { adminDb } from "@/lib/supabase/adminAny";

export async function GET(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const deny = requireRoleOr403(gate.ctx, "employee.notification-preferences", ["employee", "company_admin"]);
  if (deny) return deny;

  const userId = String(gate.ctx.scope.userId ?? "").trim();
  if (!userId) {
    return jsonErr(gate.ctx.rid, "Mangler bruker.", 403, "FORBIDDEN");
  }

  const admin = await adminDb();
  const { data, error } = await admin
    .from("employee_notification_preferences")
    .select("menu_week_opening_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return jsonErr(gate.ctx.rid, "Kunne ikke hente varselinnstillinger.", 500, "DB_ERROR");
  }

  const enabled = menuWeekOpeningEnabledFromPref(
    (data as { menu_week_opening_enabled?: boolean } | null)?.menu_week_opening_enabled,
  );

  return jsonOk(gate.ctx.rid, { menuWeekOpeningEnabled: enabled });
}

export async function PATCH(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const deny = requireRoleOr403(gate.ctx, "employee.notification-preferences", ["employee", "company_admin"]);
  if (deny) return deny;

  const userId = String(gate.ctx.scope.userId ?? "").trim();
  if (!userId) {
    return jsonErr(gate.ctx.rid, "Mangler bruker.", 403, "FORBIDDEN");
  }

  const body = await readJson(req);
  const enabledRaw = body?.menuWeekOpeningEnabled ?? body?.enabled;
  if (typeof enabledRaw !== "boolean") {
    return jsonErr(gate.ctx.rid, "Ugyldig forespørsel.", 422, "INVALID_BODY");
  }

  const admin = await adminDb();
  const { error } = await admin.from("employee_notification_preferences").upsert(
    {
      user_id: userId,
      menu_week_opening_enabled: enabledRaw,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return jsonErr(gate.ctx.rid, "Kunne ikke lagre varselinnstillinger.", 500, "DB_ERROR");
  }

  return jsonOk(gate.ctx.rid, { menuWeekOpeningEnabled: enabledRaw });
}
