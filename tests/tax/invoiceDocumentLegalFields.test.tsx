/**
 * PHASE 10 — invoices render legally required fields (acceptance proof).
 *
 * Renders the canonical InvoiceDocument with a market legal context and
 * asserts that seller/buyer tax IDs, market tax label, reverse-charge and
 * exemption notes actually appear in the document markup.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import InvoiceDocument from "@/components/billing/InvoiceDocument";
import type { InvoiceHead, InvoiceLegalContext, InvoiceLine } from "@/lib/billing/invoiceLifecycle";

const head = {
  id: "00000000-0000-0000-0000-000000000001",
  kind: "INVOICE",
  status: "ISSUED",
  invoice_number: "F-TEST-0001",
  provider_id: "p",
  company_id: "c",
  invoice_period_start: "2026-06-01",
  invoice_period_end: "2026-06-30",
  currency: "EUR",
  amount_net: 100,
  amount_tax: 19,
  amount_total: 119,
  amount_paid: 0,
  due_date: "2026-07-14",
  payment_terms_days: 14,
  issued_at: "2026-06-30T12:00:00Z",
  recipient_email: "faktura@example.com",
  credit_of_invoice_id: null,
} as unknown as InvoiceHead;

const lines = [
  {
    id: "l1",
    source: "ORDER",
    description: "Lunsj · 15.06.2026",
    quantity: 1,
    unit_price: 100,
    line_amount: 100,
    vat_rate: 0.19,
    vat_amount: 19,
    currency: "EUR",
  },
] as unknown as InvoiceLine[];

const legal: InvoiceLegalContext = {
  marketCountry: "DE",
  taxLabel: "VAT",
  sellerTaxId: "DE123456789",
  buyerTaxId: "DE987654321",
  buyerAddress: "Beispielstraße 1, 10115 Berlin",
  buyerStateProvince: null,
  reverseChargeNote: "Reverse charge — VAT to be accounted for by the recipient (Article 196, Council Directive 2006/112/EC).",
  taxExemptNote: null,
};

describe("InvoiceDocument renders legally required fields", () => {
  const html = renderToStaticMarkup(
    <InvoiceDocument head={head} lines={lines} payments={[]} providerName="Test Provider GmbH" companyName="Beispiel AG" legal={legal} />,
  );

  it("renders invoice number, dates, parties, amounts and currency", () => {
    expect(html).toContain("F-TEST-0001");
    expect(html).toContain("Test Provider GmbH");
    expect(html).toContain("Beispiel AG");
    expect(html).toContain("EUR");
    expect(html).toContain("14 dager"); // payment terms
  });

  it("renders seller and buyer tax IDs and buyer address", () => {
    expect(html).toContain("DE123456789");
    expect(html).toContain("DE987654321");
    expect(html).toContain("Beispielstraße 1, 10115 Berlin");
  });

  it("uses the market tax label (never a hardcoded MVA for non-NO markets)", () => {
    expect(html).toContain(">VAT<");
  });

  it("renders the mandatory reverse-charge note when applicable", () => {
    expect(html).toContain("Reverse charge");
    expect(html).toContain("2006/112/EC");
  });

  it("US market context renders sales tax label and state/province", () => {
    const usHtml = renderToStaticMarkup(
      <InvoiceDocument
        head={{ ...head, currency: "USD" } as InvoiceHead}
        lines={lines}
        payments={[]}
        providerName="US Provider LLC"
        companyName="Acme Corp"
        legal={{
          marketCountry: "US",
          taxLabel: "Sales tax",
          sellerTaxId: "123456789",
          buyerTaxId: null,
          buyerAddress: "1 Main St, Austin",
          buyerStateProvince: "TX",
          reverseChargeNote: null,
          taxExemptNote: "Tax exempt — reason: RESALE_CERTIFICATE",
        }}
      />,
    );
    expect(usHtml).toContain("Sales tax");
    expect(usHtml).toContain(", TX");
    expect(usHtml).toContain("RESALE_CERTIFICATE");
  });
});
