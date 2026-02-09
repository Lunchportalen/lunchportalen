// app/api/kitchen/report/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Mode = "day" | "week";
type Totals = { basis: number; luxus: number; total: number };

type ChoiceBreakdown = {
  key: string;
  label: string;
  total: number;
  variants?: { name: string; count: number }[];
};

type LocationOut = {
  locationId: string;
  locationName: string;
  address: string;

  windowFrom?: string | null;
  windowTo?: string | null;
  windowLabel?: string | null;

  totals: Totals;
  notes?: string | null;

  // ✅ what customers want
  choices: ChoiceBreakdown[];

  flags: string[];
};

type CompanyOut = {
  companyId: string;
  companyName: string;
  totals: Totals;
  locations: LocationOut[];
};

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normMode(v: unknown): Mode {
  const s = safeStr(v).toLowerCase();
  return s === "week" ? "week" : "day";
}

function normalizeRole(v: any): Role {
  const s = safeStr(v).toLowerCase();
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  return "employee";
}

function isoNoon(iso: string) {
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
  const day = d.getUTCDay();
  const diffToMon = (day + 6) % 7;
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

function weekdayKeyFromISO(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" | null {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
  const map: Record<string, "mon" | "tue" | "wed" | "thu" | "fri"> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
  };
  return map[wd] ?? null;
}

function tierFromAgreementDay(tier: unknown): "basis" | "luxus" | "unknown" {
  const s = safeStr(tier).toUpperCase();
  if (s === "BASIS") return "basis";
  if (s === "LUXUS" || s === "PREMIUM") return "luxus";
  return "unknown";
}

function makeTotals(): Totals {
  return { basis: 0, luxus: 0, total: 0 };
}

function addTotals(t: Totals, tier: "basis" | "luxus" | "unknown", n = 1) {
  if (tier === "luxus") t.luxus += n;
  else if (tier === "basis") t.basis += n;
  t.total += n;
}

function prettyChoice(choiceKey: string) {
  const k = safeStr(choiceKey).toLowerCase();
  if (k === "salatbar") return "Salatbar";
  if (k === "paasmurt") return "Påsmurt";
  if (k === "varmmat") return "Varmmat";
  if (k === "sushi") return "Sushi";
  if (k === "pokebowl") return "Pokébowl";
  if (k === "thaimat") return "Thaimat";
  return choiceKey;
}

/**
 * Parse variant from note:
 * - "variant||Salatbar: Skinke"
 * - "Salatbar: Skinke"
 */
function parseVariantFromNote(choiceKey: string, note: string | null) {
  const n = safeStr(note);
  if (!n) return null;

  const parts = n.split("||").map((x) => x.trim()).filter(Boolean);
  const payload = parts.length >= 2 ? parts.slice(1).join("||").trim() : parts[0] ?? "";

  const ck = safeStr(choiceKey).toLowerCase();
  const label = ck === "salatbar" ? "Salatbar" : ck === "paasmurt" ? "Påsmurt" : null;
  if (!label) return null;

  const re = new RegExp(`^${label}\\s*:\\s*(.+)$`, "i");
  const m = re.exec(payload);
  const v = m?.[1] ? String(m[1]).trim() : "";
  return v || null;
}

function parseChoiceKeyFromLegacyNote(note: string | null): string | null {
  const n = safeStr(note).toLowerCase();
  if (!n) return null;
  const m = /(?:^|\s)choice:([a-z0-9_\-]+)/i.exec(n);
  if (m?.[1]) return m[1].toLowerCase();
  if (/^[a-z0-9_\-]{2,}$/.test(n)) return n;
  return null;
}

export async function GET(req: NextRequest) {
  const rid = makeRid();

  // Auth gate
  const a = await scopeOr401(req);
  if (a instanceof Response) return a;

  // Role gate
  const r = requireRoleOr403(a.ctx, ["kitchen", "superadmin"]);
  if (r instanceof Response) return r;

  const role = normalizeRole((a as any)?.ctx?.scope?.role);
  const scopeCompanyId = safeStr((a as any)?.ctx?.scope?.company_id);
  const scopeLocationId = safeStr((a as any)?.ctx?.scope?.location_id);

  const url = new URL(req.url);
  const mode = normMode(url.searchParams.get("mode"));
  const qDate = safeStr(url.searchParams.get("date"));
  const anchor = qDate && isIsoDate(qDate) ? qDate : osloTodayISODate();
  const dates = mode === "week" ? weekDatesMonFri(anchor) : [anchor];

  try {
    const admin = supabaseAdmin();

    // 1) Orders (active only) — FASIT for hvem som har bestilt (kun lunch)
    let oq = (admin as any)
      .from("orders")
      .select("id, user_id, date, status, company_id, location_id, slot, note")
      .in("date", dates)
      .in("status", ["active", "ACTIVE"])
      .eq("slot", "lunch");

    // Kitchen-role is scoped to own company/location
    if (role === "kitchen") {
      if (!scopeCompanyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");
      oq = oq.eq("company_id", scopeCompanyId);
      if (scopeLocationId) oq = oq.eq("location_id", scopeLocationId);
    }

    const { data: orders, error: oErr } = await oq;
    if (oErr) return jsonErr(rid, "Kunne ikke hente ordregrunnlag.", 500, { code: "orders_query_failed", detail: oErr });

    const rows = (orders ?? []) as any[];

    // 2) ids
    const companyIds = Array.from(new Set(rows.map((x) => safeStr(x.company_id)).filter(Boolean)));
    const locationIds = Array.from(new Set(rows.map((x) => safeStr(x.location_id)).filter(Boolean)));
    const userIds = Array.from(new Set(rows.map((x) => safeStr(x.user_id)).filter(Boolean)));

    // 3) meta
    const { data: companies, error: cErr } = companyIds.length
      ? await (admin as any).from("companies").select("id, name").in("id", companyIds)
      : { data: [], error: null };
    if (cErr) return jsonErr(rid, "Kunne ikke hente firmadata.", 500, { code: "companies_query_failed", detail: cErr });

    const { data: locs, error: lErr } = locationIds.length
      ? await (admin as any)
          .from("company_locations")
          .select("id, company_id, name, address, delivery_window_from, delivery_window_to, notes")
          .in("id", locationIds)
      : { data: [], error: null };
    if (lErr) return jsonErr(rid, "Kunne ikke hente lokasjonsdata.", 500, { code: "locations_query_failed", detail: lErr });

    const companyById = new Map<string, { id: string; name: string }>();
    for (const c of companies ?? []) companyById.set(safeStr((c as any).id), c as any);

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
    for (const l of locs ?? []) locById.set(safeStr((l as any).id), l as any);

    // 4) Agreement tiers per weekday (Basis/Luxus totals)
    const agreementTierMap = new Map<string, Record<string, "basis" | "luxus" | "unknown">>();
    if (companyIds.length) {
      const { data: dayRows, error: dErr } = await (admin as any)
        .from("company_current_agreement_days")
        .select("company_id, day_key, tier")
        .in("company_id", companyIds);

      if (dErr) {
        return jsonErr(rid, "Kunne ikke hente avtaletier (days).", 500, { code: "agreement_days_failed", detail: dErr });
      }

      for (const r of dayRows ?? []) {
        const cid = safeStr((r as any).company_id);
        const dk = safeStr((r as any).day_key).toLowerCase();
        const tr = tierFromAgreementDay((r as any).tier);
        if (!cid || !dk) continue;
        if (!agreementTierMap.has(cid)) agreementTierMap.set(cid, {});
        agreementTierMap.get(cid)![dk] = tr;
      }
    }

    function tierForOrder(o: any): "basis" | "luxus" | "unknown" {
      const cid = safeStr(o.company_id);
      const dISO = safeStr(o.date);
      const dk = dISO ? weekdayKeyFromISO(dISO) : null;
      if (!cid || !dk) return "unknown";
      const map = agreementTierMap.get(cid);
      if (!map) return "unknown";
      return map[dk] ?? "unknown";
    }

    // 5) day_choices for what customers want (choice + variant)
    const dayChoiceMap = new Map<string, { choice_key: string; note: string | null }>();
    if (rows.length) {
      // fetch by company + dates + userIds (bounded by day/week and company scope)
      let dcq = (admin as any)
        .from("day_choices")
        .select("company_id, location_id, user_id, date, choice_key, note, status, updated_at")
        .in("date", dates);

      if (role === "kitchen" && scopeCompanyId) dcq = dcq.eq("company_id", scopeCompanyId);
      else if (companyIds.length) dcq = dcq.in("company_id", companyIds);

      if (scopeLocationId) dcq = dcq.eq("location_id", scopeLocationId);

      if (userIds.length) dcq = dcq.in("user_id", userIds);

      const { data: dcs, error: dcErr } = await dcq;
      if (dcErr) {
        return jsonErr(rid, "Kunne ikke hente menyvalg (day_choices).", 500, { code: "day_choices_failed", detail: dcErr });
      }

      for (const r of dcs ?? []) {
        const cid = safeStr((r as any).company_id);
        const lid = safeStr((r as any).location_id);
        const uid = safeStr((r as any).user_id);
        const d = safeStr((r as any).date);
        const ck = safeStr((r as any).choice_key).toLowerCase();
        if (!cid || !uid || !d || !ck) continue;

        const key = `${cid}|${lid}|${uid}|${d}`;
        // last-write-wins on updated_at
        const prev = dayChoiceMap.get(key);
        if (!prev) {
          dayChoiceMap.set(key, { choice_key: ck, note: (r as any).note ?? null });
        } else {
          // keep existing; for report it doesn't matter much, but deterministic would be based on updated_at
          dayChoiceMap.set(key, { choice_key: ck, note: (r as any).note ?? prev.note ?? null });
        }
      }
    }

    // 6) Build output: company -> location, with totals + choices breakdown
    const outCompanies = new Map<string, CompanyOut>();

    function ensureLocation(co: CompanyOut, locationId: string, lMeta: any): LocationOut {
      const locKey = locationId || "__missing_location__";
      let lo = co.locations.find((x) => x.locationId === locKey);
      if (lo) return lo;

      const locName = safeStr(lMeta?.name) || (locationId ? "(Ukjent lokasjon)" : "(Mangler lokasjon)");
      const address = safeStr(lMeta?.address) || "";
      const wf = (lMeta as any)?.delivery_window_from ?? null;
      const wt = (lMeta as any)?.delivery_window_to ?? null;

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
        choices: [],
      };
      co.locations.push(lo);
      return lo;
    }

    function incChoice(lo: LocationOut, choiceKey: string, note: string | null) {
      const ck = safeStr(choiceKey).toLowerCase();
      if (!ck) return;

      let cb = lo.choices.find((x) => x.key === ck);
      if (!cb) {
        cb = { key: ck, label: prettyChoice(ck), total: 0, variants: ck === "salatbar" || ck === "paasmurt" ? [] : undefined };
        lo.choices.push(cb);
      }

      cb.total += 1;

      if (ck === "salatbar" || ck === "paasmurt") {
        const v = parseVariantFromNote(ck, note);
        if (!v) {
          if (!lo.flags.includes("missing_variant")) lo.flags.push("missing_variant");
          return;
        }
        const arr = cb.variants ?? (cb.variants = []);
        const found = arr.find((x) => x.name.toLowerCase() === v.toLowerCase());
        if (found) found.count += 1;
        else arr.push({ name: v, count: 1 });
      }
    }

    for (const o of rows) {
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
      const lMeta = locById.get(locationId);

      const lo = ensureLocation(co, locationId, lMeta);

      // flags
      if (!locationId) {
        if (!lo.flags.includes("missing_location_id")) lo.flags.push("missing_location_id");
      }
      if (locationId && !lMeta) {
        if (!lo.flags.includes("unknown_location")) lo.flags.push("unknown_location");
      }
      const wf = (lMeta as any)?.delivery_window_from ?? null;
      const wt = (lMeta as any)?.delivery_window_to ?? null;
      if (!safeStr(wf) && !safeStr(wt)) {
        if (!lo.flags.includes("missing_delivery_window")) lo.flags.push("missing_delivery_window");
      }

      // tier totals (basis/luxus)
      const tier = tierForOrder(o);
      if (tier === "unknown") {
        if (!lo.flags.includes("unknown_tier")) lo.flags.push("unknown_tier");
      }
      addTotals(lo.totals, tier, 1);
      addTotals(co.totals, tier, 1);

      // what customer wants (day_choices preferred)
      const key = `${companyId}|${locationId}|${safeStr(o.user_id)}|${safeStr(o.date)}`;
      const dc = dayChoiceMap.get(key);

      const dcChoice = dc?.choice_key ? safeStr(dc.choice_key).toLowerCase() : null;
      const legacyChoice = parseChoiceKeyFromLegacyNote(o.note ?? null);
      const choiceKey = dcChoice || legacyChoice;

      if (!choiceKey) {
        if (!lo.flags.includes("missing_choice")) lo.flags.push("missing_choice");
      } else {
        incChoice(lo, choiceKey, dc?.note ?? null);
      }
    }

    // 7) deterministic sorting
    const companiesArr = Array.from(outCompanies.values()).sort((a, b) => a.companyName.localeCompare(b.companyName, "no"));

    for (const c of companiesArr) {
      c.locations.sort((a, b) => a.locationName.localeCompare(b.locationName, "no"));
      for (const loc of c.locations) {
        loc.choices.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "no"));
        for (const cb of loc.choices) {
          if (cb.variants?.length) cb.variants.sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, "no"));
        }
      }
    }

    // 8) grand totals
    const grand = makeTotals();
    for (const c of companiesArr) {
      grand.basis += c.totals.basis;
      grand.luxus += c.totals.luxus;
      grand.total += c.totals.total;
    }

    return jsonOk(rid, {
      ok: true,
      rid,
      mode,
      date: anchor,
      dates,
      companies: companiesArr,
      grandTotals: grand,
    });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil i kjøkkenrapport.", 500, {
      code: "unexpected_error",
      detail: safeStr(e?.message || e),
    });
  }
}
