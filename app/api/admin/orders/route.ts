// app/api/admin/orders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { osloTodayISODate } from "@/lib/date/oslo";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

// Hjelper: Supabase join kan komme som object ELLER array.
// Vi gjør det stabilt.
function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function GET(req: Request) {
  const rid = `admin_orders_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const u = new URL(req.url);
    const dateQ = u.searchParams.get("date");
    const date = dateQ && isISODate(dateQ) ? dateQ : osloTodayISODate();

    const supa = await supabaseServer();
    const { data: auth, error: authErr } = await supa.auth.getUser();

    if (authErr || !auth?.user) {
      return NextResponse.json({ ok: false, rid, error: "UNAUTH" }, { status: 401 });
    }

    const isAdmin = (auth.user.app_metadata as any)?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ ok: false, rid, error: "FORBIDDEN" }, { status: 403 });
    }

    const admin = supabaseAdmin();

    const { data: rows, error } = await (admin as any)
      .from("orders")
      .select(
        `
        id,
        user_id,
        note,
        created_at,
        company_id,
        location_id,
        date,
        status,
        companies ( id, name ),
        company_locations (
          id,
          name,
          label,
          address,
          address_line1,
          postal_code,
          city,
          delivery_json
        )
      `
      )
      .eq("date", date)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { ok: false, rid, error: "ORDERS_READ_FAILED", detail: error.message },
        { status: 500 }
      );
    }

    // ✅ Normaliser join-felter til objekt (ikke array) for stabil frontend
    const normalized = (rows ?? []).map((r: any) => ({
      ...r,
      companies: first(r.companies),
      company_locations: first(r.company_locations),
    }));

    return NextResponse.json(
      { ok: true, rid, date, count: normalized.length, orders: normalized },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, rid, error: "SERVER_ERROR", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
