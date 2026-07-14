// lib/accounting/tripletexAdapter.ts
//
// FASE 8 — Tripletex som NORSK regnskapsadapter (aldri global default).
// Gjenbruker den eksisterende outbox-synkstien for agreement-fakturaer
// (tripletex.agreement_invoice_create_provider:{id}) — idempotent per faktura.
import "server-only";

import { INTEGRATIONS } from "@/lib/integrations/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AccountingAdapter, AccountingExportResult } from "@/lib/accounting/adapter";

export const tripletexAdapter: AccountingAdapter = {
  name: "tripletex",

  // KUN Norge — Tripletex skal aldri være fallback for andre markeder.
  supportsCountry(countryCode: string): boolean {
    return String(countryCode ?? "").trim().toUpperCase() === "NO" && Boolean(INTEGRATIONS.tripletex?.enabled);
  },

  async exportInvoice(invoiceId: string): Promise<AccountingExportResult> {
    const id = String(invoiceId ?? "").trim();
    if (!id) return { ok: false, code: "INVOICE_ID_REQUIRED" };
    const admin = supabaseAdmin() as any;

    const { data: inv } = await admin
      .from("agreement_invoices")
      .select("id, status, kind")
      .eq("id", id)
      .maybeSingle();
    if (!inv) return { ok: false, code: "INVOICE_NOT_FOUND" };
    if (!["ISSUED", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"].includes(String(inv.status))) {
      return { ok: false, code: "INVOICE_NOT_ISSUED" };
    }

    const eventKey = `tripletex.agreement_invoice_create_provider:${id}`;
    const { error } = await admin.from("outbox").upsert(
      {
        event_key: eventKey,
        payload: { invoice_id: id, source: "accounting_adapter" },
        status: "PENDING",
        attempts: 0,
      },
      { onConflict: "event_key" },
    );
    if (error) return { ok: false, code: "ENQUEUE_FAILED" };
    return { ok: true, mode: "enqueued", externalRef: eventKey };
  },
};
