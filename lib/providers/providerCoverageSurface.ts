// lib/providers/providerCoverageSurface.ts
// Provider-facing copy og rene presentasjonshelpers for /leverandor/omrader.
//
// Prinsipp:
// - All ny copy samles her (én kilde, klar for senere i18n) — ingen spredte strenger.
// - Aldri rå enums/tekniske verdier i brukerrettet UI.
// - Dag-labels gjenbruker eksisterende WEEKDAY_LABELS (UI-mapping, lagrede verdier røres ikke).
// - Ingen server-avhengigheter: brukes av både server page og client components.

import { WEEKDAY_KEYS, WEEKDAY_LABELS, type WeekdayKey } from "@/lib/providers/serviceAreaShared";

export const PROVIDER_COVERAGE_COPY = {
  eyebrow: "Leverandør",
  heading: "Dekningsområder",
  cta: "Nytt dekningsområde",
  ctaTitle: "Legg til nytt dekningsområde for leverandøren.",
  readOnlyNote: "Du har lesetilgang. Endringer krever administratortilgang.",
  tableHeaders: {
    area: "Område",
    postalCodes: "Postnummer",
    minEmployees: "Min. ansatte",
    deliveryDays: "Leveringsdager",
    status: "Status",
  },
  actions: {
    edit: "Rediger",
    activate: "Aktiver",
    deactivate: "Deaktiver",
    deactivateTitle:
      "Nye bedrifter i dette området kan ikke velge leverandøren så lenge området er deaktivert. Eksisterende avtaler endres ikke automatisk.",
    activateTitle: "Gjør området tilgjengelig for nye bedriftsforespørsler igjen.",
  },
} as const;

export function providerCoverageSubheading(providerName: string): string {
  const name = String(providerName ?? "").trim();
  const lead = name
    ? `Dekningsområder styrer hvilke bedrifter som kan sende forespørsel til ${name}.`
    : "Dekningsområder styrer hvilke bedrifter som kan sende forespørsel til leverandøren.";
  return `${lead} Bruk områdene til å avgrense postnummer, minimum antall ansatte og leveringsdager.`;
}

/** Rolig summary over tabellen — beregnes fra hele resultatsettet (ingen pagination på flaten). */
export function providerCoverageSummary(rows: ReadonlyArray<{ active: boolean }>): string {
  const list = Array.isArray(rows) ? rows : [];
  const active = list.filter((r) => r.active === true).length;
  const inactive = list.length - active;
  const inactiveSuffix = inactive > 0 ? ` · ${inactive} inaktive` : "";

  if (active === 0) return `Ingen aktive dekningsområder${inactiveSuffix}`;
  if (active === 1) return `1 aktivt dekningsområde${inactiveSuffix}`;
  return `${active} aktive dekningsområder${inactiveSuffix}`;
}

/** Provider-safe statuslabel — aldri rå enum/teknisk verdi i UI. */
export function coverageStatusLabel(status: unknown): string {
  if (status === true) return "Aktiv";
  if (status === false) return "Inaktiv";
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "ACTIVE" || s === "TRUE") return "Aktiv";
  if (s === "INACTIVE" || s === "FALSE") return "Inaktiv";
  if (s === "PAUSED") return "Pauset";
  return "Ukjent";
}

const ALL_WEEKDAYS: ReadonlyArray<string> = WEEKDAY_KEYS;

/**
 * UI-labels for leveringsdager. Alle hverdager vises som «Mandag–fredag»,
 * ellers korte labels («Man, Ons, Fre»). Lagrede verdier røres ikke.
 */
export function formatCoverageDays(days: ReadonlyArray<string>): string {
  const normalized = (Array.isArray(days) ? days : []).map((d) => String(d ?? "").trim().toLowerCase());
  const known = WEEKDAY_KEYS.filter((k) => normalized.includes(k));
  if (known.length === 0) return "—";
  if (ALL_WEEKDAYS.every((k) => normalized.includes(k))) return "Mandag–fredag";
  return known.map((k) => WEEKDAY_LABELS[k as WeekdayKey]).join(", ");
}

/** Ansattekrav for området: «20+», «20–50», «≤50» eller «—». */
export function formatCoverageEmployees(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `${min}+`;
  if (max != null) return `≤${max}`;
  return "—";
}

export const PROVIDER_COVERAGE_EMPTY_STATE = {
  title: "Ingen dekningsområder ennå",
  text: "Legg til et dekningsområde for å styre hvilke bedrifter som kan sende forespørsel til leverandøren.",
  steps: [
    "Definer postnummer eller område.",
    "Sett minimum antall ansatte.",
    "Velg leveringsdager for området.",
  ],
} as const;
