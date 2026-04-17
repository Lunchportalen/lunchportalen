// app/api/driver/stops/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

import { osloTodayISODate, isIsoDate } from "@/lib/date/oslo";
import { loadProfileByUserId } from "@/lib/db/profileLookup";
import { loadOperativeKitchenOrders, normKitchenSlot } from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import { fetchProductionOperativeSnapshotAllowlist } from "@/lib/server/kitchen/fetchProductionOperativeSnapshotAllowlist";

/* =========================================================
   Helpers
========================================================= */
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function normRole(v: unknown) {
  const r = safeStr(v).toLowerCase();
  return r ? r : null;
}
function errInfo(e: any) {
  return {
    code: (e as any)?.code ?? null,
    message: safeStr((e as any)?.message ?? e) || null,
    details: (e as any)?.details ?? null,
    hint: (e as any)?.hint ?? null,
  };
}
function dbMessage(where: string, e: any) {
  const info = errInfo(e);
  const code = info.code ? `code ${info.code}` : "code n/a";
  const msg = info.message || "Ukjent databasefeil";
  return `DB-feil i ${where} (${code}): ${msg}`;
}

// TS-safe guard for scopeOr401 union
type ScopeRes = Awaited<ReturnType<typeof scopeOr401>>;
type ScopeFail = Extract<ScopeRes, { ok: false }>;
function isScopeFail(x: ScopeRes): x is ScopeFail {
  return x.ok === false;
}

/* =========================================================
   Types
========================================================= */
type Stop = {
  key: string; // date|slot|companyId|locationId
  date: string; // YYYY-MM-DD
  slot: string;

  companyId: string;
  companyName: string | null;

  locationId: string;
  locationName: string | null;

  addressLine: string | null;
  deliveryWhere: string | null;
  deliveryWhenNote: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  deliveryWindowFrom: string | null;
  deliveryWindowTo: string | null;

  orderCount: number;

  delivered: boolean;
  deliveredAt: string | null;
  deliveredBy: string | null;
};

type OrderRow = {
  id: string;
  date: string;
  slot: string | null;
  status: string | null;
  company_id: string | null;
  location_id: string | null;
};

/* =========================================================
   GET /api/driver/stops?date=YYYY-MM-DD
   - Always returns: { ok: true, rid, data: { date, stops: Stop[] } } (via jsonOk)
   - Stops is ALWAYS an array (empty on no orders)
========================================================= */
export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // 401
  const a = await scopeOr401(req);
  if (isScopeFail(a)) return a.res;

  // ctx + rid (failsafe)
  const ctxIn = a.ctx as any;
  const ctx = { ...ctxIn, rid: safeStr(ctxIn?.rid) || makeRid() };

  // 403
  const denied = requireRoleOr403(ctx, ["driver", "superadmin"]);
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const dateQ = safeStr(url.searchParams.get("date"));
    const today = osloTodayISODate();
    const date = dateQ || today;

    const isoOk =
      typeof isIsoDate === "function"
        ? isIsoDate(date)
        : /^\d{4}-\d{2}-\d{2}$/.test(date);

    if (!isoOk) {
      return jsonErr(ctx.rid, "Invalid date. Use YYYY-MM-DD.", 400, { code: "bad_request", detail: { date } });
    }

    // ✅ systemrolle → service role (RLS-bypass)
    const role = normRole(ctx?.scope?.role);
    const usingServiceRole = role === "driver" || role === "superadmin";

    if (role === "driver" && date !== today) {
      return jsonErr(ctx.rid, "Sjåfør kan kun se dagens stopp.", 403, { code: "FORBIDDEN_DATE", detail: { date, today } });
    }

    // NOTE: supabaseAdmin() antas å returnere en klient direkte (ikke Promise)
    const sb = usingServiceRole ? supabaseAdmin() : await supabaseServer();

    // 🔒 Tenant scope (profiles.company_id er fasit)
    const userId = safeStr(ctx?.scope?.userId);
    if (!userId) return jsonErr(ctx.rid, "Mangler bruker.", 403, "FORBIDDEN");

    const { data: prof, error: profErr } = await loadProfileByUserId(
      supabaseAdmin() as any,
      userId,
      "company_id, location_id, disabled_at, is_active"
    );

    if (profErr || !prof) {
      return jsonErr(ctx.rid, "Mangler profil.", 403, { code: "FORBIDDEN", detail: { message: profErr?.message ?? null } });
    }
    if ((prof as any).disabled_at || (prof as any).is_active === false) {
      return jsonErr(ctx.rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
    }

    const companyId = safeStr((prof as any).company_id);
    const locationId = safeStr((prof as any).location_id);
    if (!companyId) return jsonErr(ctx.rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");

    const snap = await fetchProductionOperativeSnapshotAllowlist(sb as any, { dateISO: date, companyId });
    const productionFreezeAllowlist = snap.found ? snap.orderIds : undefined;

    const loaded = await loadOperativeKitchenOrders({
      admin: sb as any,
      dateISO: date,
      tenant: { companyId, locationId: locationId || null },
      productionFreezeAllowlist,
    });
    if (loaded.ok === false) {
      return jsonErr(ctx.rid, "Failed to load orders for driver stops.", 500, { code: "db_error", detail: {
        where: "operative_orders",
        role,
        usingServiceRole,
        message: loaded.dbError.message,
        code: loaded.dbError.code,
      } });
    }

    const rows: OrderRow[] = loaded.operative.map((r) => ({
      id: String(r.id),
      date,
      slot: normKitchenSlot(r.slot),
      status: String(r.status ?? ""),
      company_id: String(r.company_id),
      location_id: String(r.location_id),
    }));

    // ✅ Tom dag er OK (ALLTID stops: [])
    if (rows.length === 0) {
      return jsonOk(ctx.rid, { date, stops: [] as Stop[] });
    }

    // 2) Hent company/location metadata via IN
    const companyIds = Array.from(
      new Set(rows.map((o) => safeStr(o.company_id)).filter(Boolean))
    );
    const locationIds = Array.from(
      new Set(rows.map((o) => safeStr(o.location_id)).filter(Boolean))
    );

    const [compRes, locRes] = await Promise.all([
      companyIds.length
        ? sb.from("companies").select("id, name").in("id", companyIds)
        : Promise.resolve({ data: [] as any[], error: null as any }),
      locationIds.length
        ? sb
            .from("company_locations")
            .select("*")
            .in("id", locationIds)
        : Promise.resolve({ data: [] as any[], error: null as any }),
    ]);

    const { data: companies, error: compErr } = compRes as any;
    const { data: locs, error: locErr } = locRes as any;

    if (compErr) {
      return jsonErr(ctx.rid, "Failed to load companies.", 500, { code: "db_error", detail: {
        where: "companies.select",
        role,
        usingServiceRole,
        message: dbMessage("companies.select", compErr),
        ...errInfo(compErr),
      } });
    }
    if (locErr) {
      return jsonErr(ctx.rid, "Failed to load company locations.", 500, { code: "db_error", detail: {
        where: "company_locations.select",
        role,
        usingServiceRole,
        message: dbMessage("company_locations.select", locErr),
        ...errInfo(locErr),
      } });
    }

    const companyMap = new Map<string, { id: string; name: string | null }>();
    for (const c of (companies ?? []) as any[]) {
      const id = safeStr(c?.id);
      if (!id) continue;
      companyMap.set(id, { id, name: c?.name ? safeStr(c.name) : null });
    }

    const locMap = new Map<string, Record<string, any>>();

    for (const l of (locs ?? []) as any[]) {
      const id = safeStr(l?.id);
      if (!id) continue;
      locMap.set(id, {
        ...(l as any),
        id,
        name: l?.name ? safeStr(l.name) : null,
        address_line1: l?.address_line1 ? safeStr(l.address_line1) : null,
        address_line2: l?.address_line2 ? safeStr(l.address_line2) : null,
        postal_code: l?.postal_code ? safeStr(l.postal_code) : null,
        city: l?.city ? safeStr(l.city) : null,
      });
    }

    // 3) Delivery confirmations
    let confQ = sb
      .from("delivery_confirmations")
      .select("delivery_date, slot, company_id, location_id, confirmed_at, confirmed_by")
      .eq("delivery_date", date)
      .eq("company_id", companyId);

    if (locationId) confQ = confQ.eq("location_id", locationId);

    const { data: confs, error: confErr } = await confQ;

    if (confErr) {
      return jsonErr(ctx.rid, "Failed to load delivery confirmations.", 500, { code: "db_error", detail: {
        where: "delivery_confirmations.select",
        role,
        usingServiceRole,
        message: dbMessage("delivery_confirmations.select", confErr),
        ...errInfo(confErr),
      } });
    }

    const confKey = new Map<string, { at: string | null; by: string | null }>();
    for (const c of (confs ?? []) as any[]) {
      const slot = normKitchenSlot(c?.slot);
      const companyId = safeStr(c?.company_id);
      const locationId = safeStr(c?.location_id);
      if (!slot || !companyId || !locationId) continue;

      const k = `${date}|${slot}|${companyId}|${locationId}`;
      const at = safeStr(c?.confirmed_at) || null;
      const by = safeStr(c?.confirmed_by) || null;
      confKey.set(k, { at, by });
    }

    // 4) Aggregate orders -> stops
    const acc = new Map<string, Stop>();

    for (const o of rows) {
      const slot = normKitchenSlot(o.slot);
      const companyId = safeStr(o.company_id);
      const locationId = safeStr(o.location_id);

      // Uten disse kan vi ikke lage nøkkel/stopp på en stabil måte
      if (!companyId || !locationId) continue;

      const comp = companyMap.get(companyId) ?? null;
      const loc = locMap.get(locationId) ?? null;

      const companyName = comp?.name ?? null;
      const locationName = loc?.name ?? null;

      const a1 =
        safeStr((loc as any)?.address_line1) ||
        safeStr((loc as any)?.address1) ||
        safeStr((loc as any)?.address) ||
        safeStr((loc as any)?.street_address) ||
        "";
      const a2 =
        safeStr((loc as any)?.address_line2) ||
        safeStr((loc as any)?.address2) ||
        "";
      const pc =
        safeStr((loc as any)?.postal_code) ||
        safeStr((loc as any)?.postcode) ||
        safeStr((loc as any)?.zip) ||
        safeStr((loc as any)?.postnummer) ||
        "";
      const city =
        safeStr((loc as any)?.city) ||
        safeStr((loc as any)?.town) ||
        safeStr((loc as any)?.poststed) ||
        "";

      const deliveryJson = (loc as any)?.delivery_json ?? null;
      const deliveryWhere =
        safeStr((loc as any)?.delivery_where) ||
        safeStr((loc as any)?.delivery_point) ||
        safeStr((loc as any)?.delivery_location) ||
        safeStr(deliveryJson?.where) ||
        null;
      const deliveryWhenNote =
        safeStr((loc as any)?.delivery_when_note) ||
        safeStr((loc as any)?.delivery_instructions) ||
        safeStr((loc as any)?.delivery_note) ||
        safeStr(deliveryJson?.when_note) ||
        null;
      const deliveryContactName =
        safeStr((loc as any)?.delivery_contact_name) ||
        safeStr((loc as any)?.contact_name) ||
        safeStr(deliveryJson?.contact_name) ||
        null;
      const deliveryContactPhone =
        safeStr((loc as any)?.delivery_contact_phone) ||
        safeStr((loc as any)?.contact_phone) ||
        safeStr(deliveryJson?.contact_phone) ||
        null;
      const deliveryWindowFrom =
        safeStr((loc as any)?.delivery_window_from) ||
        safeStr((loc as any)?.window_from) ||
        safeStr(deliveryJson?.window_from) ||
        null;
      const deliveryWindowTo =
        safeStr((loc as any)?.delivery_window_to) ||
        safeStr((loc as any)?.window_to) ||
        safeStr(deliveryJson?.window_to) ||
        null;

      const addressLine =
        safeStr([a1, a2, [pc, city].filter(Boolean).join(" ")].filter(Boolean).join(", ")) ||
        null;

      const key = `${date}|${slot}|${companyId}|${locationId}`;

      const ex = acc.get(key);
      if (ex) {
        ex.orderCount += 1;
        continue;
      }

      const conf = confKey.get(key);

      acc.set(key, {
        key,
        date,
        slot,
        companyId,
        companyName,
        locationId,
        locationName,
        addressLine,
        deliveryWhere,
        deliveryWhenNote,
        deliveryContactName,
        deliveryContactPhone,
        deliveryWindowFrom,
        deliveryWindowTo,
        orderCount: 1,
        delivered: Boolean(conf && (conf.at || conf.by)),
        deliveredAt: conf?.at ?? null,
        deliveredBy: conf?.by ?? null,
      });
    }

    let stops: Stop[] = Array.from(acc.values()).sort((x, y) => {
      // slot først
      if (x.slot !== y.slot) return x.slot.localeCompare(y.slot, "nb");
      // så lokasjon
      if ((x.locationName ?? "") !== (y.locationName ?? "")) {
        return (x.locationName ?? "").localeCompare(y.locationName ?? "", "nb");
      }
      // så firma
      return (x.companyName ?? "").localeCompare(y.companyName ?? "", "nb");
    });

    if (role === "driver") {
      stops = stops.map((s) => ({ ...s, deliveredBy: null }));
    }

    // ✅ ALWAYS array
    return jsonOk(ctx.rid, { date, stops });
  } catch (e: any) {
    return jsonErr(ctx.rid, "Unexpected error in driver stops route.", 500, { code: "internal_error", detail: {
      where: "catch-all",
      ...errInfo(e),
    } });
  }
}

