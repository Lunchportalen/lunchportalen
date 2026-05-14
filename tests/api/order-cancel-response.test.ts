import { describe, expect, test } from "vitest";
import { jsonOrderWriteOk } from "@/lib/http/respond";

/**
 * Employee cancel uses `jsonOrderWriteOk` (flat body, no `data` wrapper).
 * B2B unit_price must not appear on this contract — same principle as order/window.
 */
describe("employee order cancel JSON contract", () => {
  test("jsonOrderWriteOk success omits pricing and unit_price", async () => {
    const res = jsonOrderWriteOk("rid-test", {
      orderId: "order-uuid-1",
      status: "cancelled",
      date: "2026-05-14",
      timestamp: "2026-05-14T12:00:00.000Z",
    });
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.ok).toBe(true);
    expect(body.orderId).toBe("order-uuid-1");
    expect("pricing" in body).toBe(false);
    expect("unit_price" in body).toBe(false);
  });

  test("jsonOrderWriteOk with optional tier still omits unit_price", async () => {
    const res = jsonOrderWriteOk("rid-tier", {
      orderId: "order-uuid-2",
      status: "active",
      date: "2026-05-15",
      timestamp: "2026-05-15T10:00:00.000Z",
      tier: "BASIS",
    });
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.ok).toBe(true);
    expect(body.tier).toBe("BASIS");
    expect("pricing" in body).toBe(false);
    expect("unit_price" in body).toBe(false);
  });
});
