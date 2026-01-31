// app/api/kitchen/orders/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";

/* =========================================================
   Helpers (no-store + rid + safe)
========================================================= */

function noStore() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  } as const;
}

function ridFromReq(req: NextRequest) {
  const h = String(req.headers.get("x-rid") ?? "").trim();
  if (h) return h;
  const h2 = String(req.headers.get("x-request-id") ?? "").trim();
  if (h2) return h2;
  const h3 = String(req.headers.get("x-correlation-id") ?? "").trim();
  if (h3) return h3;

  try {
    return crypto.randomUUID();
  } catch {
    return `kitchen_orders_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function asDetailString(detail: unknown) {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  const payload =
    detail === undefined
      ? ({ ok: false as const, rid, error, message } as const)
      : ({ ok: false as const, rid, error, message, detail } as const);

  return NextResponse.json(payload, { status, headers: noStore() });
}

function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((x) => safeStr(x)).filter(Boolean)));
}

function normSlot(v: any) {
  const s = safeStr(v).toLowerCase();
  return s || "lunch";
}

/* =========================================================
   Types
========================================================= */

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type ProfileGateRow = {
  role: Role | null;
  disabled_at: string | null;
  is_active: boolean | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  date: string; // YYYY-MM-DD
  slot: string | null; // delivery window label
  status: string;
  note: string | null;
  company_id: string;
  location_id: string;
  user_id: string; // auth.users.id
};

type CompanyRow = { id: string; name: string | null };
type LocationRow = { id: string; name: string | null };

type EmployeeProfileRow = {
  id: string; // profile id
  user_id: string; // auth.users.id
  name: string | null;
  full_name: string | null;
  department: string | null;
  phone: string | null;
};

type KitchenOrdersApiRow = {
  order_id: string;
  created_at: string;

  delivery_date: string; // YYYY-MM-DD
  delivery_slot: string; // delivery window label
  status: string; // queued/packed/delivered (best effort)
  order_note: string | null;

  company_id: string;
  company_name: string;

  location_id: string;
  location_name: string;

  profile_id: string;
  employee_name: string;
  employee_department: string | null;
  employee_phone?: string | null;

  packed_at?: string | null;
  delivered_at?: string | null;
};

type BatchRow = {
  delivery_date: string; // YYYY-MM-DD
  delivery_window: string; // slot label
  company_location_id: string; // location_id
  status: string; // queued|packed|delivered
  packed_at: string | null;
  delivered_at: string | null;
};

/* =========================================================
   Route (ADMIN fetch, USER gate)
   - Auth session via supabaseServer (cookie)
   - Role gate via ADMIN (profiles.user_id)
   - Orders via ADMIN
   - Batch merge via kitchen_batch (ENTALL)
========================================================= */

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = ridFromReq(req);

  try {
    const url = new URL(req.url);
    const qDate = safeStr(url.searchParams.get("date"));
    const dateISO = isISODate(qDate) ? qDate : osloTodayISODate();

    /* =========================
       0) Session gate (cookie)
    ========================= */
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (userErr || !user) {
      return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget.", {
        reason: userErr?.message ?? "no_user",
      });
    }

    /* =========================
       0b) Service role (ADMIN)
    ========================= */
    let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
    try {
      admin = supabaseAdmin();
    } catch (e: any) {
      return jsonErr(500, rid, "CONFIG_ERROR", "Mangler service role konfigurasjon.", {
        detail: safeStr(e?.message ?? e),
      });
    }

    /* =========================
       1) Role gate via ADMIN
       profiles.user_id = auth.users.id
    ========================= */
    const { data: gate, error: gateErr } = await admin
      .from("profiles")
      .select("role, disabled_at, is_active")
      .eq("user_id", user.id)
      .maybeSingle<ProfileGateRow>();

    if (gateErr) {
      return jsonErr(403, rid, "FORBIDDEN", "Forbudt.", {
        code: gateErr.code,
        msg: gateErr.message,
      });
    }

    const role = (gate?.role ?? null) as Role | null;
    const disabledAt = gate?.disabled_at ?? null;
    const isActive = gate?.is_active;

    if (disabledAt) return jsonErr(403, rid, "FORBIDDEN", "Bruker er deaktivert.", { disabled_at: disabledAt });
    if (isActive === false) return jsonErr(403, rid, "FORBIDDEN", "Bruker er deaktivert.", { is_active: false });
    if (role !== "kitchen" && role !== "superadmin") return jsonErr(403, rid, "FORBIDDEN", "Forbudt.", { role });

    /* =========================
       2) Fetch ACTIVE orders for date (ADMIN)
       orders schema: id,user_id,date,status,note,created_at,company_id,location_id,slot
    ========================= */
    const { data: orders, error: ordersErr } = await admin
      .from("orders")
      .select("id, created_at, date, slot, status, note, company_id, location_id, user_id")
      .eq("date", dateISO)
      .in("status", ["ACTIVE", "active"]) // tolerer legacy
      .order("slot", { ascending: true })
      .order("created_at", { ascending: true });

    if (ordersErr) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente ordre.", {
        code: ordersErr.code,
        msg: ordersErr.message,
        detail: asDetailString(ordersErr),
        date: dateISO,
      });
    }

    const orderRows = (orders ?? []) as OrderRow[];

    if (orderRows.length === 0) {
      return jsonOk({ ok: true as const, rid, date: dateISO, rows: [] as KitchenOrdersApiRow[] });
    }

    const companyIds = uniq(orderRows.map((o) => o.company_id));
    const locationIds = uniq(orderRows.map((o) => o.location_id));
    const userIds = uniq(orderRows.map((o) => o.user_id));

    /* =========================
       3) Lookup companies/locations/profiles (ADMIN)
    ========================= */
    const [companiesRes, locationsRes, profilesRes] = await Promise.all([
      companyIds.length ? admin.from("companies").select("id, name").in("id", companyIds) : Promise.resolve({ data: [], error: null } as any),
      locationIds.length
        ? admin.from("company_locations").select("id, name").in("id", locationIds)
        : Promise.resolve({ data: [], error: null } as any),
      userIds.length
        ? admin.from("profiles").select("id, user_id, name, full_name, department, phone").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (companiesRes.error) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente firma.", {
        code: companiesRes.error.code,
        msg: companiesRes.error.message,
      });
    }
    if (locationsRes.error) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente lokasjoner.", {
        code: locationsRes.error.code,
        msg: locationsRes.error.message,
      });
    }
    if (profilesRes.error) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente profiler.", {
        code: profilesRes.error.code,
        msg: profilesRes.error.message,
      });
    }

    const companies = (companiesRes.data ?? []) as CompanyRow[];
    const locations = (locationsRes.data ?? []) as LocationRow[];
    const profiles = (profilesRes.data ?? []) as EmployeeProfileRow[];

    const companyMap = new Map<string, CompanyRow>();
    for (const c of companies) companyMap.set(String(c.id), c);

    const locationMap = new Map<string, LocationRow>();
    for (const l of locations) locationMap.set(String(l.id), l);

    const profileByUserId = new Map<string, EmployeeProfileRow>();
    for (const p of profiles) profileByUserId.set(String(p.user_id), p);

    /* =========================
       4) Batch merge (ADMIN) from kitchen_batch (ENTALL)
       key: delivery_date__delivery_window__company_location_id
    ========================= */
    const batchMap = new Map<string, BatchRow>();

    try {
      if (locationIds.length) {
        const { data: batches, error: batchErr } = await admin
          .from("kitchen_batch")
          .select("delivery_date, delivery_window, company_location_id, status, packed_at, delivered_at")
          .eq("delivery_date", dateISO)
          .in("company_location_id", locationIds);

        if (batchErr) {
          console.error(`[api/kitchen/orders] rid=${rid} batch fetch error`, batchErr);
        } else {
          for (const b of (batches ?? []) as BatchRow[]) {
            const k = `${b.delivery_date}__${normSlot(b.delivery_window)}__${b.company_location_id}`;
            batchMap.set(k, b);
          }
        }
      }
    } catch (e: any) {
      console.error(`[api/kitchen/orders] rid=${rid} batch merge exception`, e?.message ?? e);
    }

    /* =========================
       5) Map rows + merge batch status
       - Default status = queued
       - If batch exists: use batch status + timestamps
    ========================= */
    const rows: KitchenOrdersApiRow[] = orderRows.map((o) => {
      const c = companyMap.get(String(o.company_id));
      const l = locationMap.get(String(o.location_id));
      const p = profileByUserId.get(String(o.user_id));

      const deliverySlot = normSlot(o.slot);

      const employeeName = safeStr(p?.full_name) || safeStr(p?.name) || "—";

      const base: KitchenOrdersApiRow = {
        order_id: String(o.id),
        created_at: String(o.created_at),

        delivery_date: String(o.date),
        delivery_slot: deliverySlot,
        status: "queued",
        order_note: o.note ?? null,

        company_id: String(o.company_id),
        company_name: safeStr(c?.name) || "—",

        location_id: String(o.location_id),
        location_name: safeStr(l?.name) || "—",

        profile_id: String(p?.id ?? ""),
        employee_name: employeeName,
        employee_department: p?.department ?? null,
        employee_phone: p?.phone ?? null,

        packed_at: null,
        delivered_at: null,
      };

      const key = `${base.delivery_date}__${base.delivery_slot}__${base.location_id}`;
      const b = batchMap.get(key);
      if (!b) return base;

      return {
        ...base,
        status: safeStr(b.status) || base.status,
        packed_at: b.packed_at ?? null,
        delivered_at: b.delivered_at ?? null,
      };
    });

    // Deterministisk sortering
    rows.sort((a, b) => {
      const A = `${a.delivery_slot}|${a.company_name}|${a.location_name}|${a.employee_name}|${a.created_at}`;
      const B = `${b.delivery_slot}|${b.company_name}|${b.location_name}|${b.employee_name}|${b.created_at}`;
      return A.localeCompare(B, "nb");
    });

    return jsonOk({ ok: true as const, rid, date: dateISO, rows });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.error(`[api/kitchen/orders] rid=${rid} (catch)`, msg, e);
    return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig forespørsel.", { detail: msg });
  }
}


