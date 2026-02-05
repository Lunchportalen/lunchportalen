

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function POST(req: Request) {
  const rid = makeRid();
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

  // Krev innlogget bruker
  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u.user) return jsonErr(rid, "Ikke innlogget.", 401, "not_authenticated");

  // Body
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "");
  const status = String(body?.status ?? "canceled"); // "active" | "canceled"

  if (!/^[0-9a-fA-F-]{36}$/.test(orderId)) {
    return jsonErr(rid, "Ugyldig orderId.", 400, "bad_order_id");
  }
  if (!["active", "canceled"].includes(status)) {
    return jsonErr(rid, "Ugyldig status.", 400, "bad_status");
  }

  // Kall RPC (auth.uid() fungerer her)
  const { data, error } = await supabase.rpc("orders_set_status", {
    p_order_id: orderId,
    p_status: status,
  });

  if (error) return jsonErr(rid, "Kunne ikke oppdatere ordrestatus.", 500, { code: "db_error", detail: { message: error.message, detail: error } });
  return jsonOk(rid, { ok: true, result: data }, 200);
}


