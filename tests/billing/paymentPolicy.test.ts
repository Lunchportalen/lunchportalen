import { describe, expect, test } from "vitest";

import { isOnlinePaymentAllowed, PAYMENT_POLICY } from "@/lib/billing/paymentPolicy";

describe("paymentPolicy", () => {
  test("invoice-only mode: no online payment", () => {
    expect(PAYMENT_POLICY.mode).toBe("invoice_only");
    expect(isOnlinePaymentAllowed()).toBe(false);
  });
});
