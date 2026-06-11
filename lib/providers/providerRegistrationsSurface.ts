// lib/providers/providerRegistrationsSurface.ts
// Provider-facing copy og rene presentasjonshelpers for /leverandor/registreringer.
//
// Prinsipp:
// - All ny copy samles her (én kilde, klar for senere i18n) — ingen spredte strenger.
// - Aldri rå status-enums eller rå ISO-dato i brukerrettet UI.
// - Lover ikke e-post/onboarding-detaljer som flaten ikke viser.
// - Ingen server-avhengigheter: brukes av både server page og client components.

import { DEFAULT_PROVIDER_LOCALE } from "@/lib/providers/operationalSettingsShared";

export const PROVIDER_REGISTRATIONS_COPY = {
  eyebrow: "Leverandør",
  heading: "Bedriftsforespørsler",
  subheading:
    "Se nye bedrifter som ønsker lunsjordning, og vurder leveringsområde, kontaktinformasjon og ønsket avtale før behandling.",
  tableHeaders: {
    company: "Bedrift",
    area: "Område",
    contact: "Kontakt",
    employees: "Ansatte",
    received: "Mottatt",
    status: "Status",
  },
  reviewAction: "Vurder",
} as const;

/** Rolig statuslinje over tabellen — kun pending-rader lastes på denne flaten. */
export function providerRegistrationsSummary(pendingCount: number): string {
  const n = Math.max(0, Math.floor(pendingCount) || 0);
  if (n === 0) return "Ingen til behandling";
  if (n === 1) return "1 til behandling";
  return `${n} til behandling`;
}

/** Provider-safe statuslabels — aldri rå enum i UI. */
export function providerRegistrationStatusLabel(status: string): string {
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "PENDING") return "Til behandling";
  if (s === "APPROVED") return "Godkjent";
  if (s === "REJECTED") return "Avslått";
  return "Annet";
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

export const PROVIDER_REGISTRATIONS_EMPTY_STATE = {
  title: "Ingen forespørsler til behandling",
  text: "Nye bedriftsforespørsler vises her når de matcher ditt dekningsområde.",
  steps: [
    "Kontroller leveringssted, kontaktinformasjon og ønsket lunsjordning når en forespørsel kommer inn.",
    "Godkjente bedrifter flyttes videre til kunde- og avtaleflyt.",
    "Avslåtte forespørsler håndteres kontrollert med tydelig status.",
  ],
} as const;
