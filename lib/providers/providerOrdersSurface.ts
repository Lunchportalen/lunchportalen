// lib/providers/providerOrdersSurface.ts
// Provider-facing helpers for /leverandor/ordrer (i18n keys + locale formatting).
//
// Prinsipp:
// - UI-copy lives in messages/provider.orders.* — this module exposes ids and keys only.
// - Datoer i brukerrettet UI er locale-formatert (provider_settings.locale når satt),
//   aldri rå ISO. Backend/URL-params beholder ISO.
// - Ingen server-avhengigheter: brukes av både server page og client components.

import { DEFAULT_PROVIDER_LOCALE } from "@/lib/providers/operationalSettingsShared";

export type ProviderOrdersDateMode = "today" | "tomorrow" | "week";

export const PROVIDER_ORDERS_DATE_MODES: ReadonlyArray<{ id: ProviderOrdersDateMode }> = [
  { id: "today" },
  { id: "tomorrow" },
  { id: "week" },
];

export type KitchenStatusFilterId = "" | "ACTIVE" | "PREPARED" | "DISPATCHED" | "DELIVERED";

/** Statuschips — samme id-semantikk som tidligere DB-filter (raw uppercase equality). */
export const PROVIDER_ORDERS_STATUS_FILTERS: ReadonlyArray<{ id: KitchenStatusFilterId }> = [
  { id: "" },
  { id: "ACTIVE" },
  { id: "PREPARED" },
  { id: "DISPATCHED" },
  { id: "DELIVERED" },
];

export type OrdersStatusFilterKey = "all" | "received" | "production" | "ready" | "delivered";

export function ordersStatusFilterKey(id: KitchenStatusFilterId): OrdersStatusFilterKey {
  if (id === "") return "all";
  if (id === "ACTIVE") return "received";
  if (id === "PREPARED") return "production";
  if (id === "DISPATCHED") return "ready";
  if (id === "DELIVERED") return "delivered";
  return "all";
}

export type KitchenStatusCounts = Record<KitchenStatusFilterId, number>;

/**
 * Teller statuschips fra rå statusverdier i valgt periode (+ evt. bedriftsfilter).
 * Raw uppercase equality — identisk semantikk som det tidligere DB-statusfilteret.
 * Endrer aldri filtreringslogikk; kun presentasjon.
 */
export function buildKitchenStatusCounts(rawStatuses: ReadonlyArray<string | null | undefined>): KitchenStatusCounts {
  const counts: KitchenStatusCounts = { "": 0, ACTIVE: 0, PREPARED: 0, DISPATCHED: 0, DELIVERED: 0 };
  for (const raw of Array.isArray(rawStatuses) ? rawStatuses : []) {
    const s = String(raw ?? "").trim().toUpperCase();
    counts[""] += 1;
    if (s === "ACTIVE" || s === "PREPARED" || s === "DISPATCHED" || s === "DELIVERED") {
      counts[s as Exclude<KitchenStatusFilterId, "">] += 1;
    }
  }
  return counts;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Locale-formatert dato for brukerrettet heading: «torsdag 11. juni 2026» (nb-NO).
 * Aldri rå ISO i output; ugyldig input gir tom streng (kalleren håndterer fallback).
 */
export function formatProviderOrdersDate(isoDate: string, locale?: string | null): string {
  const iso = String(isoDate ?? "").trim();
  if (!ISO_DATE_RE.test(iso)) return "";
  const resolvedLocale = String(locale ?? "").trim() || DEFAULT_PROVIDER_LOCALE;
  try {
    return new Intl.DateTimeFormat(resolvedLocale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Oslo",
    }).format(new Date(`${iso}T12:00:00Z`));
  } catch {
    return "";
  }
}

/** Range-variant for subheading; lik fra/til gir én dato. */
export function formatProviderOrdersDateRange(fromIso: string, toIso: string, locale?: string | null): string {
  const from = formatProviderOrdersDate(fromIso, locale);
  if (!from) return "";
  if (String(fromIso).trim() === String(toIso).trim()) return from;
  const to = formatProviderOrdersDate(toIso, locale);
  return to ? `${from} – ${to}` : from;
}

export type ProviderOrdersEmptyStepKey = "checkMenu" | "checkWeek" | "ordersAppear";

export type ProviderOrdersEmptyStateKeys = {
  titleKey: ProviderOrdersDateMode | "filtered";
  textKey: "default" | "filtered";
  stepKeys: readonly ProviderOrdersEmptyStepKey[];
};

const EMPTY_STEP_KEYS: readonly ProviderOrdersEmptyStepKey[] = ["checkMenu", "checkWeek", "ordersAppear"];

/**
 * Operasjonell empty state keys — rolig og hjelpsom, ingen alarm.
 * Aktivt statusfilter prioriteres (forklarer hvorfor listen kan være tom).
 */
export function providerOrdersEmptyStateKeys(
  dateMode: ProviderOrdersDateMode,
  hasStatusFilter: boolean,
): ProviderOrdersEmptyStateKeys {
  if (hasStatusFilter) {
    return {
      titleKey: "filtered",
      textKey: "filtered",
      stepKeys: EMPTY_STEP_KEYS,
    };
  }
  return {
    titleKey: dateMode,
    textKey: "default",
    stepKeys: EMPTY_STEP_KEYS,
  };
}
