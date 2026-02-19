export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { lpOrderCancel, lpOrderSet } from "@/lib/orders/rpcWrite";

export async function POST(req: Request) {
  const rid = makeRid();
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u.user) return jsonErr(rid, "Ikke innlogget.", 401, "not_authenticated");

  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "");
  const status = String(body?.status ?? "canceled").toLowerCase();

  if (!/^[0-9a-fA-F-]{36}$/.test(orderId)) {
    return jsonErr(rid, "Ugyldig orderId.", 400, "bad_order_id");
  }
  if (!["active", "canceled"].includes(status)) {
    return jsonErr(rid, "Ugyldig status.", 400, "bad_status");
  }

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("id,date,slot")
    .eq("id", orderId)
    .maybeSingle();

  if (oErr || !order?.date) {
    return jsonErr(rid, "Fant ikke ordre.", 404, "order_not_found");
  }

  const writeRes = status === "active"
    ? await lpOrderSet(supabase as any, { p_date: String(order.date), p_slot: String(order.slot ?? "lunch"), p_note: null })
    : await lpOrderCancel(supabase as any, { p_date: String(order.date) });

  if (!writeRes.ok) {
    return jsonErr(rid, "Kunne ikke oppdatere ordrestatus.", 500, {
      code: writeRes.code ?? "ORDER_RPC_FAILED",
      detail: { message: writeRes.error?.message ?? "rpc_failed" },
    });
  }

  return jsonOk(rid, { ok: true, result: writeRes.row ?? null }, 200);
}
