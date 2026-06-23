// lib/providers/providerCustomersSurface.ts
// Provider-facing helpers for /leverandor/kunder (i18n keys + locale formatting).
//
// Prinsipp:
// - UI-copy lives in messages/provider.customers.* — this module exposes ids and keys only.
// - Konsekvent begrepsbruk: «bedrift» / «bedriftskunde» i provider-facing UI, aldri «firma».
// - Dato/tid er locale-formatert (provider_settings.locale når satt), aldri rå ISO i UI.
// - Ingen server-avhengigheter: brukes av både server page og client components.

import { DEFAULT_PROVIDER_LOCALE } from "@/lib/providers/operationalSettingsShared";
import type { ProviderCustomerFilter, ProviderCustomerStatus } from "@/lib/providers/customerTypes";

export const PROVIDER_CUSTOMER_FILTERS: ReadonlyArray<{ id: ProviderCustomerFilter }> = [
  { id: "all" },
  { id: "active" },
  { id: "paused" },
  { id: "suspended" },
  { id: "deleted" },
];

export function formatProviderCustomerCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.max(0, Math.floor(value)));
}

export type ProviderCustomerStatusCounts = Record<ProviderCustomerFilter, number>;

/**
 * Teller statuschips fra hele det (søk-filtrerte) datasettet — ingen ny query.
 * «Alle»-chipen teller kun ikke-slettede, identisk med hva «Alle»-visningen viser.
 */
export function buildCustomerStatusCounts(
  statuses: ReadonlyArray<ProviderCustomerStatus>,
): ProviderCustomerStatusCounts {
  const counts: ProviderCustomerStatusCounts = { all: 0, active: 0, paused: 0, suspended: 0, deleted: 0 };
  for (const status of Array.isArray(statuses) ? statuses : []) {
    if (status === "DELETED") {
      counts.deleted += 1;
      continue;
    }
    counts.all += 1;
    if (status === "ACTIVE") counts.active += 1;
    else if (status === "PAUSED") counts.paused += 1;
    else if (status === "SUSPENDED") counts.suspended += 1;
  }
  return counts;
}

/**
 * Locale-formatert «Sist oppdatert»-tidspunkt (Europe/Oslo).
 * Aldri rå ISO i UI; manglende/ugyldig verdi gir «—».
 */
export function formatProviderCustomerUpdated(iso: string | null | undefined, locale?: string | null): string {
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

export type ProviderCustomersEmptyStateKey = "noResults" | "noStatusMatch" | "noneYet";

export type ProviderCustomersEmptyStateKeys = {
  stateKey: ProviderCustomersEmptyStateKey;
  showCta: boolean;
};

export function providerCustomersEmptyStateKeys(input: {
  hasSearch: boolean;
  filter: ProviderCustomerFilter;
}): ProviderCustomersEmptyStateKeys {
  if (input.hasSearch) {
    return { stateKey: "noResults", showCta: false };
  }
  if (input.filter !== "all") {
    return { stateKey: "noStatusMatch", showCta: false };
  }
  return { stateKey: "noneYet", showCta: true };
}

export type ProviderCustomersPaginationSummary =
  | { kind: "single" }
  | { kind: "plural"; count: number }
  | { kind: "page"; currentPage: number; totalPages: number; totalCount: number };

export type ProviderCustomersPaginationModel = {
  showControls: boolean;
  prevDisabled: boolean;
  nextDisabled: boolean;
  summary: ProviderCustomersPaginationSummary;
};

/** Pagination-modell: rolig oppsummering ved én side, fulle kontroller ellers. */
export function buildCustomersPaginationModel(input: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
}): ProviderCustomersPaginationModel {
  const totalPages = Math.max(1, Math.floor(input.totalPages) || 1);
  const currentPage = Math.min(Math.max(1, Math.floor(input.currentPage) || 1), totalPages);
  const totalCount = Math.max(0, Math.floor(input.totalCount) || 0);

  if (totalPages <= 1) {
    return {
      showControls: false,
      prevDisabled: true,
      nextDisabled: true,
      summary: totalCount === 1 ? { kind: "single" } : { kind: "plural", count: totalCount },
    };
  }
  return {
    showControls: true,
    prevDisabled: currentPage <= 1,
    nextDisabled: currentPage >= totalPages,
    summary: { kind: "page", currentPage, totalPages, totalCount },
  };
}
