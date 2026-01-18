// app/api/kitchen/today/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  // ✅ Auth gate
  const supa = await supabaseServer();
  const { data: auth } = await supa.auth.getUser();

  if (!auth?.user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  // ✅ Role gate (profiles.id = auth.user.id)
  const { data: profile, error: profErr } = await supa
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const role = (profile?.role as string | undefined) ?? "employee";
  if (profErr || !["kitchen", "superadmin"].includes(role)) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  // ✅ Data (service role)
  const supabase = serviceSupabase();
  const today = todayISO();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      `
      id,
      delivery_date,
      delivery_window,
      note,
      status,
      profiles (
        full_name,
        department
      ),
      company_locations (
        id,
        name,
        companies (
          name
        )
      )
    `
    )
    .eq("delivery_date", today)
    .eq("status", "active")
    .order("delivery_window", { ascending: true });

  if (ordersError) {
    return NextResponse.json(
      { ok: false, error: "orders_failed", message: ordersError.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json(
      { ok: true, date: today, groups: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Robust: filtrer bort rader uten lokasjon (i tilfelle dårlige relasjoner)
  const safeOrders = orders.filter((o: any) => o?.company_locations?.id && o?.delivery_window);

  const locationIds = Array.from(
    new Set(safeOrders.map((o: any) => o.company_locations.id))
  );

  const { data: batches, error: batchError } = await supabase
    .from("delivery_batches")
    .select(
      `
      delivery_window,
      company_location_id,
      status,
      packed_at,
      delivered_at
    `
    )
    .eq("delivery_date", today)
    .in("company_location_id", locationIds);

  if (batchError) {
    return NextResponse.json(
      { ok: false, error: "batches_failed", message: batchError.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const batchMap = new Map<string, any>();
  (batches ?? []).forEach((b: any) => {
    batchMap.set(`${b.delivery_window}:${b.company_location_id}`, b);
  });

  const groupedObj = safeOrders.reduce((acc: any, order: any) => {
    const loc = order.company_locations;
    const locId = loc.id;
    const win = order.delivery_window;
    const key = `${win}:${locId}`;

    if (!acc[key]) {
      const batch = batchMap.get(key);
      acc[key] = {
        delivery_date: today,
        delivery_window: win,
        company: loc?.companies?.name ?? "Ukjent firma",
        location: loc?.name ?? "Ukjent lokasjon",
        company_location_id: locId,
        batch_status: batch?.status ?? "queued",
        packed_at: batch?.packed_at ?? null,
        delivered_at: batch?.delivered_at ?? null,
        orders: [],
      };
    }

    acc[key].orders.push({
      id: order.id,
      full_name: order?.profiles?.full_name ?? null,
      department: order?.profiles?.department ?? null,
      note: order.note ?? null,
    });

    return acc;
  }, {});

  const groups = Object.values(groupedObj);

  // Sorter groups stabilt på window, så lokasjon
  groups.sort((a: any, b: any) => {
    const aw = String(a.delivery_window ?? "");
    const bw = String(b.delivery_window ?? "");
    if (aw !== bw) return aw.localeCompare(bw);
    return String(a.location ?? "").localeCompare(String(b.location ?? ""));
  });

  return NextResponse.json(
    { ok: true, date: today, groups },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
