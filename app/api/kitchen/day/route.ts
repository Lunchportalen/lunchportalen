// app/api/kitchen/day/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";

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

function serviceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function noStore(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

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

export async function GET(req: Request) {
  const rid = `kday_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // 1) Auth gate
    const authClient = await supabaseServer();
    const { data: auth } = await authClient.auth.getUser();
    if (!auth?.user) return noStore({ ok: false, rid, error: "unauthorized" }, 401);

    // 2) Service role
    const supabase = serviceSupabase();

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const date = dateParam && isISODate(dateParam) ? dateParam : osloTodayISODate();

    // A) Orders
    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select("id, user_id, company_id, location_id, date, note, created_at")
      .eq("date", date)
      .order("created_at", { ascending: true });

    if (oErr) {
      return noStore({ ok: false, rid, error: "orders_failed", detail: oErr.message }, 500);
    }

    const safeOrders = (orders ?? []).filter((o: any) => o?.location_id);

    if (safeOrders.length === 0) {
      return noStore([], 200);
    }

    // B) Profiles
    const userIds = uniq(safeOrders.map((o: any) => o.user_id).filter(Boolean));
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    if (pErr) {
      return noStore({ ok: false, rid, error: "profiles_failed", detail: pErr.message }, 500);
    }

    const profMap = new Map<string, { full_name: string; department: string | null }>();
    (profiles ?? []).forEach((p: any) => {
      profMap.set(String(p.id), {
        full_name: pickProfileName(p),
        department: (p?.department ?? null) as string | null,
      });
    });

    // C) Locations
    const locationIds = uniq(safeOrders.map((o: any) => o.location_id).filter(Boolean));
    const { data: locations, error: lErr } = await supabase
      .from("company_locations")
      .select("*")
      .in("id", locationIds);

    if (lErr) {
      return noStore({ ok: false, rid, error: "locations_failed", detail: lErr.message }, 500);
    }

    const locMap = new Map<string, { name: string }>();
    (locations ?? []).forEach((l: any) => {
      locMap.set(String(l.id), { name: pickLocationName(l) });
    });

    // D) Companies
    const companyIds = uniq(safeOrders.map((o: any) => o.company_id).filter(Boolean));
    const { data: companies, error: cErr } = await supabase
      .from("companies")
      .select("*")
      .in("id", companyIds);

    if (cErr) {
      return noStore({ ok: false, rid, error: "companies_failed", detail: cErr.message }, 500);
    }

    const compMap = new Map<string, { name: string }>();
    (companies ?? []).forEach((c: any) => {
      compMap.set(String(c.id), { name: pickCompanyName(c) });
    });

    // 3) Grouping
    const groups = new Map<string, KitchenGroup>();

    for (const o of safeOrders as any[]) {
      const window = "Standard";
      const locId = String(o.location_id);
      const key = `${date}|${window}|${locId}`;

      if (!groups.has(key)) {
        const loc = locMap.get(locId);
        const comp = compMap.get(String(o.company_id));

        groups.set(key, {
          delivery_date: date,
          delivery_window: window,
          company: comp?.name ?? "Ukjent firma",
          location: loc?.name ?? "Ukjent lokasjon",
          company_location_id: locId,
          batch_status: "queued",
          packed_at: null,
          delivered_at: null,
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
    return noStore(
      { ok: false, rid, error: "kitchen_day_failed", detail: e?.message || String(e) },
      500
    );
  }
}
