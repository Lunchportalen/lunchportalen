/**
 * PHASE 8 — invoice-only billing contract suite (fast, no DB).
 *
 * Locks:
 *  - full status model + immutable snapshot basis in the migration
 *  - idempotent payment import boundary (invoice_payments.idempotency_key UNIQUE)
 *  - sequential numbering per provider/legal entity
 *  - accounting adapter interface: Tripletex NO-only (never global default),
 *    CSV as universal standard export
 *  - NO Stripe code path anywhere in the new billing flow
 *  - provider/company tenant isolation in API guards and lists
 *  - email delivery fail-closed on missing fakturamottaker + idempotent key
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const MIG = "supabase/migrations/20260823120000_invoice_only_billing_lifecycle.sql";

const NEW_BILLING_FILES = [
  "lib/billing/invoiceLifecycle.ts",
  "lib/billing/providerInvoiceGuard.ts",
  "lib/accounting/adapter.ts",
  "lib/accounting/tripletexAdapter.ts",
  "lib/accounting/csvAdapter.ts",
  "lib/accounting/registry.ts",
  "app/api/provider/invoices/route.ts",
  "app/api/provider/invoices/[invoiceId]/route.ts",
  "app/api/provider/invoices/[invoiceId]/finalize/route.ts",
  "app/api/provider/invoices/[invoiceId]/send/route.ts",
  "app/api/provider/invoices/[invoiceId]/payments/route.ts",
  "app/api/provider/invoices/[invoiceId]/credit-note/route.ts",
  "app/api/provider/invoices/[invoiceId]/void/route.ts",
  "app/api/provider/invoices/[invoiceId]/lines/route.ts",
  "app/api/provider/invoices/export/route.ts",
  "app/api/admin/invoices/route.ts",
  "app/api/admin/invoices/[invoiceId]/route.ts",
  "components/billing/InvoiceDocument.tsx",
  "components/billing/InvoiceDetailActions.tsx",
  "components/billing/BuildInvoiceDraftForm.tsx",
  MIG,
];

describe("migration invariants", () => {
  const sql = read(MIG);

  it("carries the full required status model", () => {
    for (const s of ["'DRAFT'", "'ISSUED'", "'SENT'", "'PARTIALLY_PAID'", "'PAID'", "'OVERDUE'", "'CREDITED'", "'VOID'"]) {
      expect(sql).toContain(s);
    }
  });

  it("basis is DELIVERED order lines with immutable snapshots, never live prices", () => {
    expect(sql).toContain("o.status = 'DELIVERED'::public.order_status");
    expect(sql).toContain("oi.unit_price_cents_ex_vat");
    expect(sql).toContain("oi.line_subtotal_cents_ex_vat");
    expect(sql).toContain("oi.line_vat_cents");
    expect(sql).toContain("oi.vat_rate_snapshot");
    expect(sql).toContain("o.currency_code");
    expect(sql).not.toContain("provider_price_rules");
    expect(sql).not.toContain("menu_service_day_items");
  });

  it("dedup: an order can only live on ONE non-VOID invoice (reissue via VOID)", () => {
    expect(sql).toContain("i.status <> 'VOID'");
    expect(sql).toContain("agreement_invoices_active_period_uidx");
  });

  it("payments are an idempotent import boundary", () => {
    expect(sql).toContain("idempotency_key text NOT NULL UNIQUE");
    expect(sql).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
  });

  it("sequential numbering per provider/legal entity + year", () => {
    expect(sql).toContain("invoice_sequences");
    expect(sql).toContain("PRIMARY KEY (provider_id, year)");
    expect(sql).toContain("lp_invoice_next_number");
  });

  it("all lifecycle RPCs are service_role-only with pinned search_path", () => {
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role, postgres");
    expect(sql).toContain("REVOKE ALL ON FUNCTION %s FROM anon, authenticated");
    const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect((code.match(/SECURITY DEFINER/g) ?? []).length).toBeGreaterThanOrEqual(11);
  });

  it("audits every transition into billing_audit_log", () => {
    expect(sql).toContain("lp_invoice_audit");
    for (const action of ["invoice.draft_built", "invoice.issued", "invoice.sent", "invoice.payment_registered", "invoice.credit_note_created", "invoice.voided", "invoice.credited"]) {
      expect(sql).toContain(`'${action}'`);
    }
  });
});

describe("NO Stripe code path (LOCKED)", () => {
  // Kommentarer dokumenterer forbudet («INGEN Stripe») — sjekken gjelder KODE.
  const codeOnly = (src: string) =>
    src
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("--");
      })
      .join("\n")
      .toLowerCase();

  for (const p of NEW_BILLING_FILES) {
    it(`${p} contains no Stripe code`, () => {
      expect(codeOnly(read(p))).not.toContain("stripe");
    });
  }
});

describe("accounting adapter interface", () => {
  it("Tripletex is Norwegian-only and never a global default", () => {
    const src = read("lib/accounting/tripletexAdapter.ts");
    expect(src).toContain('=== "NO"');
    expect(src).toContain("INTEGRATIONS.tripletex?.enabled");
    const registry = read("lib/accounting/registry.ts");
    expect(registry).toContain("tripletexAdapter.supportsCountry(countryCode)");
    expect(registry).toContain("return csvAdapter");
  });

  it("CSV is the universal standard export with tax/currency columns", () => {
    const csv = read("lib/accounting/csvAdapter.ts");
    expect(csv).toContain("supportsCountry(): boolean");
    const lifecycle = read("lib/billing/invoiceLifecycle.ts");
    for (const col of ["currency", "tax_rate", "tax_amount", "net", "gross", "invoice_number"]) {
      expect(lifecycle).toContain(col);
    }
  });

  it("export route resolves adapter by provider market and reports it", () => {
    const src = read("app/api/provider/invoices/export/route.ts");
    expect(src).toContain("resolveAccountingAdapter(country)");
    expect(src).toContain("x-accounting-adapter");
  });
});

describe("tenant isolation", () => {
  it("provider guard hides foreign invoices as 404 and gates mutations on provider_admin", () => {
    const guard = read("lib/billing/providerInvoiceGuard.ts");
    expect(guard).toContain("aldri avslør at fremmed faktura finnes");
    expect(guard).toContain('status: 404, code: "INVOICE_NOT_FOUND"');
    for (const p of ["finalize", "send", "payments", "credit-note", "void", "lines"]) {
      expect(read(`app/api/provider/invoices/[invoiceId]/${p}/route.ts`)).toContain('minRole: "provider_admin"');
    }
  });

  it("company list/detail are company-scoped and never expose drafts or voided", () => {
    const lifecycle = read("lib/billing/invoiceLifecycle.ts");
    expect(lifecycle).toContain('.neq("status", "DRAFT")');
    expect(lifecycle).toContain('.neq("status", "VOID")');
    const detail = read("app/api/admin/invoices/[invoiceId]/route.ts");
    expect(detail).toContain("bundle.head.company_id !== companyId");
    expect(detail).toContain('["company_admin"]');
  });
});

describe("email delivery", () => {
  it("fail-closed on missing fakturamottaker and idempotent per invoice", () => {
    const src = read("lib/billing/invoiceLifecycle.ts");
    expect(src).toContain('BILLING_EMAIL_MISSING');
    expect(src).toContain("invoice.email:");
    expect(src).toContain("bankoverføring");
  });
});

describe("UI documents", () => {
  it("invoice document shows due date, payment terms, tax and payments (HTML/print)", () => {
    // FASE 11: dokumentteksten kommer fra lokalisert invoiceCopy (kjøpers
    // billing language); norsk basis lever i lib/billing/invoiceCopy.ts.
    const doc = read("components/billing/InvoiceDocument.tsx");
    expect(doc).toContain("copy.due");
    expect(doc).toContain("payment_terms_days");
    expect(doc).toContain("taxLabel");
    expect(doc).toContain("copy.paymentsTitle");
    const copySrc = read("lib/billing/invoiceCopy.ts");
    expect(copySrc).toContain('due: "Forfall"');
    expect(copySrc).toContain('paymentsTitle: "Registrerte betalinger"');
    expect(copySrc).toContain("invoice-only");
  });

  it("provider actions cover finalize/send/payment/credit/void with idempotent payment key", () => {
    const src = read("components/billing/InvoiceDetailActions.tsx");
    for (const n of ["finalize-invoice", "send-invoice", "register-payment", "create-credit-note", "void-invoice"]) {
      expect(src).toContain(n);
    }
    expect(src).toContain("idempotency_key: payIdemKey");
  });
});
