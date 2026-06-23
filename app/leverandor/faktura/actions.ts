"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import {
  billingContactActionFailure,
  mapBillingContactRpcErrorKey,
  type ProviderBillingActionErrorKey,
} from "@/lib/providers/providerBillingActionErrors";

export type BillingContactResult =
  | { success: true }
  | { success: false; errorKey: ProviderBillingActionErrorKey };

export async function updateBillingContact(
  providerId: string,
  billingEmail: string,
  billingOrgNumber: string,
  billingAddress: string,
): Promise<BillingContactResult> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) return billingContactActionFailure("notAuthenticated");

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) return billingContactActionFailure("providerAdminRequired");

  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const { error } = await sb.rpc("lp_provider_update_billing_contact", {
    p_provider_id: providerId,
    p_billing_email: billingEmail.trim(),
    p_billing_org_number: billingOrgNumber.trim() || null,
    p_billing_address: billingAddress.trim() || null,
  });

  if (error) return billingContactActionFailure(mapBillingContactRpcErrorKey(error.message));

  revalidatePath("/leverandor/faktura");
  return { success: true };
}
