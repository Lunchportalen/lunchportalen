// lib/providers/providerCustomerDetailActivity.ts
// Provider-safe aktivitet for kunde-detalj — eventKey for i18n, ingen rå lifecycle_audit_log-tekst.

export type ProviderCustomerActivityRow = {
  id: string;
  createdAt: string;
  action: string;
  summary: string | null;
};

export const PROVIDER_CUSTOMER_ACTIVITY_EVENT_KEYS = [
  "company_registration_submitted",
  "company_registration_approved",
  "agreement_activated",
  "agreement_updated",
  "order_created",
  "order_received",
  "order_canceled",
  "order_cancelled",
  "provider.customer.restore.success",
  "provider.customer.restore.attempt",
  "provider.customer.archive.success",
  "provider.customer.hard_delete.success",
] as const;

export type ProviderCustomerActivityEventKey = (typeof PROVIDER_CUSTOMER_ACTIVITY_EVENT_KEYS)[number];

export type ProviderCustomerActivityItem = {
  id: string;
  timestamp: string;
  eventKey: ProviderCustomerActivityEventKey;
  /** Rå summary fra audit når trygg UI-copy ikke finnes — vises som data, oversettes ikke. */
  dataSummary: string | null;
  tone: "neutral" | "success" | "warning";
};

export type ProviderCustomerActivityEmptyKey = "title" | "text";

export const PROVIDER_CUSTOMER_ACTIVITY_EMPTY_KEYS: readonly ProviderCustomerActivityEmptyKey[] = [
  "title",
  "text",
];

const ACTIVITY_TONES: Record<ProviderCustomerActivityEventKey, ProviderCustomerActivityItem["tone"]> = {
  company_registration_submitted: "neutral",
  company_registration_approved: "success",
  agreement_activated: "success",
  agreement_updated: "neutral",
  order_created: "success",
  order_received: "success",
  order_canceled: "warning",
  order_cancelled: "warning",
  "provider.customer.restore.success": "success",
  "provider.customer.restore.attempt": "neutral",
  "provider.customer.archive.success": "warning",
  "provider.customer.hard_delete.success": "warning",
};

function isActivityEventKey(action: string): action is ProviderCustomerActivityEventKey {
  return (PROVIDER_CUSTOMER_ACTIVITY_EVENT_KEYS as readonly string[]).includes(action);
}

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
 * Maps audit_events rows to provider-safe customer activity event keys.
 * Unknown or internal/test actions are filtered out (fail-closed presentation).
 */
export function mapProviderCustomerDetailActivity(rows: ProviderCustomerActivityRow[]): ProviderCustomerActivityItem[] {
  const out: ProviderCustomerActivityItem[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const action = String(row?.action ?? "").trim().toLowerCase();
    if (!isActivityEventKey(action)) continue;

    const id = String(row?.id ?? "").trim();
    if (!id) continue;

    out.push({
      id,
      timestamp: formatTime(row.createdAt),
      eventKey: action,
      dataSummary: row.summary ? String(row.summary).trim() || null : null,
      tone: ACTIVITY_TONES[action],
    });
  }
  return out;
}
