import { describe, expect, it } from "vitest";

import {
  lineAmountExVat,
  lineUnitPriceExVat,
  mapInvoiceLineRow,
  mapInvoiceRunRow,
  type InvoiceLineDbRow,
} from "@/lib/superadmin/invoiceRunDb";

describe("invoiceRunDb schema mapping", () => {
  it("maps invoice_runs period_start/end to period_from/to DTO", () => {
    const dto = mapInvoiceRunRow({
      id: "run-1",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      status: "READY",
      created_at: "2026-02-01T00:00:00Z",
    });
    expect(dto.period_from).toBe("2026-01-01");
    expect(dto.period_to).toBe("2026-01-31");
    expect(dto.note).toBeNull();
  });

  it("maps invoice_lines real columns to legacy detail DTO", () => {
    const row: InvoiceLineDbRow = {
      id: "line-1",
      company_id: "co-1",
      quantity: 10,
      tier: "BASIS",
      unit_price_nok: 90,
      amount_nok: 900,
      unit_price_cents_ex_vat: 9000,
      line_subtotal_cents_ex_vat: 90000,
      line_vat_cents: 22500,
      line_total_cents_inc_vat: 112500,
      basis: { cancelled_qty: 2, cancelled_before_0800_qty: 1 },
      description: "Lunsj BASIS",
      companies: { name: "Test AS" },
    };

    expect(lineUnitPriceExVat(row)).toBe(90);
    expect(lineAmountExVat(row)).toBe(900);

    const dto = mapInvoiceLineRow(row);
    expect(dto.company_name).toBe("Test AS");
    expect(dto.plan_tier).toBe("BASIS");
    expect(dto.billable_qty).toBe(10);
    expect(dto.cancelled_qty).toBe(2);
    expect(dto.cancelled_before_0800_qty).toBe(1);
    expect(dto.amount_ex_vat).toBe(900);
    expect(dto.price_ex_vat).toBe(90);
  });

  it("derives amount_ex_vat from inc-VAT cents using billing_tax_codes rate", () => {
    const row: InvoiceLineDbRow = {
      company_id: "co-1",
      quantity: 1,
      tier: "BASIS",
      unit_price_nok: null,
      amount_nok: null,
      unit_price_cents_ex_vat: null,
      line_subtotal_cents_ex_vat: null,
      line_vat_cents: null,
      line_total_cents_inc_vat: 12500,
      basis: null,
      description: null,
      companies: { name: "Test AS" },
    };
    const vatRateById = new Map([["MVA_25", 0.25]]);
    expect(lineAmountExVat(row, vatRateById, "MVA_25")).toBe(100);
  });
});
