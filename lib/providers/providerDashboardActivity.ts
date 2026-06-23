// lib/providers/providerDashboardActivity.ts
// Provider-facing presentasjon av dashboard-aktivitet og oppfølgingspunkter.
//
// Prinsipp:
// - lifecycle_audit_log er intern systemsannhet. Provider-facing UI skal ALDRI
//   vise rå tekniske labels (`delete · company`), tabellnavn, cron-/hook-events
//   eller fritekst-reason (kan inneholde intern/testtekst).
// - Kun en eksplisitt allowlist av hendelser mappes til trygg copy (i18n-nøkler).
//   Alt annet filtreres bort. Ingen data slettes — kun presentasjon.
// - Rene funksjoner uten I/O slik at de kan testes deterministisk.

import type { ProviderActivityItem } from "@/lib/providers/loadProviderDashboard";

export type DashboardActivityMessageId =
  | "registrationReceived"
  | "registrationApproved"
  | "registrationRejected"
  | "agreementActivated"
  | "agreementUpdated"
  | "invoiceGenerated"
  | "orderReceived"
  | "orderCancelled"
  | "menuPublished"
  | "settingsUpdated";

export type ProviderDashboardActivityItem = {
  id: string;
  timeLabel: string;
  messageId: DashboardActivityMessageId;
  tone: "neutral" | "success" | "warning";
};

export type ProviderFollowUpItem = {
  id: string;
  title: string;
  text: string;
  actionLabel: string;
  href: string;
  tone: "neutral" | "warning";
};

type SafeActivityDefinition = {
  messageId: DashboardActivityMessageId;
  tone: ProviderDashboardActivityItem["tone"];
};

/**
 * Allowlist: kjente provider-relevante hendelser → i18n messageId.
 * Nøkkel = `action` i lifecycle_audit_log (lowercase).
 * Hendelser som ikke står her vises ALDRI på provider-dashboardet.
 */
const SAFE_ACTIVITY_DEFINITIONS: Record<string, SafeActivityDefinition> = {
  company_registration_received: { messageId: "registrationReceived", tone: "neutral" },
  company_registration_submitted: { messageId: "registrationReceived", tone: "neutral" },
  company_registration_approved: { messageId: "registrationApproved", tone: "success" },
  company_registration_rejected: { messageId: "registrationRejected", tone: "neutral" },
  agreement_activated: { messageId: "agreementActivated", tone: "success" },
  agreement_updated: { messageId: "agreementUpdated", tone: "neutral" },
  agreement_invoice_generated: { messageId: "invoiceGenerated", tone: "neutral" },
  order_received: { messageId: "orderReceived", tone: "success" },
  order_created: { messageId: "orderReceived", tone: "success" },
  order_canceled: { messageId: "orderCancelled", tone: "warning" },
  order_cancelled: { messageId: "orderCancelled", tone: "warning" },
  menu_published: { messageId: "menuPublished", tone: "success" },
  settings_updated: { messageId: "settingsUpdated", tone: "neutral" },
  provider_settings_updated: { messageId: "settingsUpdated", tone: "neutral" },
};

function formatActivityTime(iso: string): string {
  const v = String(iso ?? "").trim();
  if (!v) return "—";
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Oslo",
    }).format(new Date(v));
  } catch {
    return "—";
  }
}

/**
 * Mapper rå audit-rader til provider-safe aktivitet.
 * - Ukjente/tekniske/test-events filtreres bort.
 * - Rå `reason`-fritekst rendres aldri — beskrivelse kommer kun fra allowlisten.
 */
export function mapProviderDashboardActivity(rows: ProviderActivityItem[]): ProviderDashboardActivityItem[] {
  const out: ProviderDashboardActivityItem[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const action = String(row?.action ?? "").trim().toLowerCase();
    const definition = SAFE_ACTIVITY_DEFINITIONS[action];
    if (!definition) continue;

    const id = String(row?.id ?? "").trim();
    if (!id) continue;

    out.push({
      id,
      timeLabel: formatActivityTime(row.createdAt),
      messageId: definition.messageId,
      tone: definition.tone,
    });
  }
  return out;
}

export type ProviderFollowUpInput = {
  menuEditingEnabled: boolean;
  ordersThisWeek: number;
  activeCustomers: number;
  revenueLast30DaysNok: number;
};

/**
 * Operasjonell prioritering for «Må følges opp» — bygget på eksisterende
 * dashboard-data, ingen nye queries. Rolig enterprise-tone, ikke alarm.
 */
export function buildProviderFollowUps(input: ProviderFollowUpInput): ProviderFollowUpItem[] {
  const items: ProviderFollowUpItem[] = [];

  if (!input.menuEditingEnabled) {
    items.push({
      id: "menu-editing-disabled",
      title: "Menyredigering ikke aktivert",
      text: "Menyinnhold administreres foreløpig av Lunchportalen.",
      actionLabel: "Se menystatus",
      href: "/leverandor/meny",
      tone: "neutral",
    });
  }

  if (input.ordersThisWeek === 0) {
    items.push({
      id: "no-orders-this-week",
      title: "Ingen ordre denne uken",
      text: "Følg med når kundene begynner å bestille for kommende leveranser.",
      actionLabel: "Se ordrer",
      href: "/leverandor/ordrer",
      tone: "neutral",
    });
  }

  if (input.activeCustomers > 0 && input.revenueLast30DaysNok === 0) {
    items.push({
      id: "no-revenue-30d",
      title: "Ingen ordreverdi siste 30 dager",
      text: "Når bestillinger kommer inn, vises samlet ordreverdi her.",
      actionLabel: "Se faktura",
      href: "/leverandor/faktura",
      tone: "neutral",
    });
  }

  return items;
}
