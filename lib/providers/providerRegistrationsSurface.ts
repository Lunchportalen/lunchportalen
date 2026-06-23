// lib/providers/providerRegistrationsSurface.ts
// Provider-facing helpers for /leverandor/registreringer (i18n keys + locale formatting).
//
// Prinsipp:
// - UI-copy lives in messages/provider.registrations.* — this module exposes ids and keys only.
// - Aldri rå status-enums eller rå ISO-dato i brukerrettet UI.
// - Ingen server-avhengigheter: brukes av både server page og client components.

import { DEFAULT_PROVIDER_LOCALE } from "@/lib/providers/operationalSettingsShared";

export type ProviderRegistrationStatusLabelKey = "pending" | "approved" | "rejected" | "other";

export type ProviderRegistrationsSummaryKey = "none" | "one" | "many";

export type ProviderRegistrationsEmptyStepKey = "reviewRequest" | "approvedFlow" | "rejectedFlow";

export const PROVIDER_REGISTRATIONS_EMPTY_STEP_KEYS: readonly ProviderRegistrationsEmptyStepKey[] = [
  "reviewRequest",
  "approvedFlow",
  "rejectedFlow",
];

/** i18n key under provider.registrations.status.* — enum values unchanged. */
export function providerRegistrationStatusLabelKey(status: string): ProviderRegistrationStatusLabelKey {
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "PENDING") return "pending";
  if (s === "APPROVED") return "approved";
  if (s === "REJECTED") return "rejected";
  return "other";
}

export function providerRegistrationsSummaryKey(pendingCount: number): {
  key: ProviderRegistrationsSummaryKey;
  count: number;
} {
  const n = Math.max(0, Math.floor(pendingCount) || 0);
  if (n === 0) return { key: "none", count: 0 };
  if (n === 1) return { key: "one", count: 1 };
  return { key: "many", count: n };
}

/**
 * Locale-formatert «Mottatt»-tidspunkt (Europe/Oslo).
 * Aldri rå ISO i UI; manglende/ugyldig verdi gir «—».
 */
export function formatProviderRegistrationReceived(iso: string | null | undefined, locale?: string | null): string {
  const value = String(iso ?? "").trim();
  if (!value) return "—";
  const resolvedLocale = String(locale ?? "").trim() || DEFAULT_PROVIDER_LOCALE;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(resolvedLocale, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Oslo",
    }).format(d);
  } catch {
    return "—";
  }
}
