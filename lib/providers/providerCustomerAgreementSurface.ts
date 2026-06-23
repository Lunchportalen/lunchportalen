// lib/providers/providerCustomerAgreementSurface.ts
// Provider-facing helpers for agreement section on /leverandor/kunder/[id] — i18n via translator.

import { formatDeliveryAddress } from "@/lib/providers/providerCustomerBilling";

export type ProviderAgreementTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export type AgreementStatusLabelKey = "active" | "pending" | "paused" | "rejected" | "closed" | "unknown";

const AGREEMENT_STATUS_KEYS: Record<string, AgreementStatusLabelKey> = {
  ACTIVE: "active",
  PENDING: "pending",
  PAUSED: "paused",
  REJECTED: "rejected",
  CLOSED: "closed",
};

export function agreementStatusLabelKey(status: unknown): AgreementStatusLabelKey {
  const s = String(status ?? "").trim().toUpperCase();
  return AGREEMENT_STATUS_KEYS[s] ?? "unknown";
}

/** Provider-safe statuslabel — aldri rå enum i UI. */
export function agreementStatusLabel(status: unknown, t: ProviderAgreementTranslate): string {
  return t(`status.${agreementStatusLabelKey(status)}`);
}

export type AgreementStatusTone = "success" | "neutral" | "warning";

export function agreementStatusTone(status: unknown): AgreementStatusTone {
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "success";
  if (s === "PAUSED") return "warning";
  return "neutral";
}

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri"] as const;
type WeekdayKey = (typeof WEEKDAY_ORDER)[number];
const WEEKEND_KEYS = new Set(["sat", "sun", "lørdag", "lordag", "søndag", "sondag", "saturday", "sunday"]);

export type AgreementDeliveryDaysDisplay = {
  label: string;
  warning: string | null;
};

export function agreementDeliveryDaysDisplay(
  days: unknown,
  t: ProviderAgreementTranslate,
): AgreementDeliveryDaysDisplay {
  const normalized = (Array.isArray(days) ? days : [])
    .map((d) => String(d ?? "").trim().toLowerCase())
    .filter(Boolean);

  const hasWeekend = normalized.some((d) => WEEKEND_KEYS.has(d));
  const weekdays = WEEKDAY_ORDER.filter((k) => normalized.includes(k));
  const warning = hasWeekend ? t("deliveryDaysWarning") : null;
  const notSpecified = t("notSpecified");

  if (weekdays.length === 0) {
    return { label: notSpecified, warning };
  }
  if (weekdays.length === WEEKDAY_ORDER.length) {
    return { label: t("weekdaysRange"), warning };
  }
  return {
    label: weekdays.map((k) => t(`weekdays.${k}`)).join(", "),
    warning,
  };
}

const TIER_LABELS: Record<string, string> = {
  BASIS: "Basis",
  LUXUS: "Luxus",
  ENTERPRISE: "Enterprise",
};

/** Avtalenivå fra data — kontraktnavn, ikke UI-oversettelse. */
export function agreementTierLabel(tier: unknown, t: ProviderAgreementTranslate): string {
  const raw = String(tier ?? "").trim().toUpperCase();
  if (!raw) return t("packageMissing");
  return TIER_LABELS[raw] ?? t("packageMissing");
}

const KNOWN_TIERS = new Set(["BASIS", "LUXUS", "ENTERPRISE"]);

export function agreementPackageLabel(
  dayMenus: ReadonlyArray<{ day: string; plan: string }> | null | undefined,
  fallbackTier: unknown,
  t: ProviderAgreementTranslate,
): string {
  const menus = Array.isArray(dayMenus) ? dayMenus : [];
  const activePlans = menus
    .map((m) => safeStr(m.plan).toUpperCase())
    .filter((p) => KNOWN_TIERS.has(p));

  if (activePlans.length > 0) {
    const unique = new Set(activePlans);
    if (unique.size > 1) return t("packageMix");
    return agreementTierLabel(activePlans[0], t);
  }

  return agreementTierLabel(fallbackTier, t);
}

export function agreementPackageIsMissing(
  dayMenus: ReadonlyArray<{ day: string; plan: string }> | null | undefined,
  fallbackTier: unknown,
): boolean {
  const menus = Array.isArray(dayMenus) ? dayMenus : [];
  const activePlans = menus
    .map((m) => safeStr(m.plan).toUpperCase())
    .filter((p) => KNOWN_TIERS.has(p));
  if (activePlans.length > 0) return false;
  const raw = String(fallbackTier ?? "").trim().toUpperCase();
  return !raw || !KNOWN_TIERS.has(raw);
}

export function formatAgreementDate(iso: unknown, locale = "nb-NO"): string | null {
  const raw = String(iso ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
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
  packageIsMissing: boolean;
};

export type AgreementLocationLookup = ReadonlyArray<{ id: string; name: string; address: string | null }>;

export function agreementLocationLabel(
  locationId: string | null | undefined,
  locations: AgreementLocationLookup,
  t: ProviderAgreementTranslate,
): string {
  const id = String(locationId ?? "").trim();
  const list = Array.isArray(locations) ? locations : [];
  const locationMissing = t("locationMissing");

  if (id) {
    const match = list.find((l) => l.id === id);
    if (match) {
      return formatDeliveryAddress({
        locationName: match.name,
        locationAddress: match.address,
      });
    }
  }

  if (!id && list.length === 1) {
    const only = list[0];
    const label = formatDeliveryAddress({
      locationName: only.name,
      locationAddress: only.address,
    });
    if (label !== locationMissing) return label;
  }

  return locationMissing;
}

function dayMenusDisplay(
  deliveryDays: unknown,
  dayMenus: ReadonlyArray<{ day: string; plan: string }> | null | undefined,
  fallbackTier: unknown,
  t: ProviderAgreementTranslate,
): { label: string; lines: string[] } {
  const menus = Array.isArray(dayMenus) ? dayMenus : [];
  const notSpecified = t("notSpecified");
  const weekdaysRange = t("weekdaysRange");

  if (menus.length > 0) {
    const lines = WEEKDAY_ORDER.filter((k) => menus.some((m) => safeStr(m.day).toLowerCase() === k)).map((k) => {
      const match = menus.find((m) => safeStr(m.day).toLowerCase() === k);
      const plan = agreementTierLabel(match?.plan ?? fallbackTier, t);
      return t("dayMenuLine", { day: t(`weekdays.${k}`), plan });
    });
    if (lines.length > 0) {
      return { label: lines.join(", "), lines };
    }
  }

  const days = agreementDeliveryDaysDisplay(deliveryDays, t);
  const tier = agreementTierLabel(fallbackTier, t);
  if (days.label === weekdaysRange) {
    return { label: t("dayMenusWeekdaysTier", { tier }), lines: [t("dayMenusWeekdaysTierLine", { tier })] };
  }
  if (days.label !== notSpecified) {
    return { label: t("dayMenusDaysTier", { days: days.label, tier }), lines: [t("dayMenusDaysTierLine", { days: days.label, tier })] };
  }
  return { label: notSpecified, lines: [] };
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export function buildAgreementDisplay(
  row: ProviderAgreementSourceRow,
  locations: AgreementLocationLookup,
  t: ProviderAgreementTranslate,
  dateLocale = "nb-NO",
): ProviderAgreementDisplay {
  const status = String(row.status ?? "").trim().toUpperCase();
  const days = agreementDeliveryDaysDisplay(row.deliveryDays, t);
  const menu = dayMenusDisplay(row.deliveryDays, row.dayMenus, row.tier, t);
  const created = formatAgreementDate(row.createdAt, dateLocale);
  const starts = formatAgreementDate(row.startsAt, dateLocale);
  const ends = formatAgreementDate(row.endsAt, dateLocale);
  const notSpecified = t("notSpecified");

  let periodLabel: string | null = null;
  if (starts && ends) periodLabel = t("periodFromTo", { from: starts, to: ends });
  else if (starts) periodLabel = t("periodFromOpen", { from: starts });

  const packageLabel = agreementPackageLabel(row.dayMenus, row.tier, t);

  return {
    id: row.id,
    title: status === "ACTIVE" ? t("activeTitle") : t("inactiveTitle"),
    statusLabel: agreementStatusLabel(status, t),
    statusTone: agreementStatusTone(status),
    createdLabel: created ? t("createdAt", { date: created }) : notSpecified,
    periodLabel,
    deliveryDaysLabel: days.label,
    deliveryDaysWarning: days.warning,
    dayMenusLabel: menu.label,
    dayMenusLines: menu.lines,
    locationLabel: agreementLocationLabel(row.locationId, locations, t),
    packageLabel,
    packageIsMissing: agreementPackageIsMissing(row.dayMenus, row.tier),
  };
}

export function sortAgreementsForDisplay<T extends { status: string }>(rows: ReadonlyArray<T>): T[] {
  const list = Array.isArray(rows) ? [...rows] : [];
  return list.sort((a, b) => {
    const aActive = String(a.status ?? "").toUpperCase() === "ACTIVE" ? 0 : 1;
    const bActive = String(b.status ?? "").toUpperCase() === "ACTIVE" ? 0 : 1;
    return aActive - bActive;
  });
}

export function hasMultipleActiveAgreements(rows: ReadonlyArray<{ status: string }>): boolean {
  const active = (Array.isArray(rows) ? rows : []).filter(
    (r) => String(r.status ?? "").toUpperCase() === "ACTIVE",
  );
  return active.length > 1;
}

export type ProviderAgreementEmptyKey = "title" | "text";

export const PROVIDER_AGREEMENT_EMPTY_KEYS: readonly ProviderAgreementEmptyKey[] = ["title", "text"];

export const PROVIDER_AGREEMENT_LABEL_KEYS = [
  "status",
  "created",
  "period",
  "deliveryDays",
  "dayMenus",
  "location",
  "package",
] as const;
