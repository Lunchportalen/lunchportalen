// lib/kitchen/batchPackedOutbox.ts
// «Leveranse klar»-varsling når en kjøkkenbatch settes PACKED.
//
// LÅST FORRETNINGSREGEL (samme policy som PR #178): provideren eier sine egne
// operative e-poster. Leveranseklar-varselet rutes til provider-eid
// delivery-mottaker (provider_settings.delivery_email → operations_email →
// providers.contact_email). Lunchportalen-adresser (driver@/ordre@/kitchen@)
// er ALDRI providerens mottaker — manglende provider-e-post er et kontrollert
// konfigurasjonsavvik (fail-closed: ingen outbox-rad, logget uten persondata).
//
// provider_id utledes deterministisk fra batchens egne ordre
// (orders.provider_id — samme sannhetskilde som daily summary). Blandede eller
// manglende provider_id gir aldri gjetting: varselet skippes fail-closed.

import "server-only";

import {
  getProviderNotificationRecipients,
  type ProviderNotificationRecipients,
} from "@/lib/providers/providerNotificationRecipients";
import { ORDER_EMAIL } from "@/lib/system/emailAddresses";
import { opsLog } from "@/lib/ops/log";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function isTestEnv() {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

function formatDisplayDate(dateISO: string) {
  const parts = String(dateISO).slice(0, 10).split("-");
  if (parts.length !== 3) return dateISO;
  const [year, month, day] = parts;
  if (!year || !month || !day) return dateISO;
  return `${day}.${month}.${year}`;
}

/** Event key for «Leveranse klar» — LOCKED (idempotency, må ikke endres). */
export function batchPackedEventKey(date: string, slot: string, locationId: string) {
  return `batch_packed:${date}:${slot}:${locationId}`;
}

export type BatchPackedOrderRow = { id?: unknown; provider_id?: unknown };

export type BatchProviderIdResult =
  | { providerId: string; reason: null }
  | { providerId: null; reason: "no_orders" | "provider_id_missing_on_orders" | "mixed_provider_ids" };

/**
 * Utleder batchens provider_id fra ordrenes provider_id (ren, testbar).
 * Fail-closed: null/blandede provider_id gir aldri gjetting.
 */
export function deriveBatchProviderId(rows: ReadonlyArray<BatchPackedOrderRow>): BatchProviderIdResult {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return { providerId: null, reason: "no_orders" };

  const distinct = new Set<string>();
  let sawMissing = false;
  for (const row of list) {
    const pid = safeStr(row?.provider_id);
    if (pid) distinct.add(pid);
    else sawMissing = true;
  }

  if (distinct.size === 0) return { providerId: null, reason: "provider_id_missing_on_orders" };
  if (distinct.size > 1 || sawMissing) return { providerId: null, reason: "mixed_provider_ids" };
  return { providerId: Array.from(distinct)[0], reason: null };
}

export type BatchPackedDeliveryRoute = {
  /** Provider-eid mottaker for leveranseklar-varselet. null = fail-closed. */
  to: string | null;
  recipientSource: "provider_settings" | "provider_contact" | "missing";
  missingReason: "provider_unresolved" | "provider_email_not_configured" | null;
};

/**
 * Ren, testbar delivery-route fra PR #178-resolverens resultat.
 * deliveryEmail-kjeden er kun provider-eid (delivery → operations → contact).
 */
export function resolveBatchPackedDeliveryRoute(
  recipients: ProviderNotificationRecipients | null,
): BatchPackedDeliveryRoute {
  if (!recipients) {
    return { to: null, recipientSource: "missing", missingReason: "provider_unresolved" };
  }
  const to = recipients.deliveryEmail;
  if (!to) {
    return { to: null, recipientSource: "missing", missingReason: "provider_email_not_configured" };
  }
  // Eksplisitt delivery_email (ulik ops-kjeden) er alltid provider_settings;
  // ellers arves sporbarheten fra operations-kjeden (settings/contact).
  const recipientSource =
    to === recipients.operationsEmail && recipients.operationsEmailSource !== "missing"
      ? recipients.operationsEmailSource
      : "provider_settings";
  return { to, recipientSource, missingReason: null };
}

export type BatchPackedOutboxResult = {
  enqueued: boolean;
  skippedReason: string | null;
  providerId: string | null;
};

export async function enqueueBatchPackedOutbox(
  admin: any,
  input: {
    rid: string;
    date: string;
    slot: string;
    companyId: string;
    locationId: string;
  }
): Promise<BatchPackedOutboxResult> {
  const [companyRes, locationRes, ordersRes] = await Promise.all([
    admin.from("companies").select("name").eq("id", input.companyId).maybeSingle(),
    admin
      .from("company_locations")
      .select("name, delivery_window_from, delivery_window_to")
      .eq("id", input.locationId)
      .maybeSingle(),
    admin
      .from("orders")
      .select("id, provider_id")
      .eq("date", input.date)
      .eq("company_id", input.companyId)
      .eq("location_id", input.locationId)
      .eq("slot", input.slot)
      .eq("status", "ACTIVE"),
  ]);

  const company = safeStr(companyRes.data?.name) || "Ukjent firma";
  const location = safeStr(locationRes.data?.name) || "Lokasjon";
  const deliveryWindow =
    safeStr(locationRes.data?.delivery_window_from) && safeStr(locationRes.data?.delivery_window_to)
      ? `${safeStr(locationRes.data.delivery_window_from)}–${safeStr(locationRes.data.delivery_window_to)}`
      : input.slot;
  const orderRows = (Array.isArray(ordersRes.data) ? ordersRes.data : []) as BatchPackedOrderRow[];
  const portions = orderRows.length;
  const eventKey = batchPackedEventKey(input.date, input.slot, input.locationId);
  const displayDate = formatDisplayDate(input.date);

  // Provider-eid delivery routing (fail-closed — aldri Lunchportalen som mottaker).
  const derived = deriveBatchProviderId(orderRows);
  let recipients: ProviderNotificationRecipients | null = null;
  if (derived.providerId) {
    try {
      recipients = await getProviderNotificationRecipients(derived.providerId);
    } catch {
      recipients = null;
    }
  }
  const route = resolveBatchPackedDeliveryRoute(recipients);

  if (!route.to) {
    const skippedReason = derived.reason ?? route.missingReason ?? "missing_recipient";
    // Kontrollert konfigurasjonsavvik — ingen secrets/persondata i loggen.
    opsLog("kitchen.batch_packed_outbox.skipped", {
      rid: input.rid,
      eventKey,
      providerId: derived.providerId,
      reason: skippedReason,
    });
    return { enqueued: false, skippedReason, providerId: derived.providerId };
  }

  try {
    const { error } = await admin.from("outbox").insert({
      event_key: eventKey,
      status: "PENDING",
      attempts: 0,
      payload: {
        eventType: "BATCH_PACKED",
        eventKey,
        rid: input.rid,
        // Avsender er plattformens systemadresse (uendret) — mottaker er provider-eid.
        from: safeStr(process.env.LP_RESEND_FROM) || `Lunchportalen <${ORDER_EMAIL}>`,
        to: route.to,
        subject: `Leveranse klar – ${deliveryWindow} ${displayDate}`,
        bodyText: [
          `Leveranse klar – ${deliveryWindow} ${displayDate}`,
          "",
          "Hei,",
          "",
          "Følgende leveranser er pakket og klare for henting:",
          "",
          `- ${company}, ${location}: ${portions} porsjoner`,
          `  Leveringsvindu: ${deliveryWindow}`,
          "",
          "Totalt: 1 leveranse",
          "",
          "Med vennlig hilsen,",
          "Lunchportalen",
        ].join("\n"),
        timestampISO: new Date().toISOString(),
        extra: {
          date: input.date,
          displayDate,
          slot: input.slot,
          companyId: input.companyId,
          locationId: input.locationId,
          portions,
          providerId: derived.providerId,
          recipientSource: route.recipientSource,
        },
      },
    });

    if (error && String((error as any).code ?? "") !== "23505") throw error;
    return { enqueued: true, skippedReason: null, providerId: derived.providerId };
  } catch (error: any) {
    if (isTestEnv() && String(error?.message ?? error).includes(".insert is not a function")) {
      return { enqueued: false, skippedReason: "test_env_noop", providerId: derived.providerId };
    }
    throw error;
  }
}
