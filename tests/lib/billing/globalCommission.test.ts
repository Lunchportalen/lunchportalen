import { describe, expect, it } from "vitest";

import {
  buildCommissionLedgerIdempotencyKey,
  calculateCommissionExactMinor,
  resolveInvoiceRecipientSnapshot,
  sanitizePaymentMethodMetadata,
} from "@/lib/billing/globalCommission";

describe("globalCommission", () => {
  it("calculates 5 percent commission from net minor units without JS float math", () => {
    const commission = calculateCommissionExactMinor(BigInt(12_345), 500);

    expect(commission.decimal).toBe("617.250000");
    expect(commission.roundedMinor).toBe(BigInt(617));
  });

  it("rounds half away from zero for positive and negative correction events", () => {
    expect(calculateCommissionExactMinor(BigInt(999), 500).decimal).toBe("49.950000");
    expect(calculateCommissionExactMinor(BigInt(999), 500).roundedMinor).toBe(BigInt(50));

    expect(calculateCommissionExactMinor(BigInt(-999), 500).decimal).toBe("-49.950000");
    expect(calculateCommissionExactMinor(BigInt(-999), 500).roundedMinor).toBe(BigInt(-50));
  });

  it("builds stable ledger idempotency keys per event/order line", () => {
    expect(
      buildCommissionLedgerIdempotencyKey({
        eventType: "ORDER_COMPLETED",
        orderId: "order-1",
        orderLineId: "line-1",
      }),
    ).toBe("commission:ORDER_COMPLETED:order-1:line-1");
  });

  it("snapshots billing email and verified admin recipients without duplicates", () => {
    const recipients = resolveInvoiceRecipientSnapshot({
      billingEmail: " Faktura@Provider.No ",
      adminEmails: ["admin@provider.no", "faktura@provider.no", "invalid", null],
    });

    expect(recipients).toEqual([
      { recipient_email: "faktura@provider.no", recipient_type: "billing_email" },
      { recipient_email: "admin@provider.no", recipient_type: "admin" },
    ]);
  });

  it("allows card metadata but rejects raw card data", () => {
    expect(
      sanitizePaymentMethodMetadata({
        provider: "Stripe",
        providerPaymentMethodId: "pm_123",
        brand: "Visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2030,
      }),
    ).toMatchObject({
      provider: "stripe",
      brand: "visa",
      last4: "4242",
      status: "active",
    });

    expect(() =>
      sanitizePaymentMethodMetadata({
        provider: "stripe",
        providerPaymentMethodId: "pm_123",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2030,
        cardNumber: "4242424242424242",
      } as never),
    ).toThrow("RAW_CARD_DATA_FORBIDDEN");
  });
});
