// lib/providers/providerNotificationRecipients.ts
// Resolver for provider-spesifikke varslingsmottakere.
//
// LÅST FORRETNINGSREGEL: Cateringfirmaet/provideren eier sine egne operative
// e-poster (provider_settings). Lunchportalen-adresser er ALDRI fallback for
// providerens drift — manglende provider-e-post er et konfigurasjonsavvik
// (fail-closed), ikke en grunn til å rute providerens drift til plattformen.
//
// Fallback-kjede (deterministisk, kun provider-eide adresser, aldri på tvers
// av providere):
//   1. provider_settings.<felt>_email
//   2. provider_settings.operations_email (for kitchen/delivery)
//   3. providers.contact_email
//   4. null → missing (caller skipper provider-varsling / rapporterer avvik)
//
// Plattformkopi/-overvåking håndteres separat og eksplisitt av callerne
// (platform-scope events) — den blandes aldri inn som provider-mottaker her.

import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProviderOperationsEmailSource = "provider_settings" | "provider_contact" | "missing";

export type ProviderNotificationRecipients = {
  providerId: string;
  /** Hovedmottaker for ordre-/driftsvarsler. null = konfigurasjonsavvik (fail-closed). */
  operationsEmail: string | null;
  /** Hvor operationsEmail ble hentet fra (sporbarhet i logg/payload). */
  operationsEmailSource: ProviderOperationsEmailSource;
  /** Mottaker for produksjonsgrunnlag/kjøkkenvarsler. null = mangler. */
  kitchenEmail: string | null;
  /** Mottaker for leverings-/sjåførvarsler. null = mangler. */
  deliveryEmail: string | null;
  /** Provider-eid fallback-basis (contact_email) — aldri en plattformadresse. */
  fallbackEmail: string | null;
  locale: string;
  timezone: string;
  currency: string;
};

export type ProviderNotificationSourceRows = {
  providerId: string;
  settings: {
    operations_email?: string | null;
    kitchen_email?: string | null;
    delivery_email?: string | null;
    locale?: string | null;
    timezone?: string | null;
    default_currency?: string | null;
  } | null;
  providerContactEmail: string | null;
};

function cleanEmail(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return s ? s : null;
}

/**
 * Ren, testbar resolver. Ingen I/O.
 * Blander aldri data fra ulike providere: alt utledes fra radene for én provider.
 */
export function resolveProviderNotificationRecipients(
  source: ProviderNotificationSourceRows,
): ProviderNotificationRecipients {
  const settings = source.settings ?? {};
  const providerContactEmail = cleanEmail(source.providerContactEmail);
  // Kun provider-eide adresser — aldri Lunchportalen som skjult fallback.
  const fallbackEmail = providerContactEmail;

  const settingsOperationsEmail = cleanEmail(settings.operations_email);
  const operationsEmail = settingsOperationsEmail ?? fallbackEmail;
  const operationsEmailSource: ProviderOperationsEmailSource = settingsOperationsEmail
    ? "provider_settings"
    : providerContactEmail
      ? "provider_contact"
      : "missing";

  const kitchenEmail = cleanEmail(settings.kitchen_email) ?? operationsEmail;
  const deliveryEmail = cleanEmail(settings.delivery_email) ?? operationsEmail;

  return {
    providerId: source.providerId,
    operationsEmail,
    operationsEmailSource,
    kitchenEmail,
    deliveryEmail,
    fallbackEmail,
    locale: String(settings.locale ?? "").trim() || "nb-NO",
    timezone: String(settings.timezone ?? "").trim() || "Europe/Oslo",
    currency: String(settings.default_currency ?? "").trim() || "NOK",
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Henter varslingsmottakere for én provider (f.eks. via orders.provider_id).
 * Returnerer null hvis provider ikke finnes (fail-closed — ingen gjetting).
 */
export async function getProviderNotificationRecipients(
  providerId: string,
): Promise<ProviderNotificationRecipients | null> {
  const pid = String(providerId ?? "").trim();
  if (!UUID_RE.test(pid)) return null;

  const admin = supabaseAdmin();

  const { data: provider, error: providerError } = await (admin as any)
    .from("providers")
    .select("id, contact_email")
    .eq("id", pid)
    .maybeSingle();

  if (providerError || !provider) return null;

  const { data: settings } = await (admin as any)
    .from("provider_settings")
    .select("operations_email, kitchen_email, delivery_email, locale, timezone, default_currency")
    .eq("provider_id", pid)
    .maybeSingle();

  return resolveProviderNotificationRecipients({
    providerId: pid,
    settings: settings ?? null,
    providerContactEmail: provider.contact_email ?? null,
  });
}
