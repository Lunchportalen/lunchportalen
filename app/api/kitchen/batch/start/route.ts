// app/api/kitchen/batch/start/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { cutoffStatusForDate0805, osloTodayISODate } from "@/lib/date/oslo";
import { auditWriteMust } from "@/lib/audit/auditWrite";
import { loadProfileByUserId } from "@/lib/db/profileLookup";

function isIsoDate(v: any) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
}
function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normSlot(v: any) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}
function nowIso() {
  return new Date().toISOString();
}
function batchKey(date: string, slot: string, location_id: string) {
  return `${date}__${slot}__${location_id}`;
}
function cutoffAllowed(dateISO: string) {
  const status = cutoffStatusForDate0805(dateISO);
  if (status === "TODAY_LOCKED") return { ok: true as const };
  if (status === "PAST") return { ok: false as const, code: "DATE_LOCKED_PAST", message: "Datoen er passert og kan ikke endres." };
  return { ok: false as const, code: "LOCKED_BEFORE_0805", message: "Batch kan kun startes etter kl. 08:05 i dag." };
}

export async function POST(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "kitchen.batch.start", ["kitchen"]);
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
    const body = await readJson(req);

    const dateRaw = safeStr(body?.date) || osloTodayISODate();
    const date = isIsoDate(dateRaw) ? dateRaw : "";
    const slot = normSlot(body?.slot);
    const requestedLocationId = safeStr(body?.location_id);

    if (!date) return jsonErr(rid, "Ugyldig dato.", 400, { code: "INVALID_DATE", detail: { date: dateRaw } });

    const today = osloTodayISODate();
    if (date !== today) {
      return jsonErr(rid, "Batch kan kun startes for dagens dato.", 403, { code: "FORBIDDEN_DATE", detail: { date, today } });
    }

    const cutoff = cutoffAllowed(date);
    if (!cutoff.ok) {
      return jsonErr(rid, cutoff.message, 412, { code: cutoff.code, detail: { date, cutoff: "08:05" } });
    }

    const role = safeStr(scope?.role).toLowerCase();
    const userId = safeStr(auth?.user?.id) || safeStr(scope?.userId);
    const { data: prof, error: profErr } = await loadProfileByUserId(admin as any, userId, "company_id, location_id, disabled_at, is_active");

    if (profErr) {
      return jsonErr(rid, "Kunne ikke hente profil.", 500, { code: "DB_ERROR", detail: { message: profErr.message, code: (profErr as any).code ?? null } });
    }

    if (prof && ((prof as any).disabled_at || (prof as any).is_active === false)) {
      return jsonErr(rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
    }

    let companyId = "";
    let locationId = "";

    if (role === "kitchen") {
      if (!prof) return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
      companyId = safeStr((prof as any).company_id);
      const profileLocationId = safeStr((prof as any).location_id);
      if (!companyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");
      if (profileLocationId && requestedLocationId && requestedLocationId !== profileLocationId) {
        return jsonErr(rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
      }
      locationId = profileLocationId || requestedLocationId;
      if (!locationId) return jsonErr(rid, "Mangler location_id.", 400, "MISSING_LOCATION");

      const { data: locRow, error: locErr } = await admin
        .from("company_locations")
        .select("id, company_id")
        .eq("id", locationId)
        .maybeSingle();

      if (locErr || !locRow?.id || safeStr((locRow as any).company_id) !== companyId) {
        return jsonErr(rid, "Lokasjon tilhører ikke firmaet.", 403, "FORBIDDEN");
      }
    }

    const { data: agreement, error: agrErr } = await admin
      .from("company_current_agreement")
      .select("id, company_id, status")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (agrErr) {
      return jsonErr(rid, "Kunne ikke hente aktiv avtale.", 500, { code: "AGREEMENT_LOOKUP_FAILED", detail: {
        message: agrErr.message,
        code: (agrErr as any).code ?? null,
      } });
    }
    if (!agreement?.id) {
      return jsonErr(rid, "Ingen aktiv avtale for firma.", 409, { code: "NO_ACTIVE_AGREEMENT", detail: { company_id: companyId } });
    }

    const { data: existing, error: exErr } = await admin
      .from("kitchen_batch")
      .select("status,packed_at,delivered_at")
      .eq("delivery_date", date)
      .eq("delivery_window", slot)
      .eq("company_location_id", locationId)
      .maybeSingle();

    if (exErr) {
      return jsonErr(rid, "Kunne ikke lese eksisterende batch.", 500, { code: "DB_ERROR", detail: {
        message: exErr.message,
        code: (exErr as any).code ?? null,
      } });
    }

    if (existing) {
      return jsonErr(rid, "Batch finnes allerede.", 409, { code: "BATCH_EXISTS", detail: {
        date,
        slot,
        location_id: locationId,
        status: safeStr((existing as any).status).toUpperCase() || null,
      } });
    }

    const ordersQ = admin
      .from("orders")
      .select("id")
      .eq("date", date)
      .eq("company_id", companyId)
      .eq("location_id", locationId)
      .eq("slot", slot)
      .in("status", ["ACTIVE", "active", "QUEUED", "PACKED", "DELIVERED"])
      .limit(1);

    const { data: ordRows, error: oErr } = await ordersQ;
    if (oErr) {
      return jsonErr(rid, "Kunne ikke hente ordregrunnlag.", 500, { code: "ORDERS_LOOKUP_FAILED", detail: {
        message: oErr.message,
        code: (oErr as any).code ?? null,
      } });
    }
    if (!ordRows || ordRows.length === 0) {
      return jsonErr(rid, "Ingen ordre å starte batch for.", 422, { code: "NO_ORDERS", detail: { date, slot, location_id: locationId } });
    }

    const ts = nowIso();
    const payload = {
      delivery_date: date,
      delivery_window: slot,
      company_location_id: locationId,
      status: "PACKED",
      packed_at: ts,
      delivered_at: null,
    };

    await auditWriteMust({
      rid,
      action: "kitchen_batch_start",
      entity_type: "kitchen_batch",
      entity_id: batchKey(date, slot, locationId),
      company_id: companyId,
      location_id: locationId,
      actor_user_id: userId,
      actor_email: scope?.email ?? null,
      actor_role: scope?.role ?? null,
      summary: "Batch start (PACKED)",
      detail: { date, slot, location_id: locationId },
    });

    const { data: saved, error: insErr } = await admin
      .from("kitchen_batch")
      .insert(payload)
      .select("id,delivery_date,delivery_window,company_location_id,status,packed_at,delivered_at")
      .maybeSingle();

    if (insErr) {
      const code = String((insErr as any)?.code ?? "");
      if (code === "23505") {
        return jsonErr(rid, "Batch finnes allerede.", 409, { code: "BATCH_EXISTS", detail: { date, slot, location_id: locationId } });
      }
      return jsonErr(rid, "Kunne ikke starte batch.", 500, { code: "DB_ERROR", detail: {
        message: insErr?.message ?? null,
        code,
      } });
    }
    if (!saved) return jsonErr(rid, "Kunne ikke starte batch.", 500, "DB_ERROR");

    return jsonOk(rid, {
        batch: {
          id: (saved as any).id ?? null,
          delivery_date: saved.delivery_date,
          delivery_window: saved.delivery_window,
          company_location_id: saved.company_location_id,
          status: safeStr(saved.status).toUpperCase(),
          packed_at: saved.packed_at ?? null,
          delivered_at: saved.delivered_at ?? null,
        },
      }, 200);
  } catch (e: any) {
    return jsonErr(rid, safeStr(e?.message ?? e), 500, { code: "UNHANDLED", detail: { at: "kitchen/batch/start" } });
  }
}



