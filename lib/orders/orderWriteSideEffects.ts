// lib/orders/orderWriteSideEffects.ts
//
// FASE 6 — best-effort side effects AFTER a successful canonical order write
// (lp_order_set via POST /api/orders). Golden Path semantics are unchanged:
// this module never blocks, never throws, and never mutates orders.
//
//  - Audit trail (audit_events) for SET/CANCEL.
//  - Employee confirmation email via outbox (SMTP triplet payload).
//  - CANCEL: provider notification (operations_email chain + platform copy).
//  - CANCEL: commission-basis correction via
//    lp_billing_post_negative_commission_for_order (idempotent; posts negative
//    ledger rows only when a completed commission exists, otherwise records a
//    LEDGER_SKIPPED diagnostic). Production/invoice basis is already corrected
//    by the RPC's own rollup.rebuild outbox event (manifests count ACTIVE only).
import "server-only";

import { isoToDDMMYYYY } from "@/lib/orderBackup/emailContent";
import { opsLog } from "@/lib/ops/log";

export type OrderWriteSideEffectsInput = {
  rid: string;
  action: "SET" | "CANCEL";
  orderId: string;
  date: string;
  userId: string | null;
  userEmail: string | null;
  companyId: string | null;
  locationId: string | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/** Fire-and-forget. All failures are logged and swallowed — order write already succeeded. */
export async function runOrderWriteSideEffects(input: OrderWriteSideEffectsInput): Promise<void> {
  const { rid, action, orderId, date } = input;

  // 1) Audit (fire-and-forget by design in auditLog).
  try {
    const { auditLog } = await import("@/lib/audit/log");
    auditLog({
      action: action === "CANCEL" ? "ORDER_CANCELLED" : "ORDER_SET",
      userId: input.userId,
      role: "employee",
      companyId: input.companyId,
      locationId: input.locationId,
      resource: "order",
      resourceId: orderId || null,
      metadata: { rid, date },
      timestamp: Date.now(),
      rid,
    });
  } catch (e) {
    opsLog("orders.sideEffects.audit_failed", { rid, orderId, detail: safeStr((e as Error)?.message) });
  }

  // 2) Employee confirmation email (idempotent outbox upsert per user/date/action).
  try {
    const to = safeStr(input.userEmail);
    if (to) {
      const { upsertOutboxEvent } = await import("@/lib/orderBackup/outbox");
      const pretty = isoToDDMMYYYY(date).replace(/-/g, ".");
      const confirmed = action === "SET";
      const subject = confirmed ? `Lunsj bestilt – ${pretty} – Lunchportalen` : `Lunsj avbestilt – ${pretty} – Lunchportalen`;
      const bodyText = confirmed
        ? `Hei,\n\nLunsjbestillingen din for ${pretty} er registrert. Du kan endre eller avbestille frem til bestillingsfristen samme dag.\n\nMed vennlig hilsen\nLunchportalen`
        : `Hei,\n\nLunsjbestillingen din for ${pretty} er avbestilt. Du kan bestille på nytt frem til bestillingsfristen samme dag.\n\nMed vennlig hilsen\nLunchportalen`;
      const eventKey = `order.email:${safeStr(input.userId)}:${date}:${confirmed ? "confirmed" : "cancelled"}`;
      await upsertOutboxEvent(eventKey, {
        eventType: confirmed ? "ORDER_PLACED" : "ORDER_CANCELLED",
        rid,
        eventKey,
        userId: safeStr(input.userId),
        userEmail: to,
        companyId: safeStr(input.companyId),
        locationId: safeStr(input.locationId),
        date,
        status: confirmed ? "ACTIVE" : "CANCELLED",
        orderId,
        timestampISO: new Date().toISOString(),
        from: safeStr(process.env.LP_RESEND_FROM) || "Lunchportalen <no-reply@lunchportalen.no>",
        to,
        subject,
        bodyText,
      } as Parameters<typeof upsertOutboxEvent>[1]);
    }
  } catch (e) {
    opsLog("orders.sideEffects.employee_email_failed", { rid, orderId, detail: safeStr((e as Error)?.message) });
  }

  if (action !== "CANCEL" || !orderId) return;

  // 3) Provider notification for the cancellation (provider-routed + platform copy).
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();
    const { data: orderRow } = await admin
      .from("orders")
      .select("id, provider_id, company_id, location_id, status")
      .eq("id", orderId)
      .maybeSingle();

    const { persistDayChoiceOrderCancelOutbox } = await import("@/lib/orderBackup/outbox");
    await persistDayChoiceOrderCancelOutbox({
      dbEventKey: `order.cancel.notify:${orderId}`,
      rid,
      orderId,
      companyId: safeStr((orderRow as { company_id?: unknown } | null)?.company_id) || safeStr(input.companyId),
      locationId: safeStr((orderRow as { location_id?: unknown } | null)?.location_id) || safeStr(input.locationId),
      userId: safeStr(input.userId),
      userEmail: input.userEmail,
      date,
      orderStatus: safeStr((orderRow as { status?: unknown } | null)?.status) || "CANCELLED",
      providerId: safeStr((orderRow as { provider_id?: unknown } | null)?.provider_id) || null,
    });
  } catch (e) {
    opsLog("orders.sideEffects.provider_notify_failed", { rid, orderId, detail: safeStr((e as Error)?.message) });
  }

  // 4) Commission-basis correction (økonomisk reversering) — idempotent.
  //    Pre-delivery cancels have no ORDER_COMPLETED ledger → RPC records a
  //    LEDGER_SKIPPED diagnostic and returns 0 (correct: nothing to reverse).
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin() as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
    };
    const { data, error } = await admin.rpc("lp_billing_post_negative_commission_for_order", {
      p_order_id: orderId,
      p_event_type: "ORDER_CANCELLED",
      p_reason: `Ansatt avbestilte lunsj ${date} (canonical lp_order_set CANCEL, rid ${rid})`,
      p_reference_id: null,
    });
    if (error) {
      opsLog("orders.sideEffects.commission_correction_failed", { rid, orderId, detail: safeStr(error.message) });
    } else {
      opsLog("orders.sideEffects.commission_correction", { rid, orderId, negative_rows: Number(data ?? 0) });
    }
  } catch (e) {
    opsLog("orders.sideEffects.commission_correction_failed", { rid, orderId, detail: safeStr((e as Error)?.message) });
  }
}
