

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

  // Krev innlogget bruker
  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u.user) return json(401, { ok: false, error: "not_authenticated" });

  // Body
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "");
  const status = String(body?.status ?? "canceled"); // "active" | "canceled"

  if (!/^[0-9a-fA-F-]{36}$/.test(orderId)) {
    return json(400, { ok: false, error: "bad_order_id" });
  }
  if (!["active", "canceled"].includes(status)) {
    return json(400, { ok: false, error: "bad_status" });
  }

  // Kall RPC (auth.uid() fungerer her)
  const { data, error } = await supabase.rpc("orders_set_status", {
    p_order_id: orderId,
    p_status: status,
  });

  if (error) return json(500, { ok: false, error: error.message, detail: error });
  return json(200, { ok: true, result: data });
}



