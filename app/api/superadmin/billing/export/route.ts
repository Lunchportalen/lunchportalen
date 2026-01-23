// app/api/superadmin/billing/export/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function isoDate(s: string) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function csvEscape(v: any) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const rid = `sa_bill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const sbUser = await supabaseServer();
    const { data: auth, error: authErr } = await sbUser.auth.getUser();
    if (authErr || !auth?.user) return NextResponse.json({ ok: false, error: "unauthorized", rid }, { status: 401, headers: noStore() });

    if (normEmail(auth.user.email) !== "superadmin@lunchportalen.no") {
      return NextResponse.json({ ok: false, error: "forbidden", rid }, { status: 403, headers: noStore() });
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";

    if (!isoDate(from) || !isoDate(to)) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "Krever ?from=YYYY-MM-DD&to=YYYY-MM-DD", rid },
        { status: 400, headers: noStore() }
      );
    }

    const sb = supabaseAdmin();

    const { data: orders, error: oErr } = await sb
      .from("orders")
      .select("id,company_id,date,status")
      .gte("date", from)
      .lte("date", to);

    if (oErr) return NextResponse.json({ ok: false, error: "db_error", message: oErr.message, rid }, { status: 500, headers: noStore() });

    const companyIds = Array.from(new Set((orders ?? []).map((o: any) => o.company_id).filter(Boolean)));
    const { data: companies, error: cErr } = await sb.from("companies").select("id,name,status").in("id", companyIds);

    if (cErr) return NextResponse.json({ ok: false, error: "db_error", message: cErr.message, rid }, { status: 500, headers: noStore() });

    const byId = new Map<string, any>();
    for (const c of companies ?? []) byId.set(c.id, c);

    const agg = new Map<string, any>();
    for (const o of orders ?? []) {
      const cid = o.company_id;
      if (!cid) continue;

      const c = byId.get(cid);
      const a = agg.get(cid) ?? {
        company_id: cid,
        company_name: String(c?.name ?? ""),
        company_status: String(c?.status ?? ""),
        orders_total: 0,
        orders_active: 0,
        orders_cancelled: 0,
      };

      a.orders_total += 1;

      const st = String(o.status ?? "").toLowerCase();
      if (st === "cancelled" || st === "canceled") a.orders_cancelled += 1;
      else a.orders_active += 1;

      agg.set(cid, a);
    }

    const rows: string[] = [];
    rows.push(
      [
        "company_id",
        "company_name",
        "company_status",
        "period_start",
        "period_end",
        "orders_total",
        "orders_active",
        "orders_cancelled",
      ].join(",")
    );

    for (const a of agg.values()) {
      rows.push(
        [
          csvEscape(a.company_id),
          csvEscape(a.company_name),
          csvEscape(a.company_status),
          csvEscape(from),
          csvEscape(to),
          csvEscape(a.orders_total),
          csvEscape(a.orders_active),
          csvEscape(a.orders_cancelled),
        ].join(",")
      );
    }

    const csv = rows.join("\n");
    const filename = `billing_${from}_to_${to}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: { ...noStore(), "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "x-lp-rid": rid },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "server_error", message: String(e?.message ?? e), rid }, { status: 500, headers: noStore() });
  }
}
