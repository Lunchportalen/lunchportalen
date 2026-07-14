/** @vitest-environment jsdom */

import React from "react";
import { act } from "@/tests/_helpers/reactAct";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

import CtoClient, { formatCtoRevenueDisplay } from "@/app/superadmin/cto/CtoClient";
import { formatMoneyDisplay } from "@/lib/commercial/moneyDisplay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("formatCtoRevenueDisplay (ADR-017 R3C)", () => {
  test("formats major NOK revenue via moneyDisplay (nb-NO, whole kr)", () => {
    const expected = formatMoneyDisplay({
      amountMinor: 9000,
      currency: "NOK",
      locale: "nb-NO",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatted;

    expect(formatCtoRevenueDisplay(90)).toBe(expected);
  });

  test("null/undefined revenue formats as zero without throwing", () => {
    expect(formatCtoRevenueDisplay(null)).toBe(formatCtoRevenueDisplay(0));
    expect(formatCtoRevenueDisplay(undefined)).toBe(formatCtoRevenueDisplay(0));
  });
});

describe("CtoClient revenue KPI (ADR-017 R3C)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  test("renders omsetning using moneyDisplay-formatted revenue", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        rid: "rid-cto-test",
        data: {
          model: { revenue: 90, orders: 1, leads: 2, conversion: 0.5, activityLogRows: 0 },
          issues: [],
          roadmap: [],
          audit: { written: true },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CtoClient />);
      await Promise.resolve();
    });

    const expected = formatCtoRevenueDisplay(90);
    expect(container.textContent).toContain(expected);
    expect(container.textContent).toContain("Omsetning (ordre)");
  });
});
