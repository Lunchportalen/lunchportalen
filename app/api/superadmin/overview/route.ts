// app/api/superadmin/overview/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function subDaysISO(dateISO: string, days: number) {
  const d = new Date(dateISO + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - days);
  return isoDate(d);
}

export async function GET() {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = `sa_over_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const sbUser = await supabaseServer();
    const { data: auth, error: authErr } = await sbUser.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ ok: false, error: "unauthorized", rid }, { status: 401, headers: noStore() });
    }
    if (normEmail(auth.user.email) !== "superadmin@lunchportalen.no") {
      return NextResponse.json({ ok: false, error: "forbidden", rid }, { status: 403, headers: noStore() });
    }

    const sb = supabaseAdmin();

    const { data: companies, error: cErr } = await sb.from("companies").select("id,name,status,updated_at,agreement_json").order("updated_at", { ascending: false });
    if (cErr) return NextResponse.json({ ok: false, error: "db_error", message: cErr.message, rid }, { status: 500, headers: noStore() });

    let total = 0, pending = 0, active = 0, paused = 0, closed = 0;
    const pendingList: any[] = [];

    for (const c of companies ?? []) {
      total += 1;
      const st = String((c as any).status ?? "").toLowerCase();
      if (st === "pending") {
        pending += 1;
        pendingList.push({
          id: (c as any).id,
          name: (c as any).name,
          updated_at: (c as any).updated_at,
          admin_email: (c as any).agreement_json?.admin?.email ?? null,
        });
      } else if (st === "active") active += 1;
      else if (st === "paused") paused += 1;
      else if (st === "closed") closed += 1;
    }

    const today = isoDate(new Date());
    const from = subDaysISO(today, 6);

    const { data: orders, error: oErr } = await sb.from("orders").select("id,status,date").gte("date", from).lte("date", today);
    if (oErr) return NextResponse.json({ ok: false, error: "db_error", message: oErr.message, rid }, { status: 500, headers: noStore() });

    let ordersTotal = 0, ordersActive = 0, ordersCancelled = 0;
    for (const o of orders ?? []) {
      ordersTotal += 1;
      const st = String((o as any).status ?? "").toLowerCase();
      if (st === "canceled") ordersCancelled += 1;
      else ordersActive += 1;
    }

    return NextResponse.json(
      {
        ok: true,
        rid,
        companies: { total, pending, active, paused, closed },
        ordersLast7Days: { from, to: today, total: ordersTotal, active: ordersActive, cancelled: ordersCancelled },
        pendingCompanies: pendingList.slice(0, 50),
      },
      { status: 200, headers: noStore() }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "server_error", message: String(e?.message ?? e), rid }, { status: 500, headers: noStore() });
  }
}



