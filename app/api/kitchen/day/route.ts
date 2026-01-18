// app/api/kitchen/day/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
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

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: Request) {
  const rid = `kday_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const dateISO = dateParam && isISODate(dateParam) ? dateParam : osloTodayISODate();

    const supabase = await supabaseServer();

    // 🔐 Must be authed (kitchen page already gates, but API should also protect)
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ ok: false, rid, error: "unauthorized" }, { status: 401 });
    }

    // 1) Hent bestillinger for dagen
    // Forventet modell (v3): orders knyttet til profile_id + company_id + location_id.
    // Justér feltnavn hvis de avviker hos dere.
    const { data: ordersRaw, error: ordersErr } = await supabase
      .from("orders")
      .select(
        `
        id,
        date,
        delivery_window,
        note,
        status,
        profile:profiles!orders_profile_id_fkey (
          full_name,
          department
        ),
        company:companies!orders_company_id_fkey (
          name
        ),
        location:company_locations!orders_location_id_fkey (
          id,
          name
        )
      `
      )
      .eq("date", dateISO)
      // Hvis dere har cancel/void: filtrer bort
      .not("status", "eq", "cancelled");

    if (ordersErr) {
      return NextResponse.json(
        { ok: false, rid, error: "orders_fetch_failed", detail: ordersErr.message },
        { status: 500 }
      );
    }

    const rows = ordersRaw ?? [];

    // 2) Hent batch-status for dagen (valgfritt – hvis tabellen finnes)
    // Hvis dere ikke har denne tabellen enda, faller vi tilbake til "queued".
    let batches: Array<{
      delivery_date: string;
      delivery_window: string;
      company_location_id: string;
      status: BatchStatus;
      packed_at: string | null;
      delivered_at: string | null;
    }> = [];

    try {
      const { data: batchRows, error: batchErr } = await supabase
        .from("kitchen_batches")
        .select("delivery_date, delivery_window, company_location_id, status, packed_at, delivered_at")
        .eq("delivery_date", dateISO);

      if (!batchErr && batchRows) batches = batchRows as any;
    } catch {
      // table missing or policy issue -> ignore, use defaults
    }

    const batchMap = new Map<string, (typeof batches)[number]>();
    for (const b of batches) {
      const k = `${b.delivery_date}|${b.delivery_window}|${b.company_location_id}`;
      batchMap.set(k, b);
    }

    // 3) Grouping: window → company → location
    const groupMap = new Map<string, KitchenGroup>();

    for (const r of rows as any[]) {
      const delivery_window = r.delivery_window || "Ukjent";
      const company_location_id = r.location?.id || "unknown_location";
      const company = r.company?.name || "Ukjent firma";
      const location = r.location?.name || "Ukjent lokasjon";

      const gKey = `${dateISO}|${delivery_window}|${company_location_id}`;
      const b = batchMap.get(gKey);

      if (!groupMap.has(gKey)) {
        groupMap.set(gKey, {
          delivery_date: dateISO,
          delivery_window,
          company,
          location,
          company_location_id,
          batch_status: (b?.status as BatchStatus) || "queued",
          packed_at: b?.packed_at ?? null,
          delivered_at: b?.delivered_at ?? null,
          orders: [],
        });
      }

      const g = groupMap.get(gKey)!;
      g.orders.push({
        id: r.id,
        full_name: r.profile?.full_name || "Ukjent",
        department: r.profile?.department ?? null,
        note: r.note ?? null,
      });
    }

    // 4) Sort: window asc, company asc, location asc
    const out = Array.from(groupMap.values()).sort((a, b) => {
      const w = a.delivery_window.localeCompare(b.delivery_window, "nb");
      if (w !== 0) return w;
      const c = a.company.localeCompare(b.company, "nb");
      if (c !== 0) return c;
      return a.location.localeCompare(b.location, "nb");
    });

    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "kitchen_day_failed", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
