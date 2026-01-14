import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISO } from "@/lib/date/oslo";
import { buildKitchenGroups } from "@/lib/kitchen/grouping";
import type { DbOrderRow, ProfileRow } from "@/lib/kitchen/grouping";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || osloTodayISO();

  if (!isISODate(date)) {
    return NextResponse.json({ ok: false, error: "BAD_DATE" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });
  }

  const isAdmin = (userRes.user.app_metadata as any)?.is_admin === true;
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // 1) Hent aktive orders for dato + join company/location
  const { data: rows, error: oErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      user_id,
      note,
      created_at,
      company_id,
      location_id,
      companies ( id, name ),
      company_locations (
        id,
        label,
        address_line1,
        postal_code,
        city,
        delivery_window_start,
        delivery_window_end
      )
    `
    )
    .eq("date", date)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (oErr) {
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", detail: oErr.message },
      { status: 500 }
    );
  }

  const orders = (rows ?? []) as DbOrderRow[];
  const userIds = Array.from(new Set(orders.map((o) => o.user_id)));

  // 2) Hent profiler for navn/avdeling (ikke e-post)
  const profilesMap = new Map<string, ProfileRow>();
  if (userIds.length) {
    const { data: profRows, error: pErr } = await supabase
      .from("profiles")
      .select("user_id,name,department")
      .in("user_id", userIds);

    if (pErr) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", detail: pErr.message },
        { status: 500 }
      );
    }

    for (const p of (profRows ?? []) as ProfileRow[]) {
      profilesMap.set(p.user_id, p);
    }
  }

  const groups = buildKitchenGroups(orders, profilesMap);
  const total = groups.reduce((sum, g) => sum + g.count, 0);

  return NextResponse.json({
    ok: true,
    date,
    total,
    groups,
  });
}
