"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";

export type BillingContactResult = { success: true } | { success: false; error: string };

function mapRpcError(message: string): string {
  if (message.includes("PERMISSION_DENIED")) return "Du har ikke tilgang.";
  if (message.includes("INVALID_BILLING_EMAIL")) return "Ugyldig faktura-e-post.";
  if (message.includes("ACTIVE_SUBSCRIPTION_NOT_FOUND")) return "Ingen aktiv lisens å oppdatere.";
  return "Kunne ikke lagre fakturakontakt.";
}

export async function updateBillingContact(
  providerId: string,
  billingEmail: string,
  billingOrgNumber: string,
  billingAddress: string,
): Promise<BillingContactResult> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) return { success: false, error: "Ikke innlogget." };

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) return { success: false, error: "Kun provider-admin kan endre fakturakontakt." };

  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const { error } = await sb.rpc("lp_provider_update_billing_contact", {
    p_provider_id: providerId,
    p_billing_email: billingEmail.trim(),
    p_billing_org_number: billingOrgNumber.trim() || null,
    p_billing_address: billingAddress.trim() || null,
  });

  if (error) return { success: false, error: mapRpcError(error.message) };

  revalidatePath("/leverandor/faktura");
  return { success: true };
}
