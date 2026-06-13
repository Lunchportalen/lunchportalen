import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normOperativeSlot } from "@/lib/kitchen/operativeSlot";

export type BatchTransitionMode = "create" | "from_queued" | "from_packed";
export type BatchTransitionTarget = "PACKED" | "DELIVERED";

export type BatchTransitionSyncResult = {
  advanced: number;
  skipped: number;
  already: number;
  order_ids: string[];
};

export type BatchTransitionRpcResult = {
  ok: boolean;
  batch_updated: boolean;
  batch: {
    id: string;
    delivery_date: string;
    delivery_window: string;
    company_location_id: string;
    status: string;
    packed_at: string | null;
    delivered_at: string | null;
  };
  sync: BatchTransitionSyncResult;
  provider_id: string;
};

function asSync(raw: unknown): BatchTransitionSyncResult {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const ids = Array.isArray(row.order_ids) ? row.order_ids.map(String) : [];
  return {
    advanced: Number(row.advanced ?? 0),
    skipped: Number(row.skipped ?? 0),
    already: Number(row.already ?? 0),
    order_ids: ids,
  };
}

export async function batchTransitionAndSyncOrders(
  admin: SupabaseClient,
  input: {
    deliveryDate: string;
    deliveryWindow: string;
    companyLocationId: string;
    targetBatchStatus: BatchTransitionTarget;
    actorUserId: string;
    mode: BatchTransitionMode;
  },
): Promise<{ data: BatchTransitionRpcResult | null; error: { message: string; code?: string } | null }> {
  const slot = normOperativeSlot(input.deliveryWindow);

  const { data, error } = await (admin as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  }).rpc("lp_batch_transition_and_sync_orders", {
    p_delivery_date: input.deliveryDate,
    p_delivery_window: slot,
    p_company_location_id: input.companyLocationId,
    p_target_batch_status: input.targetBatchStatus,
    p_actor_user_id: input.actorUserId,
    p_mode: input.mode,
  });

  if (error) {
    return { data: null, error: { message: error.message, code: error.code } };
  }

  if (!data || typeof data !== "object") {
    return { data: null, error: { message: "lp_batch_transition_and_sync_orders returned no data" } };
  }

  const row = data as Record<string, unknown>;
  const batchRaw = row.batch && typeof row.batch === "object" ? (row.batch as Record<string, unknown>) : {};

  return {
    data: {
      ok: Boolean(row.ok),
      batch_updated: Boolean(row.batch_updated),
      batch: {
        id: String(batchRaw.id ?? ""),
        delivery_date: String(batchRaw.delivery_date ?? input.deliveryDate),
        delivery_window: String(batchRaw.delivery_window ?? slot),
        company_location_id: String(batchRaw.company_location_id ?? input.companyLocationId),
        status: String(batchRaw.status ?? input.targetBatchStatus),
        packed_at: batchRaw.packed_at != null ? String(batchRaw.packed_at) : null,
        delivered_at: batchRaw.delivered_at != null ? String(batchRaw.delivered_at) : null,
      },
      sync: asSync(row.sync),
      provider_id: String(row.provider_id ?? ""),
    },
    error: null,
  };
}
