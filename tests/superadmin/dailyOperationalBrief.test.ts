import { describe, it, expect } from "vitest";

import { sumProductionAnomalies } from "@/lib/server/superadmin/loadDailyOperationalBrief";
import type { ProductionReadinessPayload } from "@/lib/server/superadmin/loadProductionReadiness";

function stubPayload(over: Partial<ProductionReadinessPayload["anomalies"]>): ProductionReadinessPayload {
  return {
    date: "2026-04-14",
    level: "READY",
    headline: "Produksjon klar",
    detail: "—",
    operative_orders: 0,
    operative_companies: 0,
    operative_locations: 0,
    orders_active_raw: 0,
    slot_counts: {},
    anomalies: {
      orders_missing_scope: over.orders_missing_scope ?? 0,
      ghost_active_orders_with_cancelled_day_choice: over.ghost_active_orders_with_cancelled_day_choice ?? 0,
      operative_orders_missing_outbox: over.operative_orders_missing_outbox ?? 0,
      outbox_order_set_without_active_order: over.outbox_order_set_without_active_order ?? 0,
    },
    global_closed_reason: null,
    links: {
      operations: "/superadmin/operations",
      outbox: "/superadmin/outbox",
      kitchen_api: "/api/kitchen?date=2026-04-14",
    },
  };
}

describe("sumProductionAnomalies", () => {
  it("summerer canonical avvikstyper", () => {
    const p = stubPayload({
      orders_missing_scope: 1,
      ghost_active_orders_with_cancelled_day_choice: 2,
      operative_orders_missing_outbox: 0,
      outbox_order_set_without_active_order: 3,
    });
    expect(sumProductionAnomalies(p)).toBe(6);
  });

  it("returnerer 0 når alle er null/undefined-sikre nullstillinger", () => {
    expect(sumProductionAnomalies(stubPayload({}))).toBe(0);
  });
});
