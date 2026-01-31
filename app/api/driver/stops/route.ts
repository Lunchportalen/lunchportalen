// app/api/driver/stops/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonOk, jsonErr, rid as makeRid } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";


import { osloTodayISODate, isIsoDate } from "@/lib/date/oslo";

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
    const date = safeStr(url.searchParams.get("date")) || osloTodayISODate();

    const isoOk =
      typeof isIsoDate === "function"
        ? isIsoDate(date)
        : /^\d{4}-\d{2}-\d{2}$/.test(date);

    if (!isoOk) {
      return jsonErr(400, ctx, "bad_request", "Invalid date. Use YYYY-MM-DD.", { date });
    }

    // ✅ systemrolle → service role (RLS-bypass)
    const role = normRole(ctx?.scope?.role);
    const usingServiceRole = role === "driver" || role === "superadmin";

    // NOTE: supabaseAdmin() antas å returnere en klient direkte (ikke Promise)
    const sb = usingServiceRole ? supabaseAdmin() : await supabaseServer();

    // ✅ Brutal sanity: kan vi lese orders i det hele tatt?
    const { error: pingErr } = await sb.from("orders").select("id").limit(1);
    if (pingErr) {
      return jsonErr(500, ctx, "db_error", "Service role/DB read failed at orders ping.", {
        where: "orders.ping",
        role,
        usingServiceRole,
        message: dbMessage("orders.ping", pingErr),
        ...errInfo(pingErr),
      });
    }

    // 1) Orders (uten embed for å unngå FK/relasjon-feil)
    const { data: orders, error: ordersErr } = await sb
      .from("orders")
      .select("id, date, slot, status, company_id, location_id")
      .eq("date", date)
      .neq("status", "canceled");

    if (ordersErr) {
      return jsonErr(500, ctx, "db_error", "Failed to load orders for driver stops.", {
        where: "orders.select",
        role,
        usingServiceRole,
        message: dbMessage("orders.select", ordersErr),
        ...errInfo(ordersErr),
      });
    }

    const rows: OrderRow[] = (Array.isArray(orders) ? orders : []) as any[];

    // ✅ Tom dag er OK (ALLTID stops: [])
    if (rows.length === 0) {
      return jsonOk(ctx, { date, stops: [] as Stop[] });
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
            .select("id, name, address_line1, address_line2, postal_code, city")
            .in("id", locationIds)
        : Promise.resolve({ data: [] as any[], error: null as any }),
    ]);

    const { data: companies, error: compErr } = compRes as any;
    const { data: locs, error: locErr } = locRes as any;

    if (compErr) {
      return jsonErr(500, ctx, "db_error", "Failed to load companies.", {
        where: "companies.select",
        role,
        usingServiceRole,
        message: dbMessage("companies.select", compErr),
        ...errInfo(compErr),
      });
    }
    if (locErr) {
      return jsonErr(500, ctx, "db_error", "Failed to load company locations.", {
        where: "company_locations.select",
        role,
        usingServiceRole,
        message: dbMessage("company_locations.select", locErr),
        ...errInfo(locErr),
      });
    }

    const companyMap = new Map<string, { id: string; name: string | null }>();
    for (const c of (companies ?? []) as any[]) {
      const id = safeStr(c?.id);
      if (!id) continue;
      companyMap.set(id, { id, name: c?.name ? safeStr(c.name) : null });
    }

    const locMap = new Map<
      string,
      {
        id: string;
        name: string | null;
        address_line1?: string | null;
        address_line2?: string | null;
        postal_code?: string | null;
        city?: string | null;
      }
    >();

    for (const l of (locs ?? []) as any[]) {
      const id = safeStr(l?.id);
      if (!id) continue;
      locMap.set(id, {
        id,
        name: l?.name ? safeStr(l.name) : null,
        address_line1: l?.address_line1 ? safeStr(l.address_line1) : null,
        address_line2: l?.address_line2 ? safeStr(l.address_line2) : null,
        postal_code: l?.postal_code ? safeStr(l.postal_code) : null,
        city: l?.city ? safeStr(l.city) : null,
      });
    }

    // 3) Delivery confirmations
    const { data: confs, error: confErr } = await sb
      .from("delivery_confirmations")
      .select("delivery_date, slot, company_id, location_id, confirmed_at, confirmed_by")
      .eq("delivery_date", date);

    if (confErr) {
      return jsonErr(500, ctx, "db_error", "Failed to load delivery confirmations.", {
        where: "delivery_confirmations.select",
        role,
        usingServiceRole,
        message: dbMessage("delivery_confirmations.select", confErr),
        ...errInfo(confErr),
      });
    }

    const confKey = new Map<string, { at: string | null; by: string | null }>();
    for (const c of (confs ?? []) as any[]) {
      const slot = safeStr(c?.slot);
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
      const slot = safeStr(o.slot) || "—";
      const companyId = safeStr(o.company_id);
      const locationId = safeStr(o.location_id);

      // Uten disse kan vi ikke lage nøkkel/stopp på en stabil måte
      if (!companyId || !locationId) continue;

      const comp = companyMap.get(companyId) ?? null;
      const loc = locMap.get(locationId) ?? null;

      const companyName = comp?.name ?? null;
      const locationName = loc?.name ?? null;

      const a1 = loc?.address_line1 ? safeStr(loc.address_line1) : "";
      const a2 = loc?.address_line2 ? safeStr(loc.address_line2) : "";
      const pc = loc?.postal_code ? safeStr(loc.postal_code) : "";
      const city = loc?.city ? safeStr(loc.city) : "";

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
        orderCount: 1,
        delivered: Boolean(conf && (conf.at || conf.by)),
        deliveredAt: conf?.at ?? null,
        deliveredBy: conf?.by ?? null,
      });
    }

    const stops: Stop[] = Array.from(acc.values()).sort((x, y) => {
      // slot først
      if (x.slot !== y.slot) return x.slot.localeCompare(y.slot, "nb");
      // så lokasjon
      if ((x.locationName ?? "") !== (y.locationName ?? "")) {
        return (x.locationName ?? "").localeCompare(y.locationName ?? "", "nb");
      }
      // så firma
      return (x.companyName ?? "").localeCompare(y.companyName ?? "", "nb");
    });

    // ✅ ALWAYS array
    return jsonOk(ctx, { date, stops });
  } catch (e: any) {
    return jsonErr(500, ctx, "internal_error", "Unexpected error in driver stops route.", {
      where: "catch-all",
      ...errInfo(e),
    });
  }
}


