// lib/providers/providerCustomerAgreementSurface.ts
// Provider-facing copy og ren displaymodell for avtaleseksjonen på /leverandor/kunder/[id].

import { formatDeliveryAddress } from "@/lib/providers/providerCustomerBilling";
//
// Domeneregler:
// - 1 kunde = 1 aktiv kundeavtale; dager/lokasjon/nivå er detaljer UNDER avtalen.
// - Lunchportalen har kun lunsjlevering mandag–fredag. Lørdag/søndag vises aldri
//   som ordinær leveringsdag — helgedager i data gir kontrollert avvikstekst.
// - Aldri rå enum eller rå ISO i brukerrettet UI; ærlige fallbacks når data mangler.
// - Ingen server-avhengigheter: brukes av client component, ren og testbar.

export const PROVIDER_AGREEMENT_COPY = {
  sectionTitle: "Avtale",
  activeTitle: "Aktiv kundeavtale",
  inactiveTitle: "Kundeavtale",
  labels: {
    status: "Status",
    created: "Opprettet",
    period: "Avtaleperiode",
    deliveryDays: "Leveringsdager",
    dayMenus: "Leveringsdager og meny",
    location: "Leveringsadresse",
    package: "Avtalenivå",
  },
  deliveryDaysWarning: "Avtalen inneholder leveringsdager utenfor ordinær lunsjlevering.",
  multipleActiveWarning: "Flere aktive avtaler er registrert for denne kunden.",
  packageMissing: "Ikke spesifisert i avtalevisningen ennå",
  locationMissing: "Leveringsadresse ikke satt",
  notSpecified: "Ikke spesifisert",
  noEndDate: "Ingen sluttdato",
  empty: {
    title: "Ingen avtale registrert",
    text: "Når en kundeavtale er godkjent, vises leveringsdager, lokasjon og avtaleinnhold her.",
  },
} as const;

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv",
  PENDING: "Til behandling",
  PAUSED: "Pauset",
  REJECTED: "Avslått",
  CLOSED: "Avsluttet",
};

/** Provider-safe statuslabel — aldri rå enum i UI. */
export function agreementStatusLabel(status: unknown): string {
  const s = String(status ?? "").trim().toUpperCase();
  return STATUS_LABELS[s] ?? "Ukjent";
}

export type AgreementStatusTone = "success" | "neutral" | "warning";

export function agreementStatusTone(status: unknown): AgreementStatusTone {
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "success";
  if (s === "PAUSED") return "warning";
  return "neutral";
}

// Kun hverdager er gyldige leveringsdager i Lunchportalen-lunsjavtaler.
const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri"] as const;
const WEEKDAY_FULL_LABELS: Record<(typeof WEEKDAY_ORDER)[number], string> = {
  mon: "Mandag",
  tue: "Tirsdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
};
const WEEKEND_KEYS = new Set(["sat", "sun", "lørdag", "lordag", "søndag", "sondag", "saturday", "sunday"]);

export type AgreementDeliveryDaysDisplay = {
  label: string;
  warning: string | null;
};

/**
 * UI-visning av leveringsdager innenfor domenegrensen mandag–fredag.
 * Helgedager i data fjernes fra ordinær liste og gir kontrollert avvikstekst.
 */
export function agreementDeliveryDaysDisplay(days: unknown): AgreementDeliveryDaysDisplay {
  const normalized = (Array.isArray(days) ? days : [])
    .map((d) => String(d ?? "").trim().toLowerCase())
    .filter(Boolean);

  const hasWeekend = normalized.some((d) => WEEKEND_KEYS.has(d));
  const weekdays = WEEKDAY_ORDER.filter((k) => normalized.includes(k));
  const warning = hasWeekend ? PROVIDER_AGREEMENT_COPY.deliveryDaysWarning : null;

  if (weekdays.length === 0) {
    return { label: PROVIDER_AGREEMENT_COPY.notSpecified, warning };
  }
  if (weekdays.length === WEEKDAY_ORDER.length) {
    return { label: "Mandag–fredag", warning };
  }
  return { label: weekdays.map((k) => WEEKDAY_FULL_LABELS[k]).join(", "), warning };
}

const TIER_LABELS: Record<string, string> = {
  BASIS: "Basis",
  LUXUS: "Luxus",
  ENTERPRISE: "Enterprise",
};

/** Avtalenivå fra data — aldri fake nivå hvis felt mangler/er ukjent. */
export function agreementTierLabel(tier: unknown): string {
  const t = String(tier ?? "").trim().toUpperCase();
  if (!t) return PROVIDER_AGREEMENT_COPY.packageMissing;
  return TIER_LABELS[t] ?? PROVIDER_AGREEMENT_COPY.packageMissing;
}

const KNOWN_TIERS = new Set(["BASIS", "LUXUS", "ENTERPRISE"]);

/**
 * Avtalenivå for kortvisning: utledes fra aktive dayMenus når de finnes.
 * Flere ulike nivå → Mix. Ett nivå → Basis/Luxus/Enterprise. Uten dayMenus → agreements.tier.
 */
export function agreementPackageLabel(
  dayMenus: ReadonlyArray<{ day: string; plan: string }> | null | undefined,
  fallbackTier: unknown,
): string {
  const menus = Array.isArray(dayMenus) ? dayMenus : [];
  const activePlans = menus
    .map((m) => safeStr(m.plan).toUpperCase())
    .filter((p) => KNOWN_TIERS.has(p));

  if (activePlans.length > 0) {
    const unique = new Set(activePlans);
    if (unique.size > 1) return "Mix";
    return agreementTierLabel(activePlans[0]);
  }

  return agreementTierLabel(fallbackTier);
}

/** Locale-formatert dato («10. mai 2026») — aldri rå ISO i UI. */
export function formatAgreementDate(iso: unknown): string | null {
  const raw = String(iso ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  }).format(date);
}

export type ProviderAgreementSourceRow = {
  id: string;
  status: string;
  createdAt: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  deliveryDays?: string[] | null;
  dayMenus?: ReadonlyArray<{ day: string; plan: string }> | null;
  locationId?: string | null;
  tier?: string | null;
};

export type ProviderAgreementDisplay = {
  id: string;
  title: string;
  statusLabel: string;
  statusTone: AgreementStatusTone;
  createdLabel: string;
  periodLabel: string | null;
  deliveryDaysLabel: string;
  deliveryDaysWarning: string | null;
  dayMenusLabel: string;
  dayMenusLines: string[];
  locationLabel: string;
  packageLabel: string;
};

export type AgreementLocationLookup = ReadonlyArray<{ id: string; name: string; address: string | null }>;

function locationLabelFor(locationId: string | null | undefined, locations: AgreementLocationLookup): string {
  const id = String(locationId ?? "").trim();
  if (!id) return PROVIDER_AGREEMENT_COPY.locationMissing;
  const match = (Array.isArray(locations) ? locations : []).find((l) => l.id === id);
  if (!match) return PROVIDER_AGREEMENT_COPY.locationMissing;
  return formatDeliveryAddress({
    locationName: match.name,
    locationAddress: match.address,
  });
}

function dayMenusDisplay(
  deliveryDays: unknown,
  dayMenus: ReadonlyArray<{ day: string; plan: string }> | null | undefined,
  fallbackTier: unknown,
): { label: string; lines: string[] } {
  const menus = Array.isArray(dayMenus) ? dayMenus : [];
  if (menus.length > 0) {
    const lines = WEEKDAY_ORDER.filter((k) => menus.some((m) => safeStr(m.day).toLowerCase() === k)).map((k) => {
      const match = menus.find((m) => safeStr(m.day).toLowerCase() === k);
      const plan = agreementTierLabel(match?.plan ?? fallbackTier);
      return `${WEEKDAY_FULL_LABELS[k]} · ${plan}`;
    });
    if (lines.length > 0) {
      return { label: lines.join(", "), lines };
    }
  }

  const days = agreementDeliveryDaysDisplay(deliveryDays);
  const tier = agreementTierLabel(fallbackTier);
  if (days.label === "Mandag–fredag") {
    return { label: `Mandag–fredag · ${tier}`, lines: [`Mandag–fredag: ${tier}`] };
  }
  if (days.label !== PROVIDER_AGREEMENT_COPY.notSpecified) {
    return { label: `${days.label} · ${tier}`, lines: [`${days.label}: ${tier}`] };
  }
  return { label: PROVIDER_AGREEMENT_COPY.notSpecified, lines: [] };
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/** Bygger provider-safe displaymodell for ett avtale-kort. */
export function buildAgreementDisplay(
  row: ProviderAgreementSourceRow,
  locations: AgreementLocationLookup = [],
): ProviderAgreementDisplay {
  const status = String(row.status ?? "").trim().toUpperCase();
  const days = agreementDeliveryDaysDisplay(row.deliveryDays);
  const menu = dayMenusDisplay(row.deliveryDays, row.dayMenus, row.tier);
  const created = formatAgreementDate(row.createdAt);
  const starts = formatAgreementDate(row.startsAt);
  const ends = formatAgreementDate(row.endsAt);

  let periodLabel: string | null = null;
  if (starts && ends) periodLabel = `Fra ${starts} til ${ends}`;
  else if (starts) periodLabel = `Fra ${starts} · ${PROVIDER_AGREEMENT_COPY.noEndDate}`;

  return {
    id: row.id,
    title: status === "ACTIVE" ? PROVIDER_AGREEMENT_COPY.activeTitle : PROVIDER_AGREEMENT_COPY.inactiveTitle,
    statusLabel: agreementStatusLabel(status),
    statusTone: agreementStatusTone(status),
    createdLabel: created ? `Opprettet ${created}` : PROVIDER_AGREEMENT_COPY.notSpecified,
    periodLabel,
    deliveryDaysLabel: days.label,
    deliveryDaysWarning: days.warning,
    dayMenusLabel: menu.label,
    dayMenusLines: menu.lines,
    locationLabel: locationLabelFor(row.locationId, locations),
    packageLabel: agreementPackageLabel(row.dayMenus, row.tier),
  };
}

/** Aktive avtaler først; ellers bevares eksisterende rekkefølge (nyeste først fra loader). */
export function sortAgreementsForDisplay<T extends { status: string }>(rows: ReadonlyArray<T>): T[] {
  const list = Array.isArray(rows) ? [...rows] : [];
  return list.sort((a, b) => {
    const aActive = String(a.status ?? "").toUpperCase() === "ACTIVE" ? 0 : 1;
    const bActive = String(b.status ?? "").toUpperCase() === "ACTIVE" ? 0 : 1;
    return aActive - bActive;
  });
}

/** True når flere aktive avtaler finnes for samme kunde (skal normalt ikke skje). */
export function hasMultipleActiveAgreements(rows: ReadonlyArray<{ status: string }>): boolean {
  const active = (Array.isArray(rows) ? rows : []).filter(
    (r) => String(r.status ?? "").toUpperCase() === "ACTIVE",
  );
  return active.length > 1;
}
