// app/api/kitchen/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
};

type KitchenResp = {
  ok: true;
  rid: string;
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
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig dato. Bruk YYYY-MM-DD.", { date });
  }

  // Forventning i klient: Man–Fre er leveringsdager
  if (isWeekendISO(date)) {
    const resp: KitchenResp = {
      ok: true,
      rid,
      date,
      summary: { orders: 0, companies: 0, people: 0 },
      rows: [],
      reason: "NOT_DELIVERY_DAY",
    };
    return jsonOk(resp, 200);
  }

  const admin = supabaseAdmin();

  // Hent dagens ordre (utelater cancelled)
  const { data: orders, error: oErr } = await admin
    .from("orders")
    .select("id,user_id,company_id,location_id,note,status")
    .eq("date", date)
    .neq("status", "cancelled");

  if (oErr) {
    return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente kjøkkenordre.", {
      code: oErr.code,
      message: oErr.message,
      detail: (oErr as any).details ?? (oErr as any).hint ?? null,
    });
  }

  const list = orders ?? [];
  if (list.length === 0) {
    const resp: KitchenResp = {
      ok: true,
      rid,
      date,
      summary: { orders: 0, companies: 0, people: 0 },
      rows: [],
      reason: "NO_ORDERS",
    };
    return jsonOk(resp, 200);
  }

  const companyIds = Array.from(new Set(list.map((r: any) => safeStr(r.company_id)).filter((x) => isUuid(x))));
  const locationIds = Array.from(new Set(list.map((r: any) => safeStr(r.location_id)).filter((x) => isUuid(x))));
  const userIds = Array.from(new Set(list.map((r: any) => safeStr(r.user_id)).filter((x) => isUuid(x))));

  const [companiesRes, locationsRes, profilesRes] = await Promise.all([
    companyIds.length
      ? admin.from("companies").select("id,name").in("id", companyIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
    locationIds.length
      ? admin.from("company_locations").select("id,name,company_id").in("id", locationIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
    userIds.length
      ? admin.from("profiles").select("user_id,email,full_name,name,department").in("user_id", userIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
  ]);

  if (companiesRes.error) {
    return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente firma-navn.", {
      code: companiesRes.error.code,
      message: companiesRes.error.message,
    });
  }
  if (locationsRes.error) {
    return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente lokasjoner.", {
      code: locationsRes.error.code,
      message: locationsRes.error.message,
    });
  }
  if (profilesRes.error) {
    return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente profiler.", {
      code: profilesRes.error.code,
      message: profilesRes.error.message,
    });
  }

  const companies = new Map((companiesRes.data ?? []).map((c: any) => [safeStr(c.id), c]));
  const locations = new Map((locationsRes.data ?? []).map((l: any) => [safeStr(l.id), l]));
  const profiles = new Map((profilesRes.data ?? []).map((p: any) => [safeStr(p.user_id), p]));

  const rows: KitchenRow[] = list.map((r: any) => {
    const comp = companies.get(safeStr(r.company_id));
    const loc = locations.get(safeStr(r.location_id));
    const prof = profiles.get(safeStr(r.user_id));

    const employeeName = safeStr(prof?.full_name) || safeStr(prof?.name) || safeStr(prof?.email) || "Ansatt";

    return {
      company: safeStr(comp?.name) || "Ukjent firma",
      location: safeStr(loc?.name) || "Lokasjon",
      employeeName,
      department: prof?.department ? safeStr(prof.department) : null,
      note: r.note ? safeStr(r.note) : null,
      tier: null, // kobles senere til avtale (BASIS/LUXUS)
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

  const resp: KitchenResp = {
    ok: true,
    rid,
    date,
    summary: {
      orders: rows.length,
      companies: uniqueCompanies.size,
      people: uniquePeople.size,
    },
    rows,
  };

  return jsonOk(resp, 200);
}
