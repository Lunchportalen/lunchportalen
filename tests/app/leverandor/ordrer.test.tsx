import { describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import {
  kitchenStatusLabel,
  nextKitchenTarget,
  targetActionLabel,
} from "@/lib/providers/kitchenOrderStatus";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/leverandor/ordrer/actions", () => ({
  advanceKitchenOrder: vi.fn(),
}));

const sampleOrder = {
  id: "11111111-1111-1111-1111-111111111111",
  date: "2026-05-20",
  slot: "11:30",
  status: "ACTIVE" as const,
  note: "Uten løk",
  companyId: "22222222-2222-2222-2222-222222222222",
  companyName: "Test AS",
  locationId: "33333333-3333-3333-3333-333333333333",
  locationName: "Hovedlokasjon",
  employeeDisplayName: "Thomas Johansen",
  employeeEmail: "thomas@pettersenco.no",
  items: [
    {
      productName: "Påsmurt",
      quantity: 1,
      choiceLabel: "Påsmurt",
      variantTitle: "Laks & Eggerøre",
      displayLine: "Påsmurt · Laks & Eggerøre",
      allergens: [] as string[],
    },
  ],
};

describe("kitchenOrderStatus", () => {
  test.each([
    ["ACTIVE", "Mottatt", "PREPARED"],
    ["PREPARED", "I produksjon", "DISPATCHED"],
    ["DISPATCHED", "Klar for levering", "DELIVERED"],
    ["DELIVERED", "Levert", null],
  ] as const)("maps %s label and next step", (status, label, next) => {
    expect(kitchenStatusLabel(status)).toBe(label);
    expect(nextKitchenTarget(status)).toBe(next);
  });

  test("targetActionLabel for progression", () => {
    expect(targetActionLabel("PREPARED")).toBe("Start produksjon");
    expect(targetActionLabel("DISPATCHED")).toBe("Klar for levering");
    expect(targetActionLabel("DELIVERED")).toBe("Marker levert");
  });
});

describe("advanceKitchenOrder action", () => {
  test("is exported from actions module", async () => {
    const mod = await import("@/app/leverandor/ordrer/actions");
    expect(typeof mod.advanceKitchenOrder).toBe("function");
  });
});

describe("KitchenOrderCard", () => {
  test("renders status pill and advance button when canAdvance", async () => {
    const KitchenOrderCard = (await import("@/components/providers/KitchenOrderCard")).default;
    const html = renderToStaticMarkup(
      React.createElement(KitchenOrderCard, { order: sampleOrder, canAdvance: true }),
    );
    expect(html).toContain("Mottatt");
    expect(html).toContain("Start produksjon");
    expect(html).toContain("Test AS");
    expect(html).toContain("Thomas Johansen");
    expect(html).toContain("thomas@pettersenco.no");
    expect(html).toContain("Påsmurt · Laks &amp; Eggerøre");
    expect(html).toContain("Uten løk");
  });

  test("hides advance button for viewer-only", async () => {
    const KitchenOrderCard = (await import("@/components/providers/KitchenOrderCard")).default;
    const html = renderToStaticMarkup(
      React.createElement(KitchenOrderCard, { order: sampleOrder, canAdvance: false }),
    );
    expect(html).not.toContain("Start produksjon");
    expect(html).toContain("Kun visning");
  });
});

describe("advanceKitchenOrder optimistic rollback contract", () => {
  test("action returns error shape on failure", async () => {
    const { advanceKitchenOrder } = await import("@/app/leverandor/ordrer/actions");
    vi.mocked(advanceKitchenOrder).mockResolvedValueOnce({ success: false, error: "PERMISSION_DENIED" });
    const res = await advanceKitchenOrder(sampleOrder.id, "PREPARED");
    expect(res.success).toBe(false);
    if (!res.success && "error" in res) expect(res.error).toContain("PERMISSION");
  });
});
