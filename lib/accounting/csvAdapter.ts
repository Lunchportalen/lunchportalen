// lib/accounting/csvAdapter.ts
//
// FASE 8 — standard CSV-eksport for markeder UTEN dedikert regnskapsadapter.
// Universell (alle land); selve fildataene bygges av invoicesToAccountingCsv
// og streames via eksport-endepunktet (deterministisk, idempotent lesing).
import "server-only";

import type { AccountingAdapter, AccountingExportResult } from "@/lib/accounting/adapter";

export const csvAdapter: AccountingAdapter = {
  name: "csv",
  supportsCountry(): boolean {
    return true; // universell fallback — standard eksport, ingen sideeffekter
  },
  async exportInvoice(invoiceId: string): Promise<AccountingExportResult> {
    const id = String(invoiceId ?? "").trim();
    if (!id) return { ok: false, code: "INVOICE_ID_REQUIRED" };
    // CSV-eksport er en ren lesing — den faktiske filen hentes via
    // GET /api/provider/invoices/export. Ingen tilstand å endre her.
    return { ok: true, mode: "csv", externalRef: null };
  },
};
