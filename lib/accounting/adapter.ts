// lib/accounting/adapter.ts
//
// FASE 8 — regnskapsadapter-grensesnitt (kravpunkt 21–23).
// Én kanonisk kontrakt for å eksportere utstedte fakturaer til regnskap.
// Tripletex er KUN norsk adapter (aldri global default); alle andre markeder
// dekkes av standard CSV-eksport. INGEN Stripe i dette laget.
import "server-only";

export type AccountingExportResult =
  | { ok: true; mode: "enqueued" | "csv"; externalRef?: string | null }
  | { ok: false; code: string };

export type AccountingAdapter = {
  /** Stabil identifikator, f.eks. "tripletex" eller "csv". */
  name: string;
  /** Om adapteren støtter providerens land (ISO 3166-1 alpha-2). */
  supportsCountry(countryCode: string): boolean;
  /**
   * Eksporterer én utstedt faktura til regnskapssystemet.
   * Skal være idempotent per faktura (outbox event_key / deterministisk fil).
   */
  exportInvoice(invoiceId: string): Promise<AccountingExportResult>;
};
