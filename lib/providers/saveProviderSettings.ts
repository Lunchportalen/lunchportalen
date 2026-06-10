// lib/providers/saveProviderSettings.ts
"use server";

import { revalidatePath } from "next/cache";

import { hasProviderRole } from "@/lib/auth/provider";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { supabaseServer } from "@/lib/supabase/server";

export type ProviderSettingsInput = {
  providerId: string;
  name: string;
  contactEmail: string;
  contactPhone: string | null;
};

export type ProviderSettingsResult =
  | { ok: true }
  | { ok: false; error: string; field?: string };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Update provider profile fields (provider_admin on provider).
 */
export async function saveProviderSettings(input: ProviderSettingsInput): Promise<ProviderSettingsResult> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { ok: false, error: "Ikke innlogget." };
  }

  const providerId = safeStr(input.providerId);
  if (!providerId) return { ok: false, error: "Mangler provider.", field: "providerId" };

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) return { ok: false, error: "Ingen tilgang." };

  const name = safeStr(input.name);
  const contactEmail = safeStr(input.contactEmail);
  if (!name) return { ok: false, error: "Navn er påkrevd.", field: "name" };
  if (!contactEmail || !contactEmail.includes("@")) {
    return { ok: false, error: "Gyldig e-post er påkrevd.", field: "contactEmail" };
  }

  try {
    const sb = await supabaseServer();
    const { error } = await (sb as any)
      .from("providers")
      .update({
        name,
        contact_email: contactEmail,
        contact_phone: safeStr(input.contactPhone) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", providerId);

    if (error) return { ok: false, error: "Kunne ikke lagre innstillinger." };

    revalidatePath("/leverandor");
    revalidatePath("/leverandor/innstillinger");
    return { ok: true };
  } catch {
    return { ok: false, error: "Uventet feil ved lagring." };
  }
}
