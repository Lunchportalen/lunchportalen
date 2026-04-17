import { describe, it, expect } from "vitest";
import { buildOrderSetOutboxEventKey } from "@/lib/server/superadmin/loadProductionReadiness";

describe("buildOrderSetOutboxEventKey", () => {
  it("matcher lp_orders_outbox_trigger: NULL-slot → unknown", () => {
    expect(buildOrderSetOutboxEventKey("00000000-0000-4000-8000-000000000001", "2026-04-14", null)).toBe(
      "order:set:00000000-0000-4000-8000-000000000001:2026-04-14:unknown"
    );
    expect(buildOrderSetOutboxEventKey("00000000-0000-4000-8000-000000000001", "2026-04-14", undefined)).toBe(
      "order:set:00000000-0000-4000-8000-000000000001:2026-04-14:unknown"
    );
  });

  it("bevarer eksplisitt slot-verdi (inkl. tom streng som i DB)", () => {
    expect(buildOrderSetOutboxEventKey("00000000-0000-4000-8000-000000000001", "2026-04-14", "lunch")).toBe(
      "order:set:00000000-0000-4000-8000-000000000001:2026-04-14:lunch"
    );
    expect(buildOrderSetOutboxEventKey("00000000-0000-4000-8000-000000000001", "2026-04-14", "")).toBe(
      "order:set:00000000-0000-4000-8000-000000000001:2026-04-14:"
    );
  });
});
