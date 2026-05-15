import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmployeeOrderView } from "@/lib/orders/views";

import { getOrderForScopedUser } from "./getOrderForScopedUser";

export async function getEmployeeOrder(
  sb: SupabaseClient,
  input: { orderId: string; companyId: string; locationId: string; userId: string },
): Promise<EmployeeOrderView | null> {
  const r = await getOrderForScopedUser(sb, { ...input, role: "employee" });
  if (!r || r.kind !== "employee") return null;
  return r.order;
}
