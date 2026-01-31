// app/api/kitchen/company/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { osloTodayISODate } from "@/lib/date/oslo";

type BatchStatus = "queued" | "packed" | "delivered";

type KitchenOrder = {
  id: string;
  full_name: string;
  department: string | null;
  note: string | null;
};

type KitchenLocation = {
  company_location_id: string;
  location_name: string;
  delivery_window: string;
  batch_status: BatchStatus;
  packed_at: string | null;
  delivered_at: string | null;
  orders: KitchenOrder[];
};

type Resp = {
  ok: true;
  date: string;
  window: string;
  company_id: string;
  company_name: string;
  totals: { locations: number; orders: number };
  locations: KitchenLocation[];
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

function pickString(...vals: any[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickCompanyName(c: any): string {
  return pickString(c?.name, c?.title, c?.label, c?.display_name, c?.displayName) || "Ukjent firma";
}

function pickProfileName(p: any): string {
  const full = pickString(p?.full_name, p?.name, p?.display_name, p?.displayName, p?.fullName);
  if (full) return full;
  const first = pickString(p?.first_name, p?.firstName) || "";
  const last = pickString(p?.last_name, p?.lastName) || "";
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  return pickString(p?.email) || "Ukjent";
}

function pickLocationName(l: any): string {
  return (
    pickString(
      l?.name,
      l?.title,
      l?.label,
      l?.display_name,
      l?.displayName,
      l?.location_name,
      l?.locationName,
      l?.address_name,
      l?.addressName,
      l?.address
    ) || "Ukjent lokasjon"
  );
}

export async function GET(req: Request) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = `kcd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // Auth gate
    const authClient = await supabaseServer();
    const { data: auth } = await authClient.auth.getUser();
    if (!auth?.user) return noStore({ ok: false, rid, error: "unauthorized" }, 401);

    const url = new URL(req.url);
    const company_id = url.searchParams.get("company_id");
    if (!company_id) return noStore({ ok: false, rid, error: "missing_company_id" }, 400);

    const dateParam = url.searchParams.get("date");
    const date = dateParam && isISODate(dateParam) ? dateParam : osloTodayISODate();
    const window = url.searchParams.get("window") || "Standard";

    const supabase = serviceSupabase();

    // company
    const { data: company, error: cErr } = await supabase
      .from("companies")
      .select("*")
      .eq("id", company_id)
      .maybeSingle();

    if (cErr) return noStore({ ok: false, rid, error: "company_failed", detail: cErr.message }, 500);

    // orders for company + date
    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select("id, user_id, location_id, note, created_at")
      .eq("date", date)
      .eq("company_id", company_id)
      .order("created_at", { ascending: true });

    if (oErr) return noStore({ ok: false, rid, error: "orders_failed", detail: oErr.message }, 500);

    const safeOrders = (orders ?? []).filter((o: any) => o?.location_id);

    if (safeOrders.length === 0) {
      const out: Resp = {
        ok: true,
        date,
        window,
        company_id,
        company_name: pickCompanyName(company),
        totals: { locations: 0, orders: 0 },
        locations: [],
      };
      return noStore(out, 200);
    }

    const userIds = Array.from(new Set(safeOrders.map((o: any) => o.user_id).filter(Boolean)));
    const locIds = Array.from(new Set(safeOrders.map((o: any) => o.location_id).filter(Boolean)));

    // profiles
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    if (pErr) return noStore({ ok: false, rid, error: "profiles_failed", detail: pErr.message }, 500);

    const profMap = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => profMap.set(String(p.id), p));

    // locations
    const { data: locationsRaw, error: lErr } = await supabase
      .from("company_locations")
      .select("*")
      .in("id", locIds);

    if (lErr) return noStore({ ok: false, rid, error: "locations_failed", detail: lErr.message }, 500);

    const locMap = new Map<string, any>();
    (locationsRaw ?? []).forEach((l: any) => locMap.set(String(l.id), l));

    // batches (optional)
    let batches: any[] = [];
    try {
      const { data: b, error: bErr } = await supabase
        .from("kitchen_batches")
        .select("delivery_date, delivery_window, company_location_id, status, packed_at, delivered_at")
        .eq("delivery_date", date)
        .in("company_location_id", locIds);

      if (!bErr && b) batches = b as any[];
    } catch {
      // ignore
    }

    const batchMap = new Map<string, any>();
    for (const b of batches) {
      batchMap.set(`${String(b.delivery_window ?? window)}|${String(b.company_location_id)}`, b);
    }

    // group by location
    const locGroups = new Map<string, KitchenLocation>();

    for (const o of safeOrders as any[]) {
      const lid = String(o.location_id);
      const loc = locMap.get(lid);
      const batch = batchMap.get(`${window}|${lid}`);

      if (!locGroups.has(lid)) {
        locGroups.set(lid, {
          company_location_id: lid,
          location_name: pickLocationName(loc),
          delivery_window: window,
          batch_status: (batch?.status as BatchStatus) || "queued",
          packed_at: batch?.packed_at ?? null,
          delivered_at: batch?.delivered_at ?? null,
          orders: [],
        });
      }

      const prof = profMap.get(String(o.user_id));
      locGroups.get(lid)!.orders.push({
        id: String(o.id),
        full_name: pickProfileName(prof),
        department: (prof?.department ?? null) as string | null,
        note: o.note ?? null,
      });
    }

    const out: Resp = {
      ok: true,
      date,
      window,
      company_id,
      company_name: pickCompanyName(company),
      totals: { locations: locGroups.size, orders: safeOrders.length },
      locations: Array.from(locGroups.values()).sort((a, b) =>
        a.location_name.localeCompare(b.location_name, "nb")
      ),
    };

    return noStore(out, 200);
  } catch (e: any) {
    return noStore(
      { ok: false, error: "kitchen_company_failed", detail: e?.message || String(e) },
      500
    );
  }
}



