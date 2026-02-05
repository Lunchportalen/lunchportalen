// app/api/superadmin/overview/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { isSuperadminEmail } from "@/lib/system/emails";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

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
  const rid = makeRid();

  try {
    const sbUser = await supabaseServer();
    const { data: auth, error: authErr } = await sbUser.auth.getUser();
    if (authErr || !auth?.user) return jsonErr(rid, "Ikke innlogget.", 401, "unauthorized");
    if (!isSuperadminEmail(auth.user.email)) return jsonErr(rid, "Ingen tilgang.", 403, "forbidden");

    const sb = supabaseAdmin();

    const { data: companies, error: cErr } = await sb.from("companies").select("id,name,status,updated_at,agreement_json").order("updated_at", { ascending: false });
    if (cErr) return jsonErr(rid, cErr.message, 500, "db_error");

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
    if (oErr) return jsonErr(rid, oErr.message, 500, "db_error");

    let ordersTotal = 0, ordersActive = 0, ordersCancelled = 0;
    for (const o of orders ?? []) {
      ordersTotal += 1;
      const st = String((o as any).status ?? "").toLowerCase();
      if (st === "canceled") ordersCancelled += 1;
      else ordersActive += 1;
    }

    return jsonOk(rid, {
      ok: true,
      rid,
      companies: { total, pending, active, paused, closed },
      ordersLast7Days: { from, to: today, total: ordersTotal, active: ordersActive, cancelled: ordersCancelled },
      pendingCompanies: pendingList.slice(0, 50),
    }, 200);
  } catch (e: any) {
    return jsonErr(rid, String(e?.message ?? e), 500, "server_error");
  }
}

