// app/api/kitchen/day/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import { fetchKitchenDayData } from "@/lib/kitchen/dayData";
import { isAfterCutoff0805 } from "@/lib/kitchen/cutoff";
import type { Role } from "@/lib/auth/role";
import { normalizeRoleDefaultEmployee } from "@/lib/auth/role";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  const rid = `kday_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // 1) Auth (cookie/session via supabaseServer)
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");

    // 2) Profile lookup (service role)
    const admin = supabaseAdmin();
    const { data: profile, error: pErr } = await (admin as any)
      .from("profiles")
      .select("role, disabled_at, is_active, company_id, location_id")
      .or(`id.eq.${auth.user.id},user_id.eq.${auth.user.id}`)
      .maybeSingle();

    if (pErr || !profile) return jsonErr(rid, "Forbudt.", 403, "FORBIDDEN");
    if ((profile as any).disabled_at || (profile as any).is_active === false) return jsonErr(rid, "Forbudt.", 403, "FORBIDDEN");

    // 3) Role gate
    const role = normalizeRoleDefaultEmployee((profile as any).role);
    if (role !== "kitchen" && role !== "superadmin") return jsonErr(rid, "Forbudt.", 403, "FORBIDDEN");

    // 4) Scope (company/location) - fail-closed
    const companyId = safeStr((profile as any).company_id);
    const locationId = safeStr((profile as any).location_id);
    if (!companyId || !locationId) {
      return jsonErr(rid, "Scope er ikke tilordnet.", 403, "SCOPE_NOT_ASSIGNED", {
        companyIdPresent: Boolean(companyId),
        locationIdPresent: Boolean(locationId),
      });
    }

    // 5) Params
    const url = new URL(req.url);
    const dateParam = safeStr(url.searchParams.get("date"));
    const slotParam = safeStr(url.searchParams.get("slot"));

    const dateISO = dateParam && isIsoDate(dateParam) ? dateParam : osloTodayISODate();

    // slot: optional filter; allow null to mean "all slots"
    const slot = slotParam ? slotParam : null;

    // 6) Cutoff (08:05 Oslo -> computed helper returns UTC cutoff instant + after boolean)
    const cutoff = isAfterCutoff0805(dateISO);

    // 7) Fetch grouped kitchen data
    const { groups } = await fetchKitchenDayData({
      admin,
      dateISO,
      companyId,
      locationId,
      slot,
      rid,
      cutoffAtUTCISO: cutoff.cutoffAt,
      afterCutoff: cutoff.after,
    });

    return jsonOk(rid, {
      ok: true,
      rid,
      date: dateISO,
      groups,
    });
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke hente kjøkkenliste.", 500, {
      code: "KITCHEN_DAY_FAILED",
      detail: String(e?.message ?? e),
    });
  }
}
