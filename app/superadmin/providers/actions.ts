"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { computeRole, hasRole } from "@/lib/auth/roles";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { supabaseServer } from "@/lib/supabase/server";

export type SuperadminBillingResult =
  | { success: true; subscriptionId?: string; invoiceId?: string }
  | { success: false; error: string };

async function assertSuperadmin() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) return { ok: false as const, error: "Ikke innlogget." };
  let profileRole: string | null = null;
  try {
    profileRole = await getRoleForUser(auth.user.id);
  } catch {
    profileRole = null;
  }
  const role = computeRole(auth.user, profileRole);
  if (!hasRole(role, ["superadmin"])) return { ok: false as const, error: "Kun superadmin." };
  return { ok: true as const };
}

function mapRpcError(message: string): string {
  if (message.includes("PERMISSION_DENIED")) return "Mangler tilgang.";
  if (message.includes("INVALID_PLAN")) return "Ugyldig plan.";
  if (message.includes("INVALID_AMOUNT")) return "Ugyldig beløp.";
  if (message.includes("INVALID_BILLING_EMAIL")) return "Ugyldig faktura-e-post.";
  if (message.includes("PROVIDER_NOT_FOUND")) return "Leverandør ikke funnet.";
  if (message.includes("ACTIVE_SUBSCRIPTION_NOT_FOUND")) return "Ingen aktiv lisens.";
  return "Handlingen feilet.";
}

export async function setProviderSubscription(input: {
  providerId: string;
  plan: string;
  monthlyAmount: number;
  billingEmail: string;
  billingOrgNumber?: string;
  billingAddress?: string;
  notes?: string;
}): Promise<SuperadminBillingResult> {
  const gate = await assertSuperadmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("lp_provider_set_subscription", {
    p_provider_id: input.providerId,
    p_plan: input.plan,
    p_monthly_amount: input.monthlyAmount,
    p_billing_email: input.billingEmail,
    p_billing_org_number: input.billingOrgNumber ?? null,
    p_billing_address: input.billingAddress ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) return { success: false, error: mapRpcError(error.message) };

  const row = (data ?? {}) as Record<string, unknown>;
  revalidatePath("/superadmin/providers");
  revalidatePath(`/superadmin/providers/${input.providerId}/billing`);
  revalidatePath("/leverandor/faktura");
  return { success: true, subscriptionId: String(row.subscription_id ?? "") || undefined };
}

export async function generateProviderInvoice(
  providerId: string,
  invoicePeriod: string,
): Promise<SuperadminBillingResult> {
  const gate = await assertSuperadmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("lp_provider_generate_invoice_for_period", {
    p_provider_id: providerId,
    p_invoice_period: invoicePeriod,
  });

  if (error) return { success: false, error: mapRpcError(error.message) };

  const row = (data ?? {}) as Record<string, unknown>;
  revalidatePath(`/superadmin/providers/${providerId}/billing`);
  revalidatePath("/leverandor/faktura");
  return { success: true, invoiceId: String(row.invoice_id ?? "") || undefined };
}
