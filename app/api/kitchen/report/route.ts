// app/api/kitchen/report/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { jsonOk, jsonErr, rid as makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";

type Mode = "day" | "week";

type Totals = { basis: number; luxus: number; total: number };

type LocationOut = {
  locationId: string;
  locationName: string;
  address: string;

  windowFrom?: string | null;
  windowTo?: string | null;
  windowLabel?: string | null;

  totals: Totals;
  notes?: string | null;

  flags: string[];
};

type CompanyOut = {
  companyId: string;
  companyName: string;
  totals: Totals;
  locations: LocationOut[];
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normMode(v: unknown): Mode {
  const s = safeStr(v).toLowerCase();
  return s === "week" ? "week" : "day";
}

function isoNoon(iso: string) {
  // Stabil dato-håndtering uten TZ-overraskelser
  return new Date(`${iso}T12:00:00.000Z`);
}

function toISODate(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOfWeek(iso: string) {
  const d = isoNoon(iso);
  // JS: 0=Sun,1=Mon,...6=Sat. ISO-week: Mon first
  const day = d.getUTCDay();
  const diffToMon = (day + 6) % 7; // Mon=>0, Tue=>1, ... Sun=>6
  d.setUTCDate(d.getUTCDate() - diffToMon);
  return d;
}

function weekDatesMonFri(anchorIso: string) {
  const mon = mondayOfWeek(anchorIso);
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setUTCDate(mon.getUTCDate() + i);
    out.push(toISODate(d));
  }
  return out;
}

function windowLabel(from?: string | null, to?: string | null) {
  const f = safeStr(from);
  const t = safeStr(to);
  if (!f && !t) return null;
  if (f && t) return `${f}–${t}`;
  if (f) return `${f}`;
  return `${t}`;
}

/**
 * Robust tier-classifier (ikke-krasjende)
 * - hvis du senere får eksplisitt tier-felt i orders, bytter vi til det.
 */
function tierFromSlot(slot: unknown): "basis" | "luxus" | "unknown" {
  const s = safeStr(slot).toLowerCase();
  if (!s) return "unknown";
  if (s.includes("lux")) return "luxus";
  // default til basis for stabil drift
  return "basis";
}

function addTotals(t: Totals, tier: "basis" | "luxus" | "unknown", n = 1) {
  if (tier === "luxus") t.luxus += n;
  else if (tier === "basis") t.basis += n;
  t.total += n;
}

function makeTotals(): Totals {
  return { basis: 0, luxus: 0, total: 0 };
}

export async function GET(req: NextRequest) {
  const rid = makeRid();

  // ✅ Auth gate (cookie/session)
  const a = await scopeOr401(req);
  if (a instanceof Response) return a;

  // ✅ Role gate (read-only)
  const r = requireRoleOr403(a.ctx, ["kitchen", "superadmin"]);
  if (r instanceof Response) return r;

  const url = new URL(req.url);
  const mode = normMode(url.searchParams.get("mode"));
  const qDate = safeStr(url.searchParams.get("date"));
  const anchor = qDate && isIsoDate(qDate) ? qDate : osloTodayISODate();

  const dates = mode === "week" ? weekDatesMonFri(anchor) : [anchor];

  try {
    const sb = await supabaseServer();

    // 1) Hent aktive orders for dato(er)
    // Fasit: orders.status, orders.date, company_id, location_id, slot
    const { data: orders, error: oErr } = await sb
      .from("orders")
      .select("id, date, status, company_id, location_id, slot, created_at")
      .in("date", dates)
      .eq("status", "ACTIVE");

    if (oErr) {
      return jsonErr(500, rid, "orders_query_failed", "Kunne ikke hente ordregrunnlag.", oErr);
    }

    const rows = orders ?? [];

    // 2) Finn company_ids og location_ids
    const companyIds = Array.from(new Set(rows.map((x: any) => x.company_id).filter(Boolean)));
    const locationIds = Array.from(new Set(rows.map((x: any) => x.location_id).filter(Boolean)));

    // 3) Hent company metadata
    const { data: companies, error: cErr } = companyIds.length
      ? await sb.from("companies").select("id, name").in("id", companyIds)
      : { data: [], error: null };

    if (cErr) {
      return jsonErr(500, rid, "companies_query_failed", "Kunne ikke hente firmadata.", cErr);
    }

    // 4) Hent location metadata
    const { data: locs, error: lErr } = locationIds.length
      ? await sb
          .from("company_locations")
          .select("id, company_id, name, address, delivery_window_from, delivery_window_to, notes")
          .in("id", locationIds)
      : { data: [], error: null };

    if (lErr) {
      return jsonErr(500, rid, "locations_query_failed", "Kunne ikke hente lokasjonsdata.", lErr);
    }

    const companyById = new Map<string, { id: string; name: string }>();
    for (const c of companies ?? []) companyById.set((c as any).id, c as any);

    const locById = new Map<
      string,
      {
        id: string;
        company_id: string;
        name: string;
        address: string;
        delivery_window_from?: string | null;
        delivery_window_to?: string | null;
        notes?: string | null;
      }
    >();
    for (const l of locs ?? []) locById.set((l as any).id, l as any);

    // 5) Bygg output: firma → lokasjon
    const outCompanies = new Map<string, CompanyOut>();

    // Avvik bucket for "mangler lokasjon" etc – vi beholder dem, men flagger
    // (les: produksjon må se dette, men kan ikke redigere her)
    for (const o of rows as any[]) {
      const companyId = safeStr(o.company_id);
      const locationId = safeStr(o.location_id);

      const cMeta = companyById.get(companyId);
      const companyName = safeStr(cMeta?.name) || "(Ukjent firma)";

      if (!outCompanies.has(companyId)) {
        outCompanies.set(companyId, {
          companyId,
          companyName,
          totals: makeTotals(),
          locations: [],
        });
      }

      const co = outCompanies.get(companyId)!;

      // Finn/lag lokasjonsnode
      const lMeta = locById.get(locationId);

      const locName = safeStr(lMeta?.name) || (locationId ? "(Ukjent lokasjon)" : "(Mangler lokasjon)");
      const address = safeStr(lMeta?.address) || "";
      const wf = (lMeta as any)?.delivery_window_from ?? null;
      const wt = (lMeta as any)?.delivery_window_to ?? null;

      // nøkkel per locationId (fallback når mangler)
      const locKey = locationId || "__missing_location__";

      let lo = co.locations.find((x) => x.locationId === locKey);
      if (!lo) {
        lo = {
          locationId: locKey,
          locationName: locName,
          address,
          windowFrom: wf,
          windowTo: wt,
          windowLabel: windowLabel(wf, wt),
          totals: makeTotals(),
          notes: (lMeta as any)?.notes ?? null,
          flags: [],
        };
        co.locations.push(lo);
      }

      // flags
      if (!locationId) {
        if (!lo.flags.includes("missing_location_id")) lo.flags.push("missing_location_id");
      }
      if (locationId && !lMeta) {
        if (!lo.flags.includes("unknown_location")) lo.flags.push("unknown_location");
      }
      if (!safeStr(wf) && !safeStr(wt)) {
        if (!lo.flags.includes("missing_delivery_window")) lo.flags.push("missing_delivery_window");
      }

      // tier + totals
      const tier = tierFromSlot(o.slot);
      if (tier === "unknown") {
        if (!lo.flags.includes("unknown_tier")) lo.flags.push("unknown_tier");
      }

      addTotals(lo.totals, tier, 1);
      addTotals(co.totals, tier, 1);
    }

    // 6) Sortering (Avensia: deterministisk)
    const companiesArr = Array.from(outCompanies.values()).sort((a, b) =>
      a.companyName.localeCompare(b.companyName, "no")
    );

    for (const c of companiesArr) {
      c.locations.sort((a, b) => a.locationName.localeCompare(b.locationName, "no"));
    }

    // 7) Grand totals
    const grand = makeTotals();
    for (const c of companiesArr) {
      grand.basis += c.totals.basis;
      grand.luxus += c.totals.luxus;
      grand.total += c.totals.total;
    }

    const body = {
      ok: true,
      rid,
      mode,
      date: anchor,
      dates,
      companies: companiesArr,
      grandTotals: grand,
    };

    return jsonOk(body, { headers: noStoreHeaders() });
  } catch (e: any) {
    return jsonErr(500, rid, "unexpected_error", "Uventet feil i kjøkkenrapport.", safeStr(e?.message || e));
  }
}
