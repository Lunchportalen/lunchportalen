// lib/providers/saveProviderOperationalSettings.ts
"use server";

import { revalidatePath } from "next/cache";

import { hasProviderRole } from "@/lib/auth/provider";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import {
  isSupportedProviderLocale,
  normalizeOperationalEmail,
} from "@/lib/providers/operationalSettingsShared";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProviderOperationalSettingsInput = {
  providerId: string;
  operationsEmail: string | null;
  kitchenEmail: string | null;
  deliveryEmail: string | null;
  locale: string;
};

export type ProviderOperationalSettingsResult =
  | { ok: true }
  | { ok: false; error: string; field?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lagrer provider-eide driftsinnstillinger (varslingsmottakere + locale).
 *
 * Sikkerhet:
 * - getAuthContext + provider_memberships-sjekk (provider_admin) er autoritativ.
 * - providerId fra klient brukes KUN etter at medlemskapssjekken har verifisert
 *   at innlogget bruker er provider_admin for akkurat denne provideren.
 * - Skrivingen bruker service-role-klienten fordi provider_settings sin
 *   write-RLS med vilje er forbeholdt plattform/service_role. Ingen RLS-endring.
 */
export async function saveProviderOperationalSettings(
  input: ProviderOperationalSettingsInput,
): Promise<ProviderOperationalSettingsResult> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { ok: false, error: "Ikke innlogget." };
  }

  const providerId = String(input.providerId ?? "").trim();
  if (!UUID_RE.test(providerId)) {
    return { ok: false, error: "Mangler provider.", field: "providerId" };
  }

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) return { ok: false, error: "Ingen tilgang." };

  // NB: "error" in res brukes for narrowing fordi tsconfig kjører uten strict
  // (samme mønster som ProviderLogoResult).
  const operations = normalizeOperationalEmail(input.operationsEmail);
  if ("error" in operations) return { ok: false, error: operations.error, field: "operationsEmail" };

  const kitchen = normalizeOperationalEmail(input.kitchenEmail);
  if ("error" in kitchen) return { ok: false, error: kitchen.error, field: "kitchenEmail" };

  const delivery = normalizeOperationalEmail(input.deliveryEmail);
  if ("error" in delivery) return { ok: false, error: delivery.error, field: "deliveryEmail" };

  const locale = String(input.locale ?? "").trim();
  if (!isSupportedProviderLocale(locale)) {
    return { ok: false, error: "Ugyldig språkvalg.", field: "locale" };
  }

  try {
    const admin = supabaseAdmin();
    const { error } = await (admin as any)
      .from("provider_settings")
      .upsert(
        {
          provider_id: providerId,
          operations_email: operations.value,
          kitchen_email: kitchen.value,
          delivery_email: delivery.value,
          locale,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider_id" },
      );

    if (error) {
      return { ok: false, error: "Kunne ikke lagre driftsinnstillingene akkurat nå." };
    }

    revalidatePath("/leverandor/innstillinger");
    return { ok: true };
  } catch {
    return { ok: false, error: "Kunne ikke lagre driftsinnstillingene akkurat nå." };
  }
}
