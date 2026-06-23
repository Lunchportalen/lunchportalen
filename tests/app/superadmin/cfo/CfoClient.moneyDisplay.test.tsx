/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

import CfoClient, { formatCfoMoneyDisplay } from "@/app/superadmin/cfo/CfoClient";
import { formatMoneyDisplay } from "@/lib/commercial/moneyDisplay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("formatCfoMoneyDisplay (ADR-017 R3D)", () => {
  test("formats major NOK via moneyDisplay (nb-NO, whole kr)", () => {
    const expected = formatMoneyDisplay({
      amountMinor: 125000,
      currency: "NOK",
      locale: "nb-NO",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatted;

    expect(formatCfoMoneyDisplay(1250)).toBe(expected);
  });

  test("null/undefined returns n/a without throwing", () => {
    expect(formatCfoMoneyDisplay(null)).toBe("n/a");
    expect(formatCfoMoneyDisplay(undefined)).toBe("n/a");
  });

  test("zero formats as money, not n/a", () => {
    expect(formatCfoMoneyDisplay(0)).toBe(formatCfoMoneyDisplay(0));
    expect(formatCfoMoneyDisplay(0)).not.toBe("n/a");
  });
});

describe("CfoClient money display (ADR-017 R3D)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  test("renders omsetning KPI and table revenue via moneyDisplay", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        rid: "rid-cfo-test",
        data: {
          totals: {
            orders: 10,
            revenue_nok: 1250,
            revenue_missing: { missing: 0, total: 10 },
          },
          stability: { stability_rate: 0.9, delivered: 9, cancelled: 1 },
          companies: { active: 2, archived: 0 },
          risk_indicators: { level: "LOW", reasons: [] },
          cancellations: { before_0800: 0, after_0800: 1, missing_timestamp: 0, source: "orders" },
          top_companies: [
            {
              company_id: "c1",
              company_name: "Test AS",
              orgnr: "123456789",
              status: "ACTIVE",
              orders: 5,
              cancelled: 0,
              revenue_sum: 1250,
            },
          ],
          volume_by_day: [],
          volume_by_week: [],
          warnings: [],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CfoClient />);
      await Promise.resolve();
    });

    const expected = formatCfoMoneyDisplay(1250);
    expect(container.textContent).toContain("OMSETNING (NOK)");
    expect(container.textContent).toContain(expected);
    expect(container.textContent).toContain("Test AS");
  });
});
