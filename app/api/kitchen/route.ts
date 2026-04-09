// app/api/kitchen/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

const allowedRoles = ["kitchen", "superadmin"] as const;

type KitchenRow = {
  company: string;
  location: string;
  employeeName: string;
  department?: string | null;
  note?: string | null;
  tier?: "BASIS" | "LUXUS" | null;
  menu_title?: string | null;
  menu_description?: string | null;
  menu_allergens?: string[];
};

type KitchenData = {
  date: string;
  cutoff?: { isAfterCutoff: boolean; cutoffTime: string };
  summary: { orders: number; companies: number; people: number };
  rows: KitchenRow[];
  reason?: "NO_ORDERS" | "NOT_DELIVERY_DAY" | "COMPANIES_PAUSED";
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function isWeekendISO(dateISO: string) {
  // Midday for å unngå timezone edgecases
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  const dow = d.getDay(); // 0 søn ... 6 lør
  return dow === 0 || dow === 6;
}
function isUuid(v: unknown) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;

  const ctx = s.ctx;
  const { rid, scope } = ctx;

  // ✅ riktig signatur
  const roleBlock = requireRoleOr403(ctx, scope.role ?? null, allowedRoles);
  if (roleBlock) return roleBlock;

  const u = new URL(req.url);
  const date = safeStr(u.searchParams.get("date"));

  if (!date || !isISODate(date)) {
    return jsonErr(rid, "Ugyldig dato. Bruk YYYY-MM-DD.", 400, { code: "BAD_REQUEST", detail: { date } });
  }

  // Forventning i klient: Man–Fre er leveringsdager
  if (isWeekendISO(date)) {
    const resp: KitchenData = {
      date,
      summary: { orders: 0, companies: 0, people: 0 },
      rows: [],
      reason: "NOT_DELIVERY_DAY",
    };
    return jsonOk(rid, resp, 200);
  }

  const admin = supabaseAdmin();
  const role = safeStr(scope?.role).toLowerCase();
  const scopeCompanyId = safeStr(scope?.companyId);
  const scopeLocationId = safeStr(scope?.locationId);

  if (role === "kitchen" && (!scopeCompanyId || !scopeLocationId)) {
    return jsonErr(rid, "Scope er ikke tilordnet.", 403, "SCOPE_NOT_ASSIGNED", {
      companyIdPresent: Boolean(scopeCompanyId),
      locationIdPresent: Boolean(scopeLocationId),
    });
  }

  // Hent dagens ordre (kun aktive, deterministisk for kjøkken)
  let ordersQ = admin
    .from("orders")
    .select("id,user_id,company_id,location_id,note,status")
    .eq("date", date)
    .in("status", ["ACTIVE", "active"]);

  if (role === "kitchen") {
    ordersQ = ordersQ.eq("company_id", scopeCompanyId).eq("location_id", scopeLocationId);
  }

  const { data: orders, error: oErr } = await ordersQ;

  if (oErr) {
    return jsonErr(rid, "Kunne ikke hente kjøkkenordre.", 500, {
      code: "DB_ERROR",
      detail: {
        code: oErr.code,
        message: oErr.message,
        detail: (oErr as any).details ?? (oErr as any).hint ?? null,
      },
    });
  }

  const raw = orders ?? [];

  // Fail-closed: kun ordre med entydig firma+lokasjon+bruker
  const list = raw.filter((r: any) => safeStr(r.company_id) && safeStr(r.location_id) && safeStr(r.user_id));

  if (list.length === 0) {
    const resp: KitchenData = {
      date,
      summary: { orders: 0, companies: 0, people: 0 },
      rows: [],
      reason: "NO_ORDERS",
    };
    return jsonOk(rid, resp, 200);
  }

  const companyIds = Array.from(new Set(list.map((r: any) => safeStr(r.company_id)).filter((x) => isUuid(x))));
  const locationIds = Array.from(new Set(list.map((r: any) => safeStr(r.location_id)).filter((x) => isUuid(x))));
  const userIds = Array.from(new Set(list.map((r: any) => safeStr(r.user_id)).filter((x) => isUuid(x))));

  const [companiesRes, locationsRes, profilesRes] = await Promise.all([
    companyIds.length
      ? admin.from("companies").select("id,name,agreement_json").in("id", companyIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
    locationIds.length
      ? admin.from("company_locations").select("id,name,company_id").in("id", locationIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
    userIds.length
      ? admin.from("profiles").select("user_id,email,full_name,name,department").in("user_id", userIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
  ]);

  if (companiesRes.error) {
    return jsonErr(rid, "Kunne ikke hente firma-navn.", 500, { code: "DB_ERROR", detail: {
      code: companiesRes.error.code,
      message: companiesRes.error.message,
    } });
  }
  if (locationsRes.error) {
    return jsonErr(rid, "Kunne ikke hente lokasjoner.", 500, { code: "DB_ERROR", detail: {
      code: locationsRes.error.code,
      message: locationsRes.error.message,
    } });
  }
  if (profilesRes.error) {
    return jsonErr(rid, "Kunne ikke hente profiler.", 500, { code: "DB_ERROR", detail: {
      code: profilesRes.error.code,
      message: profilesRes.error.message,
    } });
  }

  const companies = new Map((companiesRes.data ?? []).map((c: any) => [safeStr(c.id), c]));
  const locations = new Map((locationsRes.data ?? []).map((l: any) => [safeStr(l.id), l]));
  const profiles = new Map((profilesRes.data ?? []).map((p: any) => [safeStr(p.user_id), p]));

  const dcMap = new Map<string, { choice_key: string; note: string | null; updated_at: string | null }>();
  if (userIds.length) {
    let dcQ = admin
      .from("day_choices")
      .select("user_id,company_id,location_id,date,choice_key,note,updated_at")
      .eq("date", date)
      .in("user_id", userIds);
    if (role === "kitchen") {
      dcQ = dcQ.eq("company_id", scopeCompanyId);
    } else if (companyIds.length) {
      dcQ = dcQ.in("company_id", companyIds);
    }
    const { data: dcRows } = await dcQ;
    for (const row of (dcRows ?? []) as any[]) {
      const cid = safeStr(row.company_id);
      const uid = safeStr(row.user_id);
      const lid = safeStr(row.location_id);
      const k = `${cid}|${lid}|${uid}`;
      const prev = dcMap.get(k);
      const prevT = prev?.updated_at ? new Date(prev.updated_at).getTime() : 0;
      const nextT = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      if (!prev || nextT >= prevT) {
        dcMap.set(k, {
          choice_key: safeStr(row.choice_key),
          note: row.note != null ? safeStr(row.note) : null,
          updated_at: row.updated_at != null ? String(row.updated_at) : null,
        });
      }
    }
  }

  const { normalizeMealTypeKey } = await import("@/lib/cms/mealTypeKey");
  const { getMenusByMealTypes } = await import("@/lib/cms/getMenusByMealTypes");
  const { parseMealContractFromAgreementJson } = await import("@/lib/server/agreements/mealContract");
  const { resolveMenuForDay } = await import("@/lib/domain/resolveMenuForDay");
  const { weekdayKeyFromOsloISODate } = await import("@/lib/date/weekdayKeyFromIso");

  function choiceKeyFromRow(r: any, dc: { choice_key: string } | undefined): string {
    if (dc?.choice_key) return dc.choice_key;
    const n = safeStr(r.note).toLowerCase();
    const m = /(?:^|\s)choice:([a-z0-9_\-]+)/i.exec(n);
    if (m?.[1]) return m[1].toLowerCase();
    if (/^[a-z0-9_\-]{2,}$/i.test(safeStr(r.note))) return safeStr(r.note).toLowerCase();
    return "";
  }

  const dayKey = weekdayKeyFromOsloISODate(date);

  const mealKeys = new Set<string>();
  for (const r of list as any[]) {
    const cid = safeStr(r.company_id);
    const uid = safeStr(r.user_id);
    const lid = safeStr(r.location_id);
    const dc = dcMap.get(`${cid}|${lid}|${uid}`);
    const ck = choiceKeyFromRow(r, dc);
    const nk = ck ? normalizeMealTypeKey(ck) : "";
    const comp = companies.get(cid);
    const contract = parseMealContractFromAgreementJson(comp?.agreement_json);
    const resolved =
      dayKey ? resolveMenuForDay({ dayKey, mealContract: contract, legacyChoiceKey: nk || null }) : nk || null;
    if (resolved) mealKeys.add(resolved);
    else if (nk) mealKeys.add(nk);
  }

  let menuByMeal = new Map<string, import("@/lib/cms/types").CmsMenuByMealType>();
  try {
    menuByMeal = await getMenusByMealTypes([...mealKeys]);
  } catch (e: any) {
    console.warn("[api/kitchen] getMenusByMealTypes failed", String(e?.message ?? e));
  }

  const rows: KitchenRow[] = list.map((r: any) => {
    const comp = companies.get(safeStr(r.company_id));
    const loc = locations.get(safeStr(r.location_id));
    const prof = profiles.get(safeStr(r.user_id));

    const employeeName = safeStr(prof?.full_name) || safeStr(prof?.name) || safeStr(prof?.email) || "Ansatt";

    const cid = safeStr(r.company_id);
    const uid = safeStr(r.user_id);
    const lid = safeStr(r.location_id);
    const dc = dcMap.get(`${cid}|${lid}|${uid}`);
    const ck = choiceKeyFromRow(r, dc);
    const nk = ck ? normalizeMealTypeKey(ck) : "";
    const contract = parseMealContractFromAgreementJson(comp?.agreement_json);
    const mealTypeResolved =
      dayKey ? resolveMenuForDay({ dayKey, mealContract: contract, legacyChoiceKey: nk || null }) : nk || null;
    const lookupKey = mealTypeResolved || nk;
    const m = lookupKey ? menuByMeal.get(lookupKey) : null;
    const titleFallback = mealTypeResolved || nk || null;

    return {
      company: safeStr(comp?.name) || "Ukjent firma",
      location: safeStr(loc?.name) || "Lokasjon",
      employeeName,
      department: prof?.department ? safeStr(prof.department) : null,
      note: r.note ? safeStr(r.note) : null,
      tier: null, // kobles senere til avtale (BASIS/LUXUS)
      menu_title: (m?.title != null ? String(m.title).trim() : "") || titleFallback,
      menu_description: m?.description != null ? String(m.description) : null,
      menu_allergens: Array.isArray(m?.allergens) ? m!.allergens! : [],
    };
  });

  // Stabil sort for kjøkken: firma -> lokasjon -> ansatt
  rows.sort((a, b) => {
    const c = a.company.localeCompare(b.company, "nb");
    if (c !== 0) return c;
    const l = a.location.localeCompare(b.location, "nb");
    if (l !== 0) return l;
    return a.employeeName.localeCompare(b.employeeName, "nb");
  });

  const uniqueCompanies = new Set(rows.map((r) => r.company));
  const uniquePeople = new Set(rows.map((r) => r.employeeName));

  const resp: KitchenData = {
    date,
    summary: {
      orders: rows.length,
      companies: uniqueCompanies.size,
      people: uniquePeople.size,
    },
    rows,
  };

  return jsonOk(rid, resp, 200);
}
