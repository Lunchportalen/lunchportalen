import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function GET() {
  // ✅ Auth/role gate
  const supa = await supabaseServer();

  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supa
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  const role = profile?.role ?? "employee";
  if (role !== "company_admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ✅ Data (service role)
  const supabase = serviceSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(`
      id,
      delivery_date,
      delivery_window,
      note,
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
    `)
    .eq("delivery_date", today)
    .eq("status", "active")
    .order("delivery_window", { ascending: true });

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json([]);
  }

  const locationIds = Array.from(new Set(orders.map((o: any) => o.company_locations.id)));

  const { data: batches, error: batchError } = await supabase
    .from("delivery_batches")
    .select(`
      delivery_window,
      company_location_id,
      status,
      packed_at,
      delivered_at
    `)
    .eq("delivery_date", today)
    .in("company_location_id", locationIds);

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  const batchMap = new Map<string, any>();
  (batches ?? []).forEach((b: any) => {
    batchMap.set(`${b.delivery_window}:${b.company_location_id}`, b);
  });

  const groups = Object.values(
    orders.reduce((acc: any, order: any) => {
      const locId = order.company_locations.id;
      const win = order.delivery_window;
      const key = `${win}:${locId}`;

      if (!acc[key]) {
        const batch = batchMap.get(key);

        acc[key] = {
          delivery_date: today,
          delivery_window: win,
          company: order.company_locations.companies.name,
          location: order.company_locations.name,
          company_location_id: locId,
          batch_status: batch?.status ?? "queued",
          packed_at: batch?.packed_at ?? null,
          delivered_at: batch?.delivered_at ?? null,
          orders: [],
        };
      }

      acc[key].orders.push({
        id: order.id,
        full_name: order.profiles.full_name,
        department: order.profiles.department,
        note: order.note,
      });

      return acc;
    }, {})
  );

  return NextResponse.json(groups);
}
