// app/api/driver/stops/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { osloTodayISODate, isIsoDate } from "@/lib/date/oslo";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normRole(v: any) {
  return safeStr(v).toLowerCase() || null;
}

// TS-safe guard for scopeOr401 union
type ScopeRes = Awaited<ReturnType<typeof scopeOr401>>;
type ScopeFail = Extract<ScopeRes, { ok: false }>;
function isScopeFail(x: ScopeRes): x is ScopeFail {
  return x.ok === false;
}

type Stop = {
  key: string;
  date: string;
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

export async function GET(req: NextRequest) {
  // 401
  const a = await scopeOr401(req);
  if (isScopeFail(a)) return a.res;

  const ctx = a.ctx;

  // 403
  const denied = requireRoleOr403(ctx, ["driver", "superadmin"]);
  if (denied) return denied;

  const url = new URL(req.url);
  const date = safeStr(url.searchParams.get("date")) || osloTodayISODate();

  const isoOk = typeof isIsoDate === "function" ? isIsoDate(date) : /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!isoOk) {
    return jsonErr(400, ctx, "bad_request", "Invalid date. Use YYYY-MM-DD.", { date });
  }

  // ✅ systemrolle → service role (RLS-bypass)
  const role = normRole((ctx as any)?.scope?.role);
  const usingServiceRole = role === "driver" || role === "superadmin";
  const sb = usingServiceRole ? supabaseAdmin() : await supabaseServer();

  // ✅ Brutal sanity: kan vi lese orders i det hele tatt?
  const { data: ping, error: pingErr } = await sb.from("orders").select("id").limit(1);
  if (pingErr) {
    return jsonErr(500, ctx, "db_error", "Service role/DB read failed at orders ping.", {
      where: "orders.ping",
      role,
      usingServiceRole,
      code: (pingErr as any).code ?? null,
      message: (pingErr as any).message ?? String(pingErr),
      details: (pingErr as any).details ?? null,
      hint: (pingErr as any).hint ?? null,
    });
  }

  // 1) Orders (uten embed for å unngå FK/relasjon-feil)
  const { data: orders, error: ordersErr } = await sb
    .from("orders")
    .select("id, date, slot, status, company_id, location_id")
    .eq("date", date)
    .neq("status", "cancelled");

  if (ordersErr) {
    return jsonErr(500, ctx, "db_error", "Failed to load orders for driver stops.", {
      where: "orders.select",
      role,
      usingServiceRole,
      code: (ordersErr as any).code ?? null,
      message: (ordersErr as any).message ?? String(ordersErr),
      details: (ordersErr as any).details ?? null,
      hint: (ordersErr as any).hint ?? null,
    });
  }

  const rows = (orders ?? []) as any[];

  // Hvis ingen ordre, returner tomt (OK)
  if (rows.length === 0) {
    return jsonOk({ ok: true, rid: safeStr((ctx as any)?.rid), date, stops: [] as Stop[] });
  }

  // 2) Hent company/location metadata via IN
  const companyIds = Array.from(new Set(rows.map((o) => String(o.company_id)).filter(Boolean)));
  const locationIds = Array.from(new Set(rows.map((o) => String(o.location_id)).filter(Boolean)));

  const [{ data: companies, error: compErr }, { data: locs, error: locErr }] = await Promise.all([
    sb.from("companies").select("id, name").in("id", companyIds),
    sb.from("company_locations").select("id, name, address_line1, address_line2, postal_code, city").in("id", locationIds),
  ]);

  if (compErr) {
    return jsonErr(500, ctx, "db_error", "Failed to load companies.", {
      where: "companies.select",
      role,
      usingServiceRole,
      code: (compErr as any).code ?? null,
      message: (compErr as any).message ?? String(compErr),
      details: (compErr as any).details ?? null,
      hint: (compErr as any).hint ?? null,
    });
  }
  if (locErr) {
    return jsonErr(500, ctx, "db_error", "Failed to load company locations.", {
      where: "company_locations.select",
      role,
      usingServiceRole,
      code: (locErr as any).code ?? null,
      message: (locErr as any).message ?? String(locErr),
      details: (locErr as any).details ?? null,
      hint: (locErr as any).hint ?? null,
    });
  }

  const companyMap = new Map<string, { id: string; name: string | null }>();
  for (const c of (companies ?? []) as any[]) {
    companyMap.set(String(c.id), { id: String(c.id), name: c?.name ? String(c.name) : null });
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
    locMap.set(String(l.id), {
      id: String(l.id),
      name: l?.name ? String(l.name) : null,
      address_line1: l?.address_line1 ? String(l.address_line1) : null,
      address_line2: l?.address_line2 ? String(l.address_line2) : null,
      postal_code: l?.postal_code ? String(l.postal_code) : null,
      city: l?.city ? String(l.city) : null,
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
      code: (confErr as any).code ?? null,
      message: (confErr as any).message ?? String(confErr),
      details: (confErr as any).details ?? null,
      hint: (confErr as any).hint ?? null,
    });
  }

  const confKey = new Map<string, { at: string; by: string }>();
  for (const c of (confs ?? []) as any[]) {
    const k = `${date}|${safeStr(c.slot)}|${String(c.company_id)}|${String(c.location_id)}`;
    confKey.set(k, { at: String(c.confirmed_at ?? ""), by: String(c.confirmed_by ?? "") });
  }

  // 4) Aggregate orders -> stops
  const acc = new Map<string, Stop>();

  for (const o of rows) {
    const slot = safeStr(o.slot) || "—";
    const companyId = String(o.company_id);
    const locationId = String(o.location_id);

    const comp = companyMap.get(companyId) ?? null;
    const loc = locMap.get(locationId) ?? null;

    const companyName = comp?.name ?? null;
    const locationName = loc?.name ?? null;

    const a1 = loc?.address_line1 ? String(loc.address_line1) : "";
    const a2 = loc?.address_line2 ? String(loc.address_line2) : "";
    const pc = loc?.postal_code ? String(loc.postal_code) : "";
    const city = loc?.city ? String(loc.city) : "";
    const addressLine = safeStr([a1, a2, [pc, city].filter(Boolean).join(" ")].filter(Boolean).join(", ")) || null;

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
      delivered: !!conf,
      deliveredAt: conf?.at ? conf.at : null,
      deliveredBy: conf?.by ? conf.by : null,
    });
  }

  const stops = Array.from(acc.values()).sort((x, y) => {
    if (x.slot !== y.slot) return x.slot.localeCompare(y.slot, "nb");
    if ((x.locationName ?? "") !== (y.locationName ?? "")) {
      return (x.locationName ?? "").localeCompare(y.locationName ?? "", "nb");
    }
    return (x.companyName ?? "").localeCompare(y.companyName ?? "", "nb");
  });

  return jsonOk({ ok: true, rid: safeStr((ctx as any)?.rid), date, stops });
}
