// lib/providers/providerCustomersSurface.ts
// Provider-facing copy og rene presentasjonshelpers for /leverandor/kunder.
//
// Prinsipp:
// - All ny copy samles her (én kilde, klar for senere i18n) — ingen spredte strenger.
// - Konsekvent begrepsbruk: «bedrift» / «bedriftskunde» i provider-facing UI, aldri «firma».
// - Dato/tid er locale-formatert (provider_settings.locale når satt), aldri rå ISO i UI.
// - Ingen server-avhengigheter: brukes av både server page og client components.

import { DEFAULT_PROVIDER_LOCALE } from "@/lib/providers/operationalSettingsShared";
import type { ProviderCustomerFilter, ProviderCustomerStatus } from "@/lib/providers/customerTypes";

export const PROVIDER_CUSTOMERS_COPY = {
  eyebrow: "Leverandør",
  heading: "Bedrifter",
  searchLabel: "Søk",
  searchPlaceholder: "Søk etter bedriftsnavn",
  statusGroupAria: "Statusfilter",
  cta: "Ny bedriftskunde",
  ctaTitle: "Nye bedriftskunder kommer inn via kontrollert registrering.",
  tableHeaders: {
    name: "Bedrift",
    orgnr: "Org.nr",
    status: "Status",
    employees: "Ansatte",
    ordersThisWeek: "Ordre denne uken",
    invoice: "Faktura",
    lastUpdated: "Sist oppdatert",
  },
  mobileMeta: (employees: number, orders: number, invoice: string) =>
    `${employees} ansatte · ${orders} ordre denne uken · Faktura: ${invoice}`,
  mobileUpdatedPrefix: "Sist oppdatert",
  paginationAria: "Paginering",
  paginationPrev: "Forrige",
  paginationNext: "Neste",
} as const;

export function providerCustomersSubheading(providerName: string): string {
  const name = String(providerName ?? "").trim();
  return name
    ? `Administrer bedriftskunder, avtaler og leveringsoppsett for ${name}.`
    : "Administrer bedriftskunder, avtaler og leveringsoppsett.";
}

export const PROVIDER_CUSTOMER_FILTERS: ReadonlyArray<{ id: ProviderCustomerFilter; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "active", label: "Aktive" },
  { id: "paused", label: "Pauset" },
  { id: "suspended", label: "Suspendert" },
  { id: "deleted", label: "Slettet" },
];

export type ProviderCustomerStatusCounts = Record<ProviderCustomerFilter, number>;

/**
 * Teller statuschips fra hele det (søk-filtrerte) datasettet — ingen ny query.
 * «Alle»-chipen teller kun ikke-slettede, identisk med hva «Alle»-visningen viser.
 * Endrer aldri filtreringssemantikk; kun presentasjon.
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

export type ProviderCustomersEmptyState = {
  title: string;
  text: string;
  showCta: boolean;
};

/**
 * Rolig, hjelpsom empty state — skiller mellom søk uten treff,
 * statusfilter uten treff og «ingen bedrifter ennå».
 */
export function providerCustomersEmptyState(input: {
  hasSearch: boolean;
  filter: ProviderCustomerFilter;
}): ProviderCustomersEmptyState {
  if (input.hasSearch) {
    return {
      title: "Ingen treff",
      text: "Prøv et annet bedriftsnavn eller fjern filteret.",
      showCta: false,
    };
  }
  if (input.filter !== "all") {
    return {
      title: "Ingen bedrifter med valgt status",
      text: "Endre statusfilteret for å se flere bedriftskunder.",
      showCta: false,
    };
  }
  return {
    title: "Ingen bedrifter ennå",
    text: "Når bedriftskunder er registrert og godkjent, vises de her med status, avtaler og ordregrunnlag.",
    showCta: true,
  };
}

export type ProviderCustomersPaginationModel = {
  /** Forrige/Neste vises kun når det finnes flere sider. */
  showControls: boolean;
  prevDisabled: boolean;
  nextDisabled: boolean;
  summary: string;
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
      summary: totalCount === 1 ? "1 bedrift" : `${totalCount} bedrifter`,
    };
  }
  return {
    showControls: true,
    prevDisabled: currentPage <= 1,
    nextDisabled: currentPage >= totalPages,
    summary: `Side ${currentPage} av ${totalPages} (${totalCount} totalt)`,
  };
}
