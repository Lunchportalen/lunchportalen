import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/** Regression: employee /api/order/window must not expose unit_price; admin/superadmin order APIs still economic truth. */

describe("admin / superadmin order routes retain unit_price exposure", () => {
  test("superadmin companies orders route still selects unit_price for reporting", () => {
    const p = join(process.cwd(), "app", "api", "superadmin", "companies", "[companyId]", "orders", "route.ts");
    const src = readFileSync(p, "utf-8");
    expect(src).toContain("unit_price");
  });
});
