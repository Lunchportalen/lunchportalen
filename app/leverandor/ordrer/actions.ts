"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { advanceOrderStatus } from "@/lib/admin/orderStatus";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import {
  kitchenOrderActionFailure,
  type ProviderOrdersActionErrorKey,
} from "@/lib/providers/providerOrdersActionErrors";
import type { KitchenStatusTarget } from "@/lib/providers/kitchenOrderStatus";
import { supabaseServer } from "@/lib/supabase/server";

export type AdvanceKitchenOrderResult =
  | { success: true; fromStatus?: string; toStatus?: string }
  | { success: false; errorKey: ProviderOrdersActionErrorKey };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

async function resolveProviderForOrder(orderId: string): Promise<string | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from("orders").select("provider_id").eq("id", orderId).maybeSingle();
  return data?.provider_id ? safeStr(data.provider_id) : null;
}

export async function advanceKitchenOrder(
  orderId: string,
  targetStatus: KitchenStatusTarget,
): Promise<AdvanceKitchenOrderResult> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) return kitchenOrderActionFailure("notAuthenticated");

  const providerId = await resolveProviderForOrder(orderId);
  if (!providerId) return kitchenOrderActionFailure("orderNotFound");

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_kitchen");
  if (!allowed) return kitchenOrderActionFailure("kitchenRoleRequired");

  try {
    const res = await advanceOrderStatus(orderId, targetStatus);
    revalidatePath("/leverandor/ordrer");
    return {
      success: true,
      fromStatus: res.from_status,
      toStatus: res.to_status,
    };
  } catch {
    return kitchenOrderActionFailure("updateFailed");
  }
}
