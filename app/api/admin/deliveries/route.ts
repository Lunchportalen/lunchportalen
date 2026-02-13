// app/api/admin/deliveries/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { osloTodayISODate, isIsoDate } from "@/lib/date/oslo";

function safeStr(v: unknown, fallback = "") {
  if (v === null || v === undefined) return fallback;
  return String(v).trim();
}
function ridFrom(req: NextRequest) {
  return safeStr(req.headers.get("x-rid")) || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function normalizeLimit(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 100;
  return clamp(Math.trunc(n), 1, 200);
}
function isSuperadmin(ctx: any) {
  return safeStr(ctx?.scope?.role) === "superadmin";
}
function pickCompanyId(ctx: any, req: NextRequest) {
  const fromScope = safeStr(ctx?.scope?.companyId);
  if (!isSuperadmin(ctx)) return fromScope;

  const url = new URL(req.url);
  const fromQuery = safeStr(url.searchParams.get("companyId"));
  return fromQuery || fromScope;
}

function normSlot(slot: unknown) {
  const s = safeStr(slot);
  return s || "Ukjent vindu";
}

/** Vi tillater flere statusvarianter uten å knekke UI. */
function normStatus(s: unknown) {
  const u = safeStr(s, "QUEUED").toUpperCase();
  if (u === "DELIVERED") return "DELIVERED";
  if (u === "PACKED") return "PACKED";
  if (u === "CANCELLED" || u === "CANCELED") return "CANCELLED";
  if (u === "ACTIVE") return "QUEUED"; // ACTIVE → behandles som QUEUED i leveringsvisning
  return u || "QUEUED";
}

/**
 * GET /api/admin/deliveries
 * Query:
 *  - mode?: "today" | "date" (default today)
 *  - date?: YYYY-MM-DD (kun hvis mode=date)
 *  - limit?: 1..200 (default 100)
 *  - companyId?: (kun superadmin; valgfri)
 *
 * Response (UI-kontrakt for NextDeliveryPanel):
 *  { ok:true, rid, date, windows:[ {windowLabel, companies:[...]} ] }
 */
export async function GET(req: NextRequest) {
  const rid = ridFrom(req);

  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const ctx = gate.ctx;

    const denyRole = requireRoleOr403(ctx, "admin.deliveries.read", ["company_admin", "superadmin"]);
    if (denyRole) return denyRole;

    if (!isSuperadmin(ctx)) {
      const denyScope = requireCompanyScopeOr403(ctx);
      if (denyScope) return denyScope;
    }

    const url = new URL(req.url);
    const mode = safeStr(url.searchParams.get("mode")) || "today";
    const dateQ = safeStr(url.searchParams.get("date"));
    const limit = normalizeLimit(url.searchParams.get("limit"));

    const targetDate = mode === "date" && dateQ && isIsoDate(dateQ) ? dateQ : osloTodayISODate();

    if (mode === "date" && dateQ && !isIsoDate(dateQ)) {
      return jsonErr(rid, "Ugyldig datoformat. Bruk YYYY-MM-DD.", 400, {
        code: "INVALID_DATE",
        detail: { date: dateQ },
      });
    }

    const companyId = pickCompanyId(ctx, req);
    if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

    // Henter fra orders (FASIT)
    // Vi ekskluderer CANCELLED for operativ leveringsliste.
    const q = sb
      .from("orders")
      .select(
        `
        id,
        user_id,
        date,
        status,
        note,
        created_at,
        updated_at,
        company_id,
        location_id,
        slot,
        profiles:user_id ( full_name, email, department ),
        companies:company_id ( name ),
        company_locations:location_id ( name, address )
      `
      )
      .eq("company_id", companyId)
      .eq("date", targetDate)
      .neq("status", "CANCELLED")
      .order("slot", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(limit);

    const { data, error } = await q;

    if (error) {
      return jsonErr(rid, "Kunne ikke hente leveranser.", 400, {
        code: "DB_ERROR",
        detail: { message: error.message },
      });
    }

    type Person = {
      id: string;
      name: string;
      email?: string | null;
      department?: string | null;
      status: string;
      note?: string | null;
    };
    type Location = {
      locationId: string;
      locationName: string;
      address?: string | null;
      people: Person[];
    };
    type Company = {
      companyId: string;
      companyName: string;
      locations: Location[];
    };
    type WindowGroup = {
      windowLabel: string;
      companies: Company[];
    };

    const byWindow = new Map<string, WindowGroup>();

    for (const r of data ?? []) {
      const row: any = r;

      const windowLabel = normSlot(row.slot);
      const cId = safeStr(row.company_id, "unknown");
      const cName = safeStr(row.companies?.name, "Firma");

      const lId = safeStr(row.location_id, "unknown");
      const lName = safeStr(row.company_locations?.name, "Lokasjon");
      const addr = row.company_locations?.address ?? null;

      if (!byWindow.has(windowLabel)) byWindow.set(windowLabel, { windowLabel, companies: [] });
      const wg = byWindow.get(windowLabel)!;

      let c = wg.companies.find((x) => x.companyId === cId);
      if (!c) {
        c = { companyId: cId, companyName: cName, locations: [] };
        wg.companies.push(c);
      }

      let loc = c.locations.find((x) => x.locationId === lId);
      if (!loc) {
        loc = { locationId: lId, locationName: lName, address: addr, people: [] };
        c.locations.push(loc);
      }

      loc.people.push({
        id: safeStr(row.id),
        name: safeStr(row.profiles?.full_name, "Ansatt"),
        email: row.profiles?.email ?? null,
        department: row.profiles?.department ?? null,
        status: normStatus(row.status),
        note: row.note ?? null,
      });
    }

    const windows: WindowGroup[] = Array.from(byWindow.values())
      .sort((a, b) => a.windowLabel.localeCompare(b.windowLabel, "nb"))
      .map((w) => ({
        windowLabel: w.windowLabel,
        companies: w.companies
          .sort((a, b) => a.companyName.localeCompare(b.companyName, "nb"))
          .map((c) => ({
            ...c,
            locations: c.locations
              .sort((a, b) => a.locationName.localeCompare(b.locationName, "nb"))
              .map((l) => ({
                ...l,
                people: l.people.sort((a, b) => a.name.localeCompare(b.name, "nb")),
              })),
          })),
      }));

    return jsonOk(rid, { ok: true, rid, date: targetDate, windows });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, {
      code: "UNHANDLED",
      detail: { message: safeStr(e?.message ?? e) },
    });
  }
}

export async function POST(req: NextRequest) {
  const rid = ridFrom(req);
  return jsonErr(rid, "Bruk GET.", 405, { code: "method_not_allowed", detail: { method: "POST" } });
}
