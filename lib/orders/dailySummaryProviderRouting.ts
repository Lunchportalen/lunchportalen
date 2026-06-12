// lib/orders/dailySummaryProviderRouting.ts
// Provider-routet utsendingsplan for daglig ordre-/kjøkkenoppsummering.
//
// Prinsipp:
// - Plattformkopi beholdes uendret (samlet oppsummering til plattformadressene)
//   — dette er eksplisitt platform-scope, ikke providerens driftsmottaker.
// - I tillegg får hver provider sin egen oppsummering, bygget KUN på providerens
//   egne ordre (orders.provider_id er sannheten — provider A ser aldri provider B).
// - Ordreoppsummering rutes til provider operationsEmail.
// - Produksjons-/kjøkkengrunnlag rutes til provider kitchenEmail.
// - Fallback skjer i resolveren og er kun provider-eid (kitchen → operations →
//   contact). Lunchportalen-adresser brukes ALDRI som provider-mottaker.
// - Provider uten konfigurert e-post gir IKKE provider-rader (fail-closed):
//   provideren rapporteres som konfigurasjonsavvik, og ordrene dekkes uansett
//   av plattformkopien.
// - Providere som ikke kan resolves dekkes av plattformkopien (aldri feil provider).
//
// Modulen er ren (ingen I/O) slik at routing kan testes deterministisk.

import type { ProviderNotificationRecipients } from "@/lib/providers/providerNotificationRecipients";

export type DailySummaryOrderRow = {
  id: string;
  company_id: string | null;
  location_id: string | null;
  user_id: string | null;
  slot: string | null;
  provider_id: string | null;
};

export type DailySummaryDispatchEntry = {
  kind: "order_summary" | "kitchen_production";
  scope: "platform" | "provider";
  providerId: string | null;
  eventKey: string;
  /** Deduplisert, lowercased, kommaseparert mottakerliste for outbox-payload. */
  to: string;
  recipientSource: "platform" | "provider_settings" | "provider_contact";
  /** Ordrene oppsummeringen skal bygges på (provider-isolert for provider-scope). */
  orders: DailySummaryOrderRow[];
};

export type DailySummaryDispatchPlan = {
  entries: DailySummaryDispatchEntry[];
  /** Providere med ordre som ikke kunne resolves — dekkes kun av plattformkopien. */
  unresolvedProviderIds: string[];
  /**
   * Providere med ordre, men uten konfigurert provider-e-post (konfigurasjonsavvik).
   * Får ingen provider-rader (fail-closed) — dekkes kun av plattformkopien.
   */
  missingRecipientProviderIds: string[];
};

function cleanEmail(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return s ? s : null;
}

function dedupeJoin(emails: Array<string | null>): string {
  const out: string[] = [];
  for (const e of emails) {
    const clean = cleanEmail(e);
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out.join(", ");
}

/** Grupperer ordre per provider_id. Ordre uten provider_id havner under nøkkelen "". */
export function groupOrdersByProvider(
  orders: DailySummaryOrderRow[],
): Map<string, DailySummaryOrderRow[]> {
  const grouped = new Map<string, DailySummaryOrderRow[]>();
  for (const order of orders) {
    const key = String(order.provider_id ?? "").trim();
    const bucket = grouped.get(key) ?? [];
    bucket.push(order);
    grouped.set(key, bucket);
  }
  return grouped;
}

/**
 * Bygger full utsendingsplan for én dag:
 * - 2 plattform-entries (samlet ordre- og kjøkkenoppsummering) — alltid, som i dag.
 * - 2 entries per provider med ordre og vellykket resolving (ops + kitchen).
 */
export function buildDailySummaryDispatchPlan(args: {
  date: string;
  orders: DailySummaryOrderRow[];
  resolvedByProvider: Map<string, ProviderNotificationRecipients | null>;
  platformOrderTo: string;
  platformKitchenTo: string;
}): DailySummaryDispatchPlan {
  const entries: DailySummaryDispatchEntry[] = [];
  const unresolvedProviderIds: string[] = [];
  const missingRecipientProviderIds: string[] = [];

  // Plattformkopi (uendret atferd): samlet oppsummering for alle ordre.
  entries.push({
    kind: "order_summary",
    scope: "platform",
    providerId: null,
    eventKey: `daily_order_summary:${args.date}`,
    to: dedupeJoin([args.platformOrderTo]),
    recipientSource: "platform",
    orders: args.orders,
  });
  entries.push({
    kind: "kitchen_production",
    scope: "platform",
    providerId: null,
    eventKey: `daily_kitchen_production:${args.date}`,
    to: dedupeJoin([args.platformKitchenTo]),
    recipientSource: "platform",
    orders: args.orders,
  });

  // Provider-routede oppsummeringer: kun providerens egne ordre.
  const grouped = groupOrdersByProvider(args.orders);
  const providerIds = Array.from(grouped.keys())
    .filter((key) => key !== "")
    .sort();

  for (const providerId of providerIds) {
    const providerOrders = grouped.get(providerId) ?? [];
    if (providerOrders.length === 0) continue;

    const resolved = args.resolvedByProvider.get(providerId) ?? null;
    if (!resolved) {
      unresolvedProviderIds.push(providerId);
      continue;
    }

    // Fail-closed: uten provider-eid e-post sendes INGEN provider-rader.
    // Lunchportalen-adressene er aldri fallback — avviket rapporteres til caller.
    if (resolved.operationsEmailSource === "missing" || !resolved.operationsEmail) {
      missingRecipientProviderIds.push(providerId);
      continue;
    }

    entries.push({
      kind: "order_summary",
      scope: "provider",
      providerId,
      eventKey: `daily_order_summary:${args.date}:${providerId}`,
      to: dedupeJoin([resolved.operationsEmail]),
      recipientSource: resolved.operationsEmailSource,
      orders: providerOrders,
    });
    entries.push({
      kind: "kitchen_production",
      scope: "provider",
      providerId,
      eventKey: `daily_kitchen_production:${args.date}:${providerId}`,
      to: dedupeJoin([resolved.kitchenEmail ?? resolved.operationsEmail]),
      recipientSource: resolved.operationsEmailSource,
      orders: providerOrders,
    });
  }

  return { entries, unresolvedProviderIds, missingRecipientProviderIds };
}
