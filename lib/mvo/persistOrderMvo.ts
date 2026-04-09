import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";

export type MvoOrderPayload = {
  variant_channel?: string;
  variant_segment?: string;
  variant_timing?: string;
  market_id?: string;
};

function clamp(s: string, max: number): string {
  return s.trim().slice(0, max);
}

/**
 * Lagrer MVO-dimensjoner på ordre etter opprettelse. `user_id` settes allerede av RPC (sannhetskilde for hvem som bestilte).
 */
export async function persistMvoOnOrder(
  admin: SupabaseClient,
  params: { orderId: string; mvo: MvoOrderPayload; rid: string }
): Promise<{ ok: boolean }> {
  const ch = params.mvo.variant_channel != null ? clamp(String(params.mvo.variant_channel), 64) : "";
  const seg = params.mvo.variant_segment != null ? clamp(String(params.mvo.variant_segment), 64) : "";
  const tim = params.mvo.variant_timing != null ? clamp(String(params.mvo.variant_timing), 64) : "";
  const mk = params.mvo.market_id != null ? clamp(String(params.mvo.market_id), 64) : "";
  if (!ch && !seg && !tim && !mk) return { ok: true };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (ch) patch.variant_channel = ch;
  if (seg) patch.variant_segment = seg;
  if (tim) patch.variant_timing = tim;
  if (mk) patch.market_id = mk;

  const { error } = await admin.from("orders").update(patch).eq("id", params.orderId);
  if (error) {
    opsLog("mvo_order_persist_failed", {
      rid: params.rid,
      message: error.message,
      orderId: params.orderId,
    });
    return { ok: false };
  }
  opsLog("mvo_order_persist", { rid: params.rid, orderId: params.orderId });
  return { ok: true };
}
