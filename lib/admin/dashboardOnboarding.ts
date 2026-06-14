import type { AdminKpi } from "@/app/admin/page-sections/KpiRow";
import type { ActivityFeedItem } from "@/app/admin/page-sections/ActivityFeed";
import type { SystemStatusRow } from "@/app/admin/page-sections/SystemStatus";
import type { TodayRosterItem } from "@/app/admin/page-sections/TodayRoster";
import type { AgreementStatusResult } from "@/lib/auth/agreementStatus";
import { formatAgreementSystemLabel } from "@/lib/admin/agreementLabel";
import type { CompanyOperationalBrief } from "@/lib/server/admin/loadCompanyOperationalBrief";
import type { DayKey } from "@/lib/agreements/normalize";

export const INVITE_EMPLOYEES_HREF = "/admin/invite";
export const AGREEMENT_HREF = "/admin/agreement";

export type OnboardingChecklistStep = {
  label: string;
  detail: string;
  state: "completed" | "current" | "pending" | "info";
};

export type ReadinessStripItem = {
  label: string;
  value: string;
  kind: "ready" | "action" | "pending" | "neutral";
};

export type DashboardBuildInput = {
  companyName: string;
  providerName: string | null;
  ehfEnabled: boolean;
  employeesActive: number;
  employeesTotal: number;
  ordersTodayActive: number;
  ordersWeekActive: number;
  orderCountToday: number;
  agreementStatus: AgreementStatusResult;
  operationalBrief: CompanyOperationalBrief;
};

const DAY_NB: Record<DayKey, string> = {
  mon: "Mandag",
  tue: "Tirsdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
};

const WEEKDAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

export function isOnboardingMode(employeesActive: number): boolean {
  return employeesActive <= 0;
}

export function formatDeliveryDaysLabel(dayKeys: DayKey[]): string {
  if (dayKeys.length === 0) return "Ikke satt";
  if (dayKeys.length === 5 && WEEKDAY_KEYS.every((key) => dayKeys.includes(key))) {
    return "Mandag–fredag";
  }
  return dayKeys.map((key) => DAY_NB[key] ?? key).join(", ");
}

export function formatProviderLabel(providerName: string | null): string {
  const name = safeTrim(providerName);
  return name || "Leverandør fra avtale";
}

export function buildHeroHeading(companyName: string, onboarding: boolean): string {
  const name = safeTrim(companyName);
  if (onboarding) {
    return name ? `${name} er klar for firmalunsj` : "Bedriften er klar for firmalunsj";
  }
  return name ? `Dagens drift for ${name}` : "Dagens drift";
}

export function buildHeroSubtext(onboarding: boolean): string {
  if (onboarding) {
    return "Avtalen er aktiv. Inviter ansatte for å åpne første bestillingsrunde.";
  }
  return "Operativ oversikt over bestillinger, ansatte og levering.";
}

export function cutoffFootUser(cutoff: string): string {
  if (cutoff === "TODAY_LOCKED") return "Cut-off 08:00 er passert";
  if (cutoff === "TODAY_OPEN") return "Bestilling åpen frem til 08:00";
  if (cutoff === "FUTURE_OPEN") return "Fremtidig leveringsdag";
  return "Dagen er låst";
}

export function formatDashboardBillingLabel(input: {
  employeesActive: number;
  billingHold: boolean;
  ehfEnabled: boolean;
}): { value: string; kind: SystemStatusRow["kind"] } {
  if (input.billingHold) {
    return { value: "Må kontrolleres før fakturering", kind: "warn" };
  }
  if (input.ehfEnabled) {
    return { value: "EHF klargjort", kind: "ok" };
  }
  if (input.employeesActive <= 0) {
    return { value: "Håndteres etter avtale", kind: "neutral" };
  }
  return { value: "Fakturering følger avtalen", kind: "neutral" };
}

export type ChartEmptyVariant = "onboarding" | "waiting_orders" | null;

export function resolveChartEmptyVariant(input: {
  employeesActive: number;
  ordersWeekActive: number;
  orderCountToday: number;
}): ChartEmptyVariant {
  if (isOnboardingMode(input.employeesActive)) return "onboarding";
  if (input.ordersWeekActive <= 0 && input.orderCountToday <= 0) return "waiting_orders";
  return null;
}

export function buildOnboardingChecklist(input: {
  employeesActive: number;
  ordersWeekActive: number;
  orderCountToday: number;
  providerName: string | null;
}): OnboardingChecklistStep[] {
  const hasEmployees = input.employeesActive > 0;
  const hasOrders = input.ordersWeekActive > 0 || input.orderCountToday > 0;
  const provider = formatProviderLabel(input.providerName);

  return [
    {
      label: "Avtale aktiv",
      detail: "Avtalen er godkjent og aktiv.",
      state: "completed",
    },
    {
      label: "Inviter første ansatte",
      detail: "Legg til ansatte som skal bestille lunsj.",
      state: hasEmployees ? "completed" : "current",
    },
    {
      label: "Ansatte logger inn og velger lunsj",
      detail: "Ansatte bestiller fra ukemenyen før cut-off kl. 08:00.",
      state: hasOrders ? "completed" : hasEmployees ? "current" : "pending",
    },
    {
      label: `${provider} ser bestillingene`,
      detail: "Leverandøren forbereder produksjon i leverandørportalen.",
      state: hasOrders ? "current" : "pending",
    },
    {
      label: "Første uke overvåkes manuelt",
      detail: "Lunchportalen og leverandøren følger med på første bestillingsrunde.",
      state: "info",
    },
  ];
}

export function buildReadinessStrip(input: DashboardBuildInput): ReadinessStripItem[] {
  const onboarding = isOnboardingMode(input.employeesActive);
  const deliveryDays = formatDeliveryDaysLabel(input.operationalBrief.operative_day_keys);
  const agreementLabel = formatAgreementSystemLabel(input.agreementStatus);
  const provider = formatProviderLabel(input.providerName);

  return [
    { label: "Avtale", value: agreementLabel, kind: input.agreementStatus.isActive ? "ready" : "action" },
    { label: "Leverandør", value: provider, kind: input.providerName ? "ready" : "neutral" },
    { label: "Leveringsdager", value: deliveryDays, kind: input.operationalBrief.operative_day_keys.length ? "ready" : "action" },
    { label: "Cut-off", value: "08:00", kind: "ready" },
    {
      label: "Ansatte",
      value: onboarding ? "0 lagt til" : `${input.employeesActive} aktive`,
      kind: onboarding ? "action" : "ready",
    },
    {
      label: "Første ordre",
      value: onboarding
        ? "Venter på ansatte"
        : input.ordersWeekActive > 0 || input.orderCountToday > 0
          ? "Registrert"
          : "Venter på bestilling",
      kind: onboarding || (input.ordersWeekActive <= 0 && input.orderCountToday <= 0) ? "pending" : "ready",
    },
  ];
}

export function buildDashboardKpis(input: DashboardBuildInput): AdminKpi[] {
  const onboarding = isOnboardingMode(input.employeesActive);
  const deliveryDays = formatDeliveryDaysLabel(input.operationalBrief.operative_day_keys);
  const cutoff = cutoffFootUser(input.operationalBrief.cutoff_today);

  if (onboarding) {
    return [
      {
        label: "Ansatte",
        value: "0",
        foot: "Inviter ansatte for å åpne bestilling.",
        href: INVITE_EMPLOYEES_HREF,
        ctaLabel: "Inviter ansatte",
      },
      {
        label: "Bestilling",
        value: "Venter",
        foot: "Venter på ansatte",
      },
      {
        label: "Denne uken",
        value: "—",
        foot: "Klar når ansatte er lagt til",
      },
      {
        label: "Neste levering",
        value: deliveryDays,
        foot: `${deliveryDays} etter avtale`,
      },
    ];
  }

  const adoptionPercent =
    input.employeesActive > 0
      ? `${Math.round((input.orderCountToday / input.employeesActive) * 100)}%`
      : "0%";

  return [
    {
      label: "Ansatte",
      value: String(input.employeesActive),
      foot: `${input.employeesActive} aktive`,
    },
    {
      label: "Bestillinger i dag",
      value: String(input.orderCountToday),
      foot:
        input.operationalBrief.cutoff_today === "TODAY_LOCKED"
          ? "Cut-off 08:00 er passert"
          : cutoff,
    },
    {
      label: "Denne uken",
      value: String(input.ordersWeekActive),
      foot:
        input.ordersWeekActive > 0
          ? `${input.ordersWeekActive} bestillinger denne uken`
          : "Ingen bestillinger registrert ennå",
    },
    {
      label: "Adopsjon",
      value: adoptionPercent,
      foot: "Av aktive ansatte i dag",
      trend: { label: "i dag", kind: "neutral" },
    },
    {
      label: "Neste levering",
      value: deliveryDays,
      foot: input.operationalBrief.ledger_delivery_window_nb
        ? `Leveringsvindu ${input.operationalBrief.ledger_delivery_window_nb}`
        : "Leveringsdager fra avtale",
    },
  ];
}

export function buildDashboardActivity(input: DashboardBuildInput): ActivityFeedItem[] {
  const onboarding = isOnboardingMode(input.employeesActive);
  const deliveryDays = formatDeliveryDaysLabel(input.operationalBrief.operative_day_keys);
  const agreementLabel = formatAgreementSystemLabel(input.agreementStatus);
  const companyName = safeTrim(input.companyName) || "Firmaet";
  const provider = formatProviderLabel(input.providerName);

  if (onboarding) {
    return [
      {
        text: "Avtalen er aktiv",
        time: `${companyName} er godkjent og klar for onboarding.`,
        kind: "success",
      },
      {
        text: "Neste steg: inviter ansatte",
        time: "Ansatte må legges til før første bestilling.",
        kind: "accent",
      },
      {
        text: "Levering følger avtalen",
        time: `${provider} leverer ${deliveryDays.toLowerCase()} etter valgt plan.`,
        kind: "success",
      },
      {
        text: "Første uke overvåkes manuelt",
        time: "Lunchportalen og leverandøren følger med på første bestillingsrunde.",
        kind: "soft",
      },
    ];
  }

  const ordersDayError =
    input.operationalBrief.orders_day.ok === false ? input.operationalBrief.orders_day.message : null;
  const orderCount = input.operationalBrief.orders_day.ok
    ? input.operationalBrief.orders_day.total_operative
    : input.orderCountToday;

  const items: ActivityFeedItem[] = [
    {
      text: input.operationalBrief.orders_day.ok
        ? `${orderCount} bestillinger i dag`
        : `Ordrelesing feilet: ${ordersDayError ?? "Ukjent feil"}`,
      time: cutoffFootUser(input.operationalBrief.cutoff_today),
      kind: input.operationalBrief.orders_day.ok ? "success" : "accent",
    },
    {
      text: "Avtalen er aktiv",
      time: agreementLabel,
      kind: input.agreementStatus.isActive ? "success" : "soft",
    },
  ];

  if (input.operationalBrief.is_weekend_today) {
    items.push({
      text: "Helg",
      time: "Neste leveringsdag vises basert på avtalen.",
      kind: "soft",
    });
  } else if (input.operationalBrief.booking_today === "open") {
    items.push({
      text: "Bestilling er åpen",
      time: "Ansatte kan bestille lunsj frem til cut-off kl. 08:00.",
      kind: "success",
    });
  } else {
    items.push({
      text: "Bestilling er stengt i dag",
      time: "Se avtale og drift for detaljer om leveringsdager og cut-off.",
      kind: "soft",
    });
  }

  return items;
}

export function buildDashboardSystemStatus(input: DashboardBuildInput): SystemStatusRow[] {
  const onboarding = isOnboardingMode(input.employeesActive);
  const deliveryDays = formatDeliveryDaysLabel(input.operationalBrief.operative_day_keys);
  const billing = formatDashboardBillingLabel({
    employeesActive: input.employeesActive,
    billingHold: input.agreementStatus.billingHold,
    ehfEnabled: input.ehfEnabled,
  });
  const provider = formatProviderLabel(input.providerName);

  return [
    {
      label: "Avtale",
      value: formatAgreementSystemLabel(input.agreementStatus),
      kind: input.agreementStatus.isActive ? "ok" : "warn",
    },
    {
      label: "Leverandør",
      value: provider,
      kind: input.providerName ? "ok" : "neutral",
    },
    {
      label: "Leveringsdager",
      value: deliveryDays,
      kind: input.operationalBrief.operative_day_keys.length ? "ok" : "warn",
    },
    {
      label: "Cut-off",
      value: "08:00",
      kind: "ok",
    },
    {
      label: "Ansatte",
      value: onboarding ? "0 lagt til" : `${input.employeesActive} aktive`,
      kind: onboarding ? "neutral" : "ok",
    },
    {
      label: "Første ordre",
      value: onboarding
        ? "Venter på ansatte"
        : input.ordersWeekActive > 0 || input.orderCountToday > 0
          ? "Registrert"
          : "Venter på bestilling",
      kind: onboarding || (input.ordersWeekActive <= 0 && input.orderCountToday <= 0) ? "neutral" : "ok",
    },
    {
      label: "Faktura",
      value: billing.value,
      kind: billing.kind,
    },
  ];
}

function initials(value: string) {
  const parts = value
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.slice(0, 2) || "LP").toUpperCase();
}

function safeTrim(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export function buildDashboardRoster(input: DashboardBuildInput): TodayRosterItem[] {
  const onboarding = isOnboardingMode(input.employeesActive);
  const deliveryDays = formatDeliveryDaysLabel(input.operationalBrief.operative_day_keys);
  const provider = formatProviderLabel(input.providerName);

  if (onboarding) {
    return [
      {
        name: "Bedriften er klar",
        meta: "Avtalen er aktiv — inviter ansatte for å åpne bestilling.",
        status: "Klar",
        statusKind: "ok",
        initials: "LP",
      },
      {
        name: provider,
        meta: `Leverer ${deliveryDays.toLowerCase()} etter avtale.`,
        status: "Aktiv",
        statusKind: "ok",
        initials: initials(provider),
      },
      {
        name: "Første bestilling",
        meta: "Venter på at ansatte er lagt til og velger lunsj.",
        status: "Neste",
        statusKind: "warn",
        initials: "FB",
      },
    ];
  }

  const ordersDayError =
    input.operationalBrief.orders_day.ok === false ? input.operationalBrief.orders_day.message : null;

  const rosterItems: TodayRosterItem[] = input.operationalBrief.orders_day.ok
    ? input.operationalBrief.orders_day.by_location.slice(0, 5).map((row) => ({
        name: row.location_label,
        meta: `${row.count} ordre · ${input.operationalBrief.ledger_delivery_window_nb ?? "leveringsvindu fra avtale"}`,
        status: "OK",
        statusKind: "ok",
        initials: initials(row.location_label),
      }))
    : [];

  if (rosterItems.length === 0) {
    rosterItems.push({
      name: "Ingen bestillinger i dag",
      meta: input.operationalBrief.orders_day.ok
        ? "Ingen ordre registrert for firmaet i dag"
        : ordersDayError ?? "Ukjent feil",
      status: "Rolig",
      statusKind: "warn",
      initials: "LP",
    });
  }

  return rosterItems;
}

export function assertNoForbiddenDashboardCopy(text: string): boolean {
  return !/\bledger\b/i.test(text) && !/operativ modell/i.test(text);
}

/** @deprecated use resolveChartEmptyVariant */
export function shouldShowChartEmptyState(input: {
  employeesActive: number;
  ordersWeekActive: number;
  orderCountToday: number;
}): boolean {
  return resolveChartEmptyVariant(input) !== null;
}
