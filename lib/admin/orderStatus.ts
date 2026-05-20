// lib/admin/orderStatus.ts — Patch 11 kitchen status RPC wrapper (mirror suspend.ts)
import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type { KitchenStatusTarget } from "@/lib/providers/kitchenOrderStatus";

export class OrderStatusError extends Error {
  constructor(
    message: string,
    public readonly code: string | null | undefined,
  ) {
    super(message);
    this.name = "OrderStatusError";
  }
}

export type AdvanceOrderStatusResult = {
  ok: boolean;
  from_status?: string;
  to_status?: string;
  already_at_status?: boolean;
};

export async function advanceOrderStatus(
  orderId: string,
  targetStatus: KitchenStatusTarget,
  note?: string | null,
): Promise<AdvanceOrderStatusResult> {
  const sb = await supabaseServer();
  const { data, error } = await (sb as unknown as {
    rpc: (
      name: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  }).rpc("lp_order_advance_status", {
    p_order_id: orderId,
    p_target_status: targetStatus,
    p_note: note ?? null,
  });

  if (error) {
    throw new OrderStatusError(error.message, error.code);
  }

  if (!data || typeof data !== "object") {
    throw new OrderStatusError("lp_order_advance_status returned no data", null);
  }

  const row = data as Record<string, unknown>;
  return {
    ok: Boolean(row.ok),
    from_status: row.from_status != null ? String(row.from_status) : undefined,
    to_status: row.to_status != null ? String(row.to_status) : undefined,
    already_at_status: Boolean(row.already_at_status),
  };
}
