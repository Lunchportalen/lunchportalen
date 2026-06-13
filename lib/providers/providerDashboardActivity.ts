// lib/providers/providerDashboardActivity.ts
// Provider-facing presentasjon av dashboard-aktivitet og oppfølgingspunkter.
//
// Prinsipp:
// - lifecycle_audit_log er intern systemsannhet. Provider-facing UI skal ALDRI
//   vise rå tekniske labels (`delete · company`), tabellnavn, cron-/hook-events
//   eller fritekst-reason (kan inneholde intern/testtekst).
// - Kun en eksplisitt allowlist av hendelser mappes til trygg norsk copy.
//   Alt annet filtreres bort. Ingen data slettes — kun presentasjon.
// - Rene funksjoner uten I/O slik at de kan testes deterministisk.

import type { ProviderActivityItem } from "@/lib/providers/loadProviderDashboard";

export type ProviderDashboardActivityItem = {
  id: string;
  timeLabel: string;
  title: string;
  description: string | null;
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

type SafeActivityCopy = {
  title: string;
  description: string | null;
  tone: ProviderDashboardActivityItem["tone"];
};

/**
 * Allowlist: kjente provider-relevante hendelser → trygg norsk copy.
 * Nøkkel = `action` i lifecycle_audit_log (lowercase).
 * Hendelser som ikke står her vises ALDRI på provider-dashboardet.
 */
const SAFE_ACTIVITY_COPY: Record<string, SafeActivityCopy> = {
  company_registration_received: {
    title: "Ny kunderegistrering mottatt",
    description: "En bedrift har registrert seg og venter på behandling.",
    tone: "neutral",
  },
  company_registration_submitted: {
    title: "Ny kunderegistrering mottatt",
    description: "En bedrift har registrert seg og venter på behandling.",
    tone: "neutral",
  },
  company_registration_approved: {
    title: "Kunde godkjent",
    description: "En kunderegistrering er godkjent og aktivert.",
    tone: "success",
  },
  company_registration_rejected: {
    title: "Kunderegistrering avvist",
    description: "En kunderegistrering er behandlet og avvist.",
    tone: "neutral",
  },
  agreement_activated: {
    title: "Avtale aktivert",
    description: "En leveranseavtale er aktivert.",
    tone: "success",
  },
  agreement_updated: {
    title: "Avtale oppdatert",
    description: "En leveranseavtale er endret.",
    tone: "neutral",
  },
  agreement_invoice_generated: {
    title: "Fakturagrunnlag generert",
    description: "Nytt fakturagrunnlag er klart for gjennomgang.",
    tone: "neutral",
  },
  order_received: {
    title: "Ordre mottatt",
    description: "En ny bestilling er registrert.",
    tone: "success",
  },
  order_created: {
    title: "Ordre mottatt",
    description: "En ny bestilling er registrert.",
    tone: "success",
  },
  order_canceled: {
    title: "Ordre kansellert",
    description: "En bestilling er kansellert.",
    tone: "warning",
  },
  order_cancelled: {
    title: "Ordre kansellert",
    description: "En bestilling er kansellert.",
    tone: "warning",
  },
  menu_published: {
    title: "Meny publisert",
    description: "Menyinnhold er publisert og synlig for kundene.",
    tone: "success",
  },
  settings_updated: {
    title: "Innstillinger oppdatert",
    description: "Leverandørinnstillinger er endret.",
    tone: "neutral",
  },
  provider_settings_updated: {
    title: "Innstillinger oppdatert",
    description: "Leverandørinnstillinger er endret.",
    tone: "neutral",
  },
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
    const copy = SAFE_ACTIVITY_COPY[action];
    if (!copy) continue;

    const id = String(row?.id ?? "").trim();
    if (!id) continue;

    out.push({
      id,
      timeLabel: formatActivityTime(row.createdAt),
      title: copy.title,
      description: copy.description,
      tone: copy.tone,
    });
  }
  return out;
}

export const PROVIDER_ACTIVITY_EMPTY_STATE = {
  title: "Ingen relevant aktivitet ennå.",
  text: "Når kunder registreres, avtaler godkjennes eller ordre kommer inn, vises det her.",
} as const;

export const PROVIDER_FOLLOW_UP_ALL_CLEAR = {
  title: "Alt ser ryddig ut",
  text: "Ingen kritiske oppfølgingspunkter akkurat nå.",
} as const;

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
