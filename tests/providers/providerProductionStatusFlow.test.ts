import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import {
  buildKitchenOrderItemDisplay,
  formatProviderOrderItemLine,
} from "@/lib/providers/kitchenOrderDisplay";
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

/** Proven pilot reference — fixtures/tests only, never hardcoded in runtime. */
const PILOT = {
  companyName: "Pettersen&Co",
  locationName: "Hovedlokasjon",
  orderDate: "2026-06-16",
  employeeName: "Thomas Johansen",
  employeeEmail: "thomas@pettersenco.no",
  choiceKey: "paasmurt",
  itemKey: "laks-eggerore",
  variantTitle: "Laks & Eggerøre",
  choiceLabel: "Påsmurt",
  displayLine: "Påsmurt · Laks & Eggerøre",
  quantityLine: "1 stk · Påsmurt · Laks & Eggerøre",
};

const MIGRATION_ADVANCE = join(
  process.cwd(),
  "supabase/migrations/20260616110410_lp_order_advance_status_provider_after_cutoff.sql",
);
const BATCH_MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260713120000_batch_order_status_sync.sql",
);

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const pilotOrderBase = {
  id: "f8570e3e-9a87-420f-9484-cf9516bf6e86",
  date: PILOT.orderDate,
  slot: "11:30",
  note: null as string | null,
  companyId: "00000000-0000-4000-8000-000000000001",
  companyName: PILOT.companyName,
  locationId: "00000000-0000-4000-8000-000000000002",
  locationName: PILOT.locationName,
  employeeDisplayName: PILOT.employeeName,
  employeeEmail: PILOT.employeeEmail,
  items: [
    {
      productName: PILOT.choiceLabel,
      quantity: 1,
      choiceLabel: PILOT.choiceLabel,
      variantTitle: PILOT.variantTitle,
      displayLine: PILOT.displayLine,
      allergens: [] as string[],
    },
  ],
};

describe("provider production status flow (proven Pettersen/Melhus pilot)", () => {
  it("1. pilot order line matches proven display shape", () => {
    expect(
      formatProviderOrderItemLine({
        choiceLabel: PILOT.choiceLabel,
        variantTitle: PILOT.variantTitle,
      }),
    ).toBe(PILOT.displayLine);

    const item = buildKitchenOrderItemDisplay({
      productNameSnapshot: "Paasmurt",
      quantity: 1,
      choice: {
        choiceKey: PILOT.choiceKey,
        itemKey: PILOT.itemKey,
        itemTitleSnapshot: PILOT.variantTitle,
      },
    });
    expect(item.displayLine).toBe(PILOT.displayLine);
  });

  it.each([
    ["ACTIVE", "Mottatt", "PREPARED", "Start produksjon"],
    ["PREPARED", "I produksjon", "DISPATCHED", "Klar for levering"],
    ["DISPATCHED", "Klar for levering", "DELIVERED", "Marker levert"],
  ] as const)(
    "2–4. status %s → label %s → next %s (%s)",
    (status, label, next, action) => {
      expect(kitchenStatusLabel(status)).toBe(label);
      expect(nextKitchenTarget(status)).toBe(next);
      expect(targetActionLabel(next)).toBe(action);
    },
  );

  it("5. order line remains visible after each kitchen status", async () => {
    const KitchenOrderCard = (await import("@/components/providers/KitchenOrderCard")).default;

    for (const status of ["ACTIVE", "PREPARED", "DISPATCHED", "DELIVERED"] as const) {
      const html = renderToStaticMarkup(
        React.createElement(KitchenOrderCard, {
          order: { ...pilotOrderBase, status },
          canAdvance: status !== "DELIVERED",
        }),
      );
      expect(html).toContain("Pettersen&amp;Co");
      expect(html).toContain(PILOT.employeeName);
      expect(html).toContain(PILOT.employeeEmail);
      expect(html).toContain(PILOT.locationName);
      expect(html).toContain("Påsmurt · Laks &amp; Eggerøre");
    }
  });

  it("6. wrong provider blocked at loader and server action", () => {
    const loader = read("lib/providers/loadKitchenOrders.ts");
    expect(loader).toContain('.eq("provider_id"');
    expect(loader).toContain("fetchProviderOrderEnrichment");

    const actions = read("app/leverandor/ordrer/actions.ts");
    expect(actions).toContain("hasProviderRole");
    expect(actions).toContain("provider_kitchen");
  });

  it("7. employee cutoff trigger unchanged for normal mutations", () => {
    const sql = readFileSync(BATCH_MIGRATION, "utf8");
    expect(sql).toContain("orders locked after 08:00 Oslo for today");
    expect(sql).toContain("tg_orders_cutoff_0800");
  });

  it("8. provider production advance bypasses employee cutoff via scoped GUC only", () => {
    const sql = readFileSync(MIGRATION_ADVANCE, "utf8");
    expect(sql).toContain("set_config('app.batch_derived_advance', '1', true)");
    expect(sql).toContain("lp_assert_provider_kitchen_access");
    expect(sql).not.toContain("DISABLE TRIGGER");
  });

  it("9. status history trigger respects batch_derived_advance actor path", () => {
    const sql = readFileSync(BATCH_MIGRATION, "utf8");
    expect(sql).toContain("tg_order_status_history");
    expect(sql).toContain("order_status_history");
    expect(sql).toContain("app.batch_derived_advance");
  });

  it("10. provider status path does not touch order write API routes", () => {
    const statusWrapper = read("lib/admin/orderStatus.ts");
    const actions = read("app/leverandor/ordrer/actions.ts");
    expect(statusWrapper).not.toMatch(/app\/api\/orders/);
    expect(actions).not.toMatch(/app\/api\/orders/);
  });

  it("11. provider status path does not call lp_order_set", () => {
    const statusWrapper = read("lib/admin/orderStatus.ts");
    const actions = read("app/leverandor/ordrer/actions.ts");
    expect(statusWrapper).toContain('rpc("lp_order_advance_status"');
    expect(statusWrapper).not.toContain("lp_order_set");
    expect(actions).not.toContain("lp_order_set");
  });

  it("12. enrichment stays scoped to provider-visible orders only", () => {
    const enrichment = read("lib/providers/providerOrderEnrichment.ts");
    expect(enrichment).toContain("scopedOrderIds");
    expect(enrichment).toContain("ingestScopedOrderItemRow");
    expect(enrichment).not.toContain("lp_order_set");
  });
});
