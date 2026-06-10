// lib/orders/resolveOrderNotificationRecipients.ts
// Provider-routet mottakerliste for ordre-/driftsvarsler.
//
// Prinsipp:
// - Operative ordrevarsler rutes til riktig cateringfirma (provider.operationsEmail).
// - Lunchportalen beholder plattformkopi (ORDER_EMAIL) i samme varsling.
// - Provider A sine ordre sendes aldri til provider B: alt utledes fra ordrens
//   eksplisitte provider_id via getProviderNotificationRecipients.
// - Fail-safe: hvis provider ikke kan resolves, går varselet kun til plattform
//   (aldri til en annen provider, aldri stille bortfall).

import "server-only";

import {
  getProviderNotificationRecipients,
  type ProviderNotificationRecipients,
} from "@/lib/providers/providerNotificationRecipients";
import { ORDER_EMAIL } from "@/lib/system/emailAddresses";

export type OrderNotificationRecipientSource =
  | "provider_settings"
  | "provider_contact"
  | "system_fallback"
  | "platform_only";

export type OrderNotificationRouting = {
  providerId: string | null;
  /** Provider-eide operative mottakere (tom kun når provider ikke kunne resolves). */
  providerRecipients: string[];
  /** Plattformkopi/backup-mottakere (beholdes alltid). */
  platformRecipients: string[];
  /** Deduplisert, lowercased samlet mottakerliste for transport (`to`). */
  recipients: string[];
  /** Hvor provider-mottakeren ble hentet fra (sporbarhet). */
  recipientSource: OrderNotificationRecipientSource;
  operationsEmail: string | null;
  fallbackEmail: string | null;
};

function cleanEmail(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return s ? s : null;
}

function dedupe(emails: Array<string | null>): string[] {
  const out: string[] = [];
  for (const e of emails) {
    const clean = cleanEmail(e);
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out;
}

/**
 * Ren, testbar routing-bygger. Ingen I/O.
 * `resolved = null` betyr at provider ikke kunne resolves → plattformkopi alene.
 */
export function buildOrderNotificationRouting(
  providerId: string | null,
  resolved: ProviderNotificationRecipients | null,
): OrderNotificationRouting {
  const platformRecipients = [ORDER_EMAIL];

  if (!resolved) {
    return {
      providerId,
      providerRecipients: [],
      platformRecipients,
      recipients: dedupe(platformRecipients),
      recipientSource: "platform_only",
      operationsEmail: null,
      fallbackEmail: null,
    };
  }

  const providerRecipients = dedupe([resolved.operationsEmail]);

  return {
    providerId: resolved.providerId,
    providerRecipients,
    platformRecipients,
    recipients: dedupe([...providerRecipients, ...platformRecipients]),
    recipientSource: resolved.operationsEmailSource,
    operationsEmail: cleanEmail(resolved.operationsEmail),
    fallbackEmail: cleanEmail(resolved.fallbackEmail),
  };
}

/**
 * Resolver mottakere for ett ordre-/driftsvarsel ut fra ordrens provider_id.
 * Fail-safe: resolver-feil gir plattformkopi alene — blokkerer aldri kalleren.
 */
export async function resolveOrderNotificationRecipients(
  providerId: string | null | undefined,
): Promise<OrderNotificationRouting> {
  const pid = String(providerId ?? "").trim() || null;
  if (!pid) return buildOrderNotificationRouting(null, null);

  try {
    const resolved = await getProviderNotificationRecipients(pid);
    return buildOrderNotificationRouting(pid, resolved);
  } catch {
    return buildOrderNotificationRouting(pid, null);
  }
}
