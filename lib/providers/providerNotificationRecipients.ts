// lib/providers/providerNotificationRecipients.ts
// Resolver for provider-spesifikke varslingsmottakere.
//
// Hver provider eier sine egne operative e-poster (provider_settings).
// Fallback-kjede (deterministisk, aldri på tvers av providere):
//   1. provider_settings.<felt>_email
//   2. providers.contact_email
//   3. ORDER_EMAIL (plattformens systemadresse) — KUN som siste nødregel,
//      slik at en varsling aldri forsvinner stille.
//
// VIKTIG: Resolveren er IKKE koblet inn i eksisterende ordre-/backup-e-postflyt
// i denne patchen. Dagens flows (lib/orders/orderBackup.ts, lib/orderBackup/*,
// app/api/cron/daily-order-summary) er plattform-globale backup-/summary-flows
// med env-styrte mottakere og skal kobles mot denne resolveren i en egen,
// kartlagt patch per flow.

import "server-only";

import { ORDER_EMAIL } from "@/lib/system/emailAddresses";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProviderOperationsEmailSource = "provider_settings" | "provider_contact" | "system_fallback";

export type ProviderNotificationRecipients = {
  providerId: string;
  /** Hovedmottaker for ordre-/driftsvarsler. */
  operationsEmail: string;
  /** Hvor operationsEmail ble hentet fra (sporbarhet i logg/payload). */
  operationsEmailSource: ProviderOperationsEmailSource;
  /** Mottaker for produksjonsgrunnlag/kjøkkenvarsler. */
  kitchenEmail: string;
  /** Mottaker for leverings-/sjåførvarsler. */
  deliveryEmail: string;
  /** Adressen som ble brukt som fallback-basis (contact_email eller systemadresse). */
  fallbackEmail: string;
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
  const fallbackEmail = providerContactEmail ?? ORDER_EMAIL;

  const settingsOperationsEmail = cleanEmail(settings.operations_email);
  const operationsEmail = settingsOperationsEmail ?? fallbackEmail;
  const operationsEmailSource: ProviderOperationsEmailSource = settingsOperationsEmail
    ? "provider_settings"
    : providerContactEmail
      ? "provider_contact"
      : "system_fallback";

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
