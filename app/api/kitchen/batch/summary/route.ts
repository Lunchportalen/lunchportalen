// app/api/kitchen/batch/summary/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { isIsoDate, osloNowISO, osloTodayISODate } from "@/lib/date/oslo";
import { buildBatchSummary } from "@/lib/kitchen/batchSummary";
import { loadProfileByUserId } from "@/lib/db/profileLookup";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "kitchen.batch.summary", ["kitchen", "superadmin"]);
  if (denyRole) return denyRole;

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
    const url = new URL(req.url);
    const dateQ = safeStr(url.searchParams.get("date")) || osloTodayISODate();
    const date = isIsoDate(dateQ) ? dateQ : "";
    const slotQ = safeStr(url.searchParams.get("slot"));
    const slot = slotQ ? slotQ : null;
    const locationId = safeStr(url.searchParams.get("location_id"));

    if (!date) return jsonErr(rid, "Ugyldig dato.", 400, { code: "INVALID_DATE", detail: { date: dateQ } });
    if (!locationId) return jsonErr(rid, "Mangler location_id.", 400, "MISSING_LOCATION");

    const role = safeStr(scope?.role).toLowerCase();
    const userId = safeStr(auth?.user?.id) || safeStr(scope?.userId);

    const { data: prof, error: profErr } = await loadProfileByUserId(admin as any, userId, "company_id, location_id, disabled_at, is_active");

    if (profErr) {
      return jsonErr(rid, "Kunne ikke hente profil.", 500, { code: "DB_ERROR", detail: { message: profErr.message, code: (profErr as any).code ?? null } });
    }
    if (prof && ((prof as any).disabled_at || (prof as any).is_active === false)) {
      return jsonErr(rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
    }

    const profileCompanyId = safeStr((prof as any)?.company_id);
    const profileLocationId = safeStr((prof as any)?.location_id);

    if (role === "kitchen") {
      if (!prof) return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
      if (!profileCompanyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");
      if (date !== osloTodayISODate()) {
        return jsonErr(rid, "Kjøkken kan kun se dagens oppsummering.", 403, { code: "FORBIDDEN_DATE", detail: {
          date,
          today: osloTodayISODate(),
        } });
      }
      if (profileLocationId && locationId !== profileLocationId) {
        return jsonErr(rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
      }
    }

    const summary = await buildBatchSummary({ admin, dateISO: date, locationId, slot });
    if (!summary.ok) {
      const err = summary as { status: number; code: string; message: string; detail?: any };
      if (err.code === "NOT_FOUND" && role === "kitchen" && profileCompanyId) {
        return jsonErr(rid, "Lokasjon tilhører ikke firmaet.", 403, "FORBIDDEN");
      }
      return jsonErr(rid, err.message, err.status ?? 400, err.code);
    }

    if (role === "kitchen" && profileCompanyId && summary.data.company_id !== profileCompanyId) {
      return jsonErr(rid, "Lokasjon tilhører ikke firmaet.", 403, "FORBIDDEN");
    }

    return jsonOk(rid, {
        ...summary.data,
        generated_at: osloNowISO(),
      }, 200);
  } catch (e: any) {
    return jsonErr(rid, String(e?.message ?? e), 500, { code: "UNHANDLED", detail: { at: "kitchen/batch/summary" } });
  }
}



