import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminOrderView } from "@/lib/orders/views";

import { getOrderForScopedUser } from "./getOrderForScopedUser";

export async function getAdminOrder(
  sb: SupabaseClient,
  input: { orderId: string; companyId: string; locationId: string; userId: string; role?: string | null },
): Promise<AdminOrderView | null> {
  const r = await getOrderForScopedUser(sb, { ...input, role: input.role ?? "company_admin" });
  if (!r || r.kind !== "admin") return null;
  return r.order;
}
