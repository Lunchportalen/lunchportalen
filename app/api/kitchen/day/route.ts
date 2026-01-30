// app/api/kitchen/day/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseServer } from "@/lib/supabase/server";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";

type BatchStatus = "queued" | "packed" | "delivered";

type KitchenOrder = {
  id: string;
  full_name: string;
  department: string | null;
  note: string | null;
};

type KitchenGroup = {
  delivery_date: string; // YYYY-MM-DD
  delivery_window: string;
  company: string;
  location: string;
  company_location_id: string;

  batch_status: BatchStatus;
  packed_at: string | null;
  delivered_at: string | null;

  orders: KitchenOrder[];
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function noStore(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function requireEnv(name: string, v: string | undefined) {
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
}

function serviceSupabase() {
  requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
type ServiceClient = ReturnType<typeof serviceSupabase>;

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function pickString(...vals: any[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickProfileName(p: any): string {
  const full = pickString(p?.full_name, p?.name, p?.display_name, p?.displayName, p?.fullName);
  if (full) return full;

  const first = pickString(p?.first_name, p?.firstName) || "";
  const last = pickString(p?.last_name, p?.lastName) || "";
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;

  const email = pickString(p?.email);
  if (email) return email;

  return "Ukjent";
}

function pickLocationName(l: any): string {
  const name = pickString(
    l?.name,
    l?.title,
    l?.label,
    l?.display_name,
    l?.displayName,
    l?.location_name,
    l?.locationName,
    l?.address_name,
    l?.addressName
  );
  if (name) return name;

  const addr = pickString(l?.address, l?.street, l?.line1);
  if (addr) return addr;

  return "Ukjent lokasjon";
}

function pickCompanyName(c: any): string {
  const name = pickString(c?.name, c?.title, c?.label, c?.display_name, c?.displayName);
  return name || "Ukjent firma";
}

function roleBySystemEmail(email: string | null | undefined) {
  const e = safeStr(email).toLowerCase();
  if (!e) return null;
  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  return null;
}

function normalizeRole(v: any): "employee" | "company_admin" | "superadmin" | "kitchen" | "driver" {
  const s = safeStr(v).toLowerCase();
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  return "employee";
}

function batchStatusFromRow(r: any): BatchStatus {
  const st = safeStr(r?.status).toLowerCase();
  // hard rule: delivered > packed > queued
  if (r?.delivered_at) return "delivered";
  if (r?.packed_at) return "packed";
  if (st === "delivered") return "delivered";
  if (st === "packed") return "packed";
  return "queued";
}

/**
 * ✅ Robust status filter:
 * - prøver først "active"
 * - hvis enum-feil / invalid input -> prøver "ACTIVE"
 */
async function fetchOrdersActive(supabase: ServiceClient, date: string) {
  const base = supabase
    .from("orders")
    .select("id, user_id, company_id, location_id, date, note, created_at, status, slot")
    .eq("date", date)
    .order("created_at", { ascending: true });

  // 1) prøv lowercase
  const r1 = await base.eq("status", "active");
  if (!r1.error) return r1;

  const msg = safeStr((r1.error as any)?.message).toLowerCase();
  const isEnumCaseError =
    msg.includes("invalid input value for enum") ||
    msg.includes("invalid input value") ||
    msg.includes("enum") ||
    msg.includes("order_status");

  if (!isEnumCaseError) return r1;

  // 2) fallback uppercase (for miljøer der enum faktisk er ACTIVE)
  const r2 = await base.eq("status", "ACTIVE");
  return r2;
}

export async function GET(req: Request) {
  const rid = `kday_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // 1) Auth gate (cookie-session)
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) return noStore({ ok: false, rid, error: "unauthorized" }, 401);

    // 1b) Role gate (fail-closed)
    const sysRole = roleBySystemEmail(auth.user.email);
    let role: ReturnType<typeof normalizeRole> = sysRole ?? "employee";

    if (!sysRole) {
      const { data: profile, error: pErr } = await authClient
        .from("profiles")
        .select("role, disabled_at, is_active")
        .eq("user_id", auth.user.id)
        .maybeSingle<{ role: string | null; disabled_at: string | null; is_active: boolean | null }>();

      if (pErr || !profile) return noStore({ ok: false, rid, error: "forbidden" }, 403);
      if (profile.disabled_at) return noStore({ ok: false, rid, error: "forbidden" }, 403);
      if (profile.is_active === false) return noStore({ ok: false, rid, error: "forbidden" }, 403);

      role = normalizeRole(profile.role);
    }

    if (role !== "kitchen" && role !== "superadmin") {
      return noStore({ ok: false, rid, error: "forbidden" }, 403);
    }

    // 2) Service role
    const supabase = serviceSupabase();

    const url = new URL(req.url);
    const dateParam = safeStr(url.searchParams.get("date"));
    const date = dateParam && isIsoDate(dateParam) ? dateParam : osloTodayISODate();

    // A) Orders (ACTIVE only) – robust enum-case håndtering
    const { data: orders, error: oErr } = await fetchOrdersActive(supabase, date);

    if (oErr) {
      return noStore(
        {
          ok: false,
          rid,
          error: "orders_failed",
          detail: (oErr as any).message ?? String(oErr),
        },
        500
      );
    }

    const safeOrders = (orders ?? []).filter((o: any) => o?.location_id);

    if (safeOrders.length === 0) {
      // behold legacy-form: tom array
      return noStore([], 200);
    }

    // B) Profiles (profiles.user_id = auth.users.id)
    const userIds = uniq(safeOrders.map((o: any) => o.user_id).filter(Boolean));
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, full_name, department, name, display_name, first_name, last_name, email")
      .in("user_id", userIds);

    if (pErr) {
      return noStore({ ok: false, rid, error: "profiles_failed", detail: pErr.message }, 500);
    }

    const profMap = new Map<string, { full_name: string; department: string | null }>();
    (profiles ?? []).forEach((p: any) => {
      profMap.set(String(p.user_id), {
        full_name: pickProfileName(p),
        department: (p?.department ?? null) as string | null,
      });
    });

    // C) Locations
    const locationIds = uniq(safeOrders.map((o: any) => o.location_id).filter(Boolean));
    const { data: locations, error: lErr } = await supabase.from("company_locations").select("*").in("id", locationIds);

    if (lErr) {
      return noStore({ ok: false, rid, error: "locations_failed", detail: lErr.message }, 500);
    }

    const locMap = new Map<string, { name: string }>();
    (locations ?? []).forEach((l: any) => {
      locMap.set(String(l.id), { name: pickLocationName(l) });
    });

    // D) Companies
    const companyIds = uniq(safeOrders.map((o: any) => o.company_id).filter(Boolean));
    const { data: companies, error: cErr } = await supabase.from("companies").select("*").in("id", companyIds);

    if (cErr) {
      return noStore({ ok: false, rid, error: "companies_failed", detail: cErr.message }, 500);
    }

    const compMap = new Map<string, { name: string }>();
    (companies ?? []).forEach((c: any) => {
      compMap.set(String(c.id), { name: pickCompanyName(c) });
    });

    // E) Batch statuses (kitchen_batch)
    // Vi bruker orders.slot som delivery_window (fallback "lunch") for å matche batch-set route.
    const windows = uniq(safeOrders.map((o: any) => safeStr(o.slot).toLowerCase() || "lunch").filter(Boolean));

    const { data: batches, error: bErr } = await supabase
      .from("kitchen_batch")
      .select("delivery_date, delivery_window, company_location_id, status, packed_at, delivered_at")
      .eq("delivery_date", date)
      .in("company_location_id", locationIds)
      .in("delivery_window", windows);

    if (bErr) {
      return noStore({ ok: false, rid, error: "batch_failed", detail: bErr.message }, 500);
    }

    const batchMap = new Map<string, any>();
    (batches ?? []).forEach((b: any) => {
      const key = `${b.delivery_date}|${safeStr(b.delivery_window).toLowerCase()}|${b.company_location_id}`;
      batchMap.set(key, b);
    });

    // 3) Grouping: date + window(slot) + location
    const groups = new Map<string, KitchenGroup>();

    for (const o of safeOrders as any[]) {
      const window = safeStr(o.slot).toLowerCase() || "lunch";
      const locId = String(o.location_id);
      const key = `${date}|${window}|${locId}`;

      if (!groups.has(key)) {
        const loc = locMap.get(locId);
        const comp = compMap.get(String(o.company_id));

        const bKey = `${date}|${window}|${locId}`;
        const br = batchMap.get(bKey);

        groups.set(key, {
          delivery_date: date,
          delivery_window: window,
          company: comp?.name ?? "Ukjent firma",
          location: loc?.name ?? "Ukjent lokasjon",
          company_location_id: locId,

          batch_status: br ? batchStatusFromRow(br) : "queued",
          packed_at: br?.packed_at ?? null,
          delivered_at: br?.delivered_at ?? null,

          orders: [],
        });
      }

      const prof = profMap.get(String(o.user_id));

      groups.get(key)!.orders.push({
        id: String(o.id),
        full_name: prof?.full_name ?? "Ukjent",
        department: prof?.department ?? null,
        note: o.note ?? null,
      });
    }

    const out = Array.from(groups.values()).sort((a, b) => {
      const w = a.delivery_window.localeCompare(b.delivery_window, "nb");
      if (w !== 0) return w;
      const c = a.company.localeCompare(b.company, "nb");
      if (c !== 0) return c;
      return a.location.localeCompare(b.location, "nb");
    });

    return noStore(out, 200);
  } catch (e: any) {
    return noStore({ ok: false, rid, error: "kitchen_day_failed", detail: e?.message || String(e) }, 500);
  }
}
