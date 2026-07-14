// lib/providers/orderStatusNotifications.ts
//
// FASE 7 — best-effort varsler ved kanoniske statusoverganger (per ordre).
// Statusmaskinen (lp_order_advance_status) er UENDRET — dette kjører ETTER en
// vellykket overgang og blokkerer aldri. Mottakere er PROVIDER-EIDE
// (provider_settings-kjeden, aldri plattform-fallback) + ansattbekreftelse
// ved levert. Idempotent via outbox event_key per (ordre, status).
//
//  - DISPATCHED («Klar for levering» / ut-for-levering): provider delivery_email
//  - DELIVERED (levert): ansattbekreftelse + provider operations-kopi
import "server-only";

import { getProviderNotificationRecipients } from "@/lib/providers/providerNotificationRecipients";
import { upsertOutboxEvent } from "@/lib/orderBackup/outbox";
import { isoToDDMMYYYY } from "@/lib/orderBackup/emailContent";
import { orderNotificationCopy } from "@/lib/i18n/notificationCopy";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function mailFrom() {
  return safeStr(process.env.LP_RESEND_FROM) || "Lunchportalen <no-reply@lunchportalen.no>";
}

export type OrderStatusNotificationInput = {
  orderId: string;
  toStatus: string;
  rid: string;
};

/** Fire-and-forget: aldri throw, aldri blokkere statusovergangen. */
export async function notifyOrderStatusAdvanced(input: OrderStatusNotificationInput): Promise<void> {
  const orderId = safeStr(input.orderId);
  const target = safeStr(input.toStatus).toUpperCase();
  if (!orderId || (target !== "DISPATCHED" && target !== "DELIVERED")) return;

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin() as any;
    const { data: order } = await admin
      .from("orders")
      .select("id, date, provider_id, company_id, location_id, user_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return;

    const providerId = safeStr(order.provider_id);
    const date = safeStr(order.date);
    const pretty = isoToDDMMYYYY(date).replace(/-/g, ".");
    const recipients = providerId ? await getProviderNotificationRecipients(providerId) : null;

    if (target === "DISPATCHED") {
      // Ut for levering — provider-eid leveringsmottaker (fail-closed: hopper
      // over ved konfigurasjonsavvik, logger avviket).
      const to = recipients?.deliveryEmail ?? null;
      if (!to) {
        opsLog("orders.statusNotify.delivery_email_missing", { rid: input.rid, orderId, providerId });
        return;
      }
      // FASE 11: provider-varsel på PROVIDERENS språk (provider_settings.locale).
      const { data: ps } = await admin.from("provider_settings").select("locale").eq("provider_id", providerId).maybeSingle();
      const providerCopyTexts = orderNotificationCopy(safeStr(ps?.locale));
      const eventKey = `order.status.dispatched:${orderId}`;
      await upsertOutboxEvent(eventKey, {
        eventType: "ORDER_PLACED",
        rid: input.rid,
        eventKey,
        userId: safeStr(order.user_id),
        userEmail: null,
        companyId: safeStr(order.company_id),
        locationId: safeStr(order.location_id),
        date,
        status: "DISPATCHED",
        orderId,
        timestampISO: new Date().toISOString(),
        from: mailFrom(),
        to,
        subject: providerCopyTexts.dispatchedSubject(pretty),
        bodyText: providerCopyTexts.dispatchedBody(orderId, pretty),
        extra: { providerId, transition: "DISPATCHED" },
      } as Parameters<typeof upsertOutboxEvent>[1]);
      return;
    }

    // DELIVERED: ansattbekreftelse + provider-kopi (deduplisert).
    // FASE 11: bekreftelsen bruker ANSATTES språk (profiles.preferred_locale).
    const { data: profile } = await admin
      .from("profiles")
      .select("email, preferred_locale")
      .eq("id", safeStr(order.user_id))
      .maybeSingle();
    const employeeEmail = safeStr(profile?.email) || null;
    const employeeCopy = orderNotificationCopy(safeStr(profile?.preferred_locale));
    const providerCopy = recipients?.operationsEmail ?? null;
    const to = [employeeEmail, providerCopy].filter(Boolean).join(", ");
    if (!to) {
      opsLog("orders.statusNotify.delivered_recipients_missing", { rid: input.rid, orderId, providerId });
      return;
    }
    const eventKey = `order.status.delivered:${orderId}`;
    await upsertOutboxEvent(eventKey, {
      eventType: "ORDER_PLACED",
      rid: input.rid,
      eventKey,
      userId: safeStr(order.user_id),
      userEmail: employeeEmail,
      companyId: safeStr(order.company_id),
      locationId: safeStr(order.location_id),
      date,
      status: "DELIVERED",
      orderId,
      timestampISO: new Date().toISOString(),
      from: mailFrom(),
      to,
      subject: employeeCopy.deliveredSubject(pretty),
      bodyText: employeeCopy.deliveredBody(pretty),
      extra: { providerId, transition: "DELIVERED" },
    } as Parameters<typeof upsertOutboxEvent>[1]);
  } catch (e) {
    opsLog("orders.statusNotify.failed", {
      rid: input.rid,
      orderId,
      target,
      detail: safeStr((e as Error)?.message),
    });
  }
}
