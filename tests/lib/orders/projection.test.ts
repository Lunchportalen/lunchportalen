import { describe, expect, it } from "vitest";

import {
  ORDER_PRICE_FIELDS_ONLY,
  pickItemColumns,
  pickMenuItemColumns,
  pickOrderColumns,
} from "@/lib/orders/projection";
import { showOrderPricesForApiRole } from "@/lib/orders/projectionRole";

const FORBIDDEN_FOR_EMPLOYEE = [
  "unit_price_nok",
  "subtotal_cents_ex_vat",
  "vat_cents",
  "gross_cents_inc_vat",
  "unit_price_cents_ex_vat",
  "line_subtotal_cents_ex_vat",
  "line_vat_cents",
  "line_total_cents_inc_vat",
  "vat_rate_snapshot",
  "offered_price_cents_ex_vat",
];

describe("pickOrderColumns", () => {
  it("employee projection omits all price tokens", () => {
    const cols = pickOrderColumns(false);
    for (const t of FORBIDDEN_FOR_EMPLOYEE) {
      expect(cols).not.toContain(t);
    }
    expect(cols).toContain("user_id");
    expect(cols).toContain("service_date");
  });

  it("admin projection includes roll-up price fields", () => {
    const cols = pickOrderColumns(true);
    for (const t of ORDER_PRICE_FIELDS_ONLY.split(",").map((s) => s.trim())) {
      expect(cols).toContain(t);
    }
    expect(cols).toContain("company_id");
  });
});

describe("pickItemColumns", () => {
  it("employee item projection has no economic columns", () => {
    const cols = pickItemColumns(false);
    for (const t of FORBIDDEN_FOR_EMPLOYEE) {
      expect(cols).not.toContain(t);
    }
  });

  it("admin item projection includes line economics", () => {
    const cols = pickItemColumns(true);
    expect(cols).toContain("unit_price_cents_ex_vat");
    expect(cols).toContain("vat_rate_snapshot");
  });
});

describe("pickMenuItemColumns", () => {
  it("employee menu item projection excludes offered price and VAT rate", () => {
    const cols = pickMenuItemColumns(false);
    expect(cols).not.toContain("offered_price_cents_ex_vat");
    expect(cols).not.toContain("vat_rate_snapshot");
  });

  it("admin menu projection includes offered price and VAT rate", () => {
    const cols = pickMenuItemColumns(true);
    expect(cols).toContain("offered_price_cents_ex_vat");
    expect(cols).toContain("vat_rate_snapshot");
  });
});

describe("showOrderPricesForApiRole", () => {
  it("fails closed for employee, driver, kitchen, empty", () => {
    expect(showOrderPricesForApiRole("employee")).toBe(false);
    expect(showOrderPricesForApiRole("driver")).toBe(false);
    expect(showOrderPricesForApiRole("kitchen")).toBe(false);
    expect(showOrderPricesForApiRole(null)).toBe(false);
    expect(showOrderPricesForApiRole("")).toBe(false);
  });

  it("allows company_admin only", () => {
    expect(showOrderPricesForApiRole("company_admin")).toBe(true);
    expect(showOrderPricesForApiRole("COMPANY_ADMIN")).toBe(true);
    expect(showOrderPricesForApiRole("superadmin")).toBe(false);
  });
});
