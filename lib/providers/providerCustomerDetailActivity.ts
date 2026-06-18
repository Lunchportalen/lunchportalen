// lib/providers/providerCustomerDetailActivity.ts
// Provider-safe aktivitet for kunde-detalj — ingen rå lifecycle_audit_log-tekst.

export type ProviderCustomerActivityRow = {
  id: string;
  createdAt: string;
  action: string;
  summary: string | null;
};

export type ProviderCustomerActivityItem = {
  id: string;
  timestamp: string;
  title: string;
  summary: string | null;
  tone: "neutral" | "success" | "warning";
};

type SafeCopy = {
  title: string;
  summary: string | null;
  tone: ProviderCustomerActivityItem["tone"];
};

const SAFE_CUSTOMER_ACTIVITY: Record<string, SafeCopy> = {
  company_registration_submitted: {
    title: "Kunderegistrering mottatt",
    summary: "Bedriften registrerte avtaleforespørsel.",
    tone: "neutral",
  },
  company_registration_approved: {
    title: "Kunde godkjent",
    summary: "Kunderegistrering er godkjent og aktivert.",
    tone: "success",
  },
  agreement_activated: {
    title: "Avtale aktivert",
    summary: "Leveranseavtale er aktivert.",
    tone: "success",
  },
  agreement_updated: {
    title: "Avtale oppdatert",
    summary: "Leveranseavtale er endret.",
    tone: "neutral",
  },
  order_created: {
    title: "Ordre registrert",
    summary: "Ny bestilling er registrert.",
    tone: "success",
  },
  order_received: {
    title: "Ordre registrert",
    summary: "Ny bestilling er registrert.",
    tone: "success",
  },
  order_canceled: {
    title: "Ordre kansellert",
    summary: "En bestilling er kansellert.",
    tone: "warning",
  },
  order_cancelled: {
    title: "Ordre kansellert",
    summary: "En bestilling er kansellert.",
    tone: "warning",
  },
  "provider.customer.restore.success": {
    title: "Kunde gjenopprettet",
    summary: "Kundeforholdet er aktivert igjen.",
    tone: "success",
  },
  "provider.customer.restore.attempt": {
    title: "Gjenoppretting startet",
    summary: "Gjenoppretting av kunde ble forsøkt.",
    tone: "neutral",
  },
  "provider.customer.archive.success": {
    title: "Kunde arkivert",
    summary: "Kunden er arkivert hos leverandør.",
    tone: "warning",
  },
  "provider.customer.hard_delete.success": {
    title: "Kunde fjernet",
    summary: "Kunden er fjernet fra leverandørlisten.",
    tone: "warning",
  },
};

function formatTime(iso: string): string {
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
 * Maps audit_events rows to provider-safe customer activity.
 * Unknown or internal/test actions are filtered out (fail-closed presentation).
 */
export function mapProviderCustomerDetailActivity(rows: ProviderCustomerActivityRow[]): ProviderCustomerActivityItem[] {
  const out: ProviderCustomerActivityItem[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const action = String(row?.action ?? "").trim().toLowerCase();
    const copy = SAFE_CUSTOMER_ACTIVITY[action];
    if (!copy) continue;

    const id = String(row?.id ?? "").trim();
    if (!id) continue;

    out.push({
      id,
      timestamp: formatTime(row.createdAt),
      title: copy.title,
      summary: copy.summary ?? (row.summary ? String(row.summary).trim() : null),
      tone: copy.tone,
    });
  }
  return out;
}

export const PROVIDER_CUSTOMER_ACTIVITY_EMPTY = {
  title: "Ingen relevante kundeaktiviteter å vise ennå.",
  text: "Når kunden registreres, bestiller eller gjenopprettes, vises det her.",
} as const;
