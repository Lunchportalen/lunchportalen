// app/api/superadmin/companies/stats/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function json(ok: boolean, body: any, status = 200) {
  return NextResponse.json(
    { ok, ...body },
    {
      status,
      headers: {
        // Superadmin skal være sanntidsnært. Ingen stale-cache her.
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

export async function GET() {
  const rid = `sa_stats_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const supabase = await supabaseServer();

    const totalQ = supabase.from("companies").select("id", { count: "exact", head: true });
    const pendingQ = supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "pending");
    const activeQ = supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "active");
    const pausedQ = supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "paused");
    const closedQ = supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "closed");

    const [total, pending, active, paused, closed] = await Promise.all([
      totalQ,
      pendingQ,
      activeQ,
      pausedQ,
      closedQ,
    ]);

    if (total.error) return json(false, { rid, error: total.error.message }, 500);
    if (pending.error) return json(false, { rid, error: pending.error.message }, 500);
    if (active.error) return json(false, { rid, error: active.error.message }, 500);
    if (paused.error) return json(false, { rid, error: paused.error.message }, 500);
    if (closed.error) return json(false, { rid, error: closed.error.message }, 500);

    return json(true, {
      rid,
      stats: {
        companiesTotal: total.count ?? 0,
        companiesPending: pending.count ?? 0,
        companiesActive: active.count ?? 0,
        companiesPaused: paused.count ?? 0,
        companiesClosed: closed.count ?? 0,
      },
    });
  } catch (e: any) {
    return json(false, { rid, error: String(e?.message ?? "unknown") }, 500);
  }
}
