// lib/providers/providerOrdersSurface.ts
// Provider-facing copy og rene presentasjonshelpers for /leverandor/ordrer.
//
// Prinsipp:
// - All ny copy samles her (én kilde, klar for senere i18n) — ingen spredte strenger.
// - Datoer i brukerrettet UI er locale-formatert (provider_settings.locale når satt),
//   aldri rå ISO. Backend/URL-params beholder ISO.
// - Ingen server-avhengigheter: brukes av både server page og client components.

import { DEFAULT_PROVIDER_LOCALE } from "@/lib/providers/operationalSettingsShared";

export type ProviderOrdersDateMode = "today" | "tomorrow" | "week";

export const PROVIDER_ORDERS_COPY = {
  eyebrow: "Ordre og produksjon",
  heading: "Ordrer",
  dateGroupAria: "Periode",
  statusGroupAria: "Status",
  groupingAria: "Gruppering",
  companyFilterLabel: "Bedrift",
  companyFilterAll: "Alle bedrifter",
  companyFilterAria: "Filtrer på bedrift",
  groupByCompany: "Per bedrift",
  groupByTime: "Per tid",
  deliveryGroupPrefix: "Levering",
  readOnlyNote: "Kun visning — du har lesetilgang til ordrene.",
} as const;

export const PROVIDER_ORDERS_DATE_MODES: ReadonlyArray<{ id: ProviderOrdersDateMode; label: string }> = [
  { id: "today", label: "I dag" },
  { id: "tomorrow", label: "I morgen" },
  { id: "week", label: "Hele uken" },
];

export type KitchenStatusFilterId = "" | "ACTIVE" | "PREPARED" | "DISPATCHED" | "DELIVERED";

/** Statuschips — samme id-semantikk som tidligere DB-filter (raw uppercase equality). */
export const PROVIDER_ORDERS_STATUS_FILTERS: ReadonlyArray<{ id: KitchenStatusFilterId; label: string }> = [
  { id: "", label: "Alle" },
  { id: "ACTIVE", label: "Mottatt" },
  { id: "PREPARED", label: "Produksjon" },
  { id: "DISPATCHED", label: "Klar" },
  { id: "DELIVERED", label: "Levert" },
];

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

export type ProviderOrdersEmptyState = {
  title: string;
  text: string;
  steps: ReadonlyArray<string>;
};

const EMPTY_TITLES: Record<ProviderOrdersDateMode, string> = {
  today: "Ingen ordre for i dag",
  tomorrow: "Ingen ordre for i morgen",
  week: "Ingen ordre denne uken",
};

const EMPTY_STEPS: ReadonlyArray<string> = [
  "Kontroller at menyen er publisert for aktuelle dager.",
  "Se hele uken hvis du vil kontrollere kommende leveranser.",
  "Nye bestillinger vises her som produksjonsgrunnlag etter hvert som de kommer inn.",
];

/**
 * Operasjonell empty state — rolig og hjelpsom, ingen alarm.
 * Aktivt statusfilter prioriteres (forklarer hvorfor listen kan være tom).
 */
export function providerOrdersEmptyState(
  dateMode: ProviderOrdersDateMode,
  hasStatusFilter: boolean,
): ProviderOrdersEmptyState {
  if (hasStatusFilter) {
    return {
      title: "Ingen ordre med valgt status",
      text: "Det finnes ingen ordre med valgt status i valgt periode. Velg «Alle» for å se alle ordre i perioden.",
      steps: EMPTY_STEPS,
    };
  }
  return {
    title: EMPTY_TITLES[dateMode] ?? EMPTY_TITLES.today,
    text: "Det finnes ingen aktive bestillinger for valgt periode.",
    steps: EMPTY_STEPS,
  };
}
