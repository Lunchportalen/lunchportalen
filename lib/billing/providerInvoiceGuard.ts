// lib/billing/providerInvoiceGuard.ts
// FASE 8 — delt guard for provider-faktura-API-ene: autentisering,
// provider-medlemskap og (for detalj-ruter) at fakturaen tilhører callerens
// egen provider. Fail-closed — provider ser og muterer KUN egne fakturaer.
import "server-only";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProviderInvoiceGuardOk = {
  ok: true;
  userId: string;
  providerId: string;
  providerName: string;
};
export type ProviderInvoiceGuardErr = { ok: false; status: 401 | 403 | 404; code: string; message: string };

export async function requireProviderForInvoices(opts: {
  /** provider_admin for mutasjoner, provider_viewer for lesing. */
  minRole: "provider_admin" | "provider_viewer";
  /** Når satt: verifiser at fakturaen tilhører callerens provider. */
  invoiceId?: string | null;
}): Promise<ProviderInvoiceGuardOk | ProviderInvoiceGuardErr> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { ok: false, status: 401, code: "UNAUTHENTICATED", message: "Ikke innlogget." };
  }

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) {
    return { ok: false, status: 403, code: "PROVIDER_MEMBERSHIP_REQUIRED", message: "Ingen leverandørtilgang." };
  }

  const allowed = await hasProviderRole(auth.user.id, provider.id, opts.minRole);
  if (!allowed) {
    return { ok: false, status: 403, code: "PROVIDER_ROLE_REQUIRED", message: "Ingen leverandørtilgang." };
  }

  const invoiceId = String(opts.invoiceId ?? "").trim();
  if (invoiceId) {
    const admin = supabaseAdmin() as any;
    const { data } = await admin.from("agreement_invoices").select("id, provider_id").eq("id", invoiceId).maybeSingle();
    if (!data) return { ok: false, status: 404, code: "INVOICE_NOT_FOUND", message: "Fakturaen finnes ikke." };
    if (String(data.provider_id) !== provider.id) {
      // Tenant law: aldri avslør at fremmed faktura finnes.
      return { ok: false, status: 404, code: "INVOICE_NOT_FOUND", message: "Fakturaen finnes ikke." };
    }
  }

  return { ok: true, userId: auth.user.id, providerId: provider.id, providerName: provider.name };
}
