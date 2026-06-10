// tests/orders/orderNotificationRouting.test.ts
import { describe, expect, it } from "vitest";

import {
  buildDayChoiceCancelOutboxPayload,
  type DayChoiceCancelOutboxParams,
} from "@/lib/orderBackup/outbox";
import { buildOrderNotificationRouting } from "@/lib/orders/resolveOrderNotificationRecipients";
import { resolveProviderNotificationRecipients } from "@/lib/providers/providerNotificationRecipients";
import { ORDER_EMAIL } from "@/lib/system/emailAddresses";

const PROVIDER_A = "11111111-1111-1111-1111-111111111111";
const PROVIDER_B = "22222222-2222-2222-2222-222222222222";

function recipientsFor(providerId: string, operationsEmail: string | null, contactEmail: string | null) {
  return resolveProviderNotificationRecipients({
    providerId,
    settings: operationsEmail ? { operations_email: operationsEmail } : null,
    providerContactEmail: contactEmail,
  });
}

describe("buildOrderNotificationRouting", () => {
  it("provider A sine ordre rutes til provider A operationsEmail + plattformkopi", () => {
    const routing = buildOrderNotificationRouting(
      PROVIDER_A,
      recipientsFor(PROVIDER_A, "ordre@provider-a.no", "post@provider-a.no"),
    );

    expect(routing.providerId).toBe(PROVIDER_A);
    expect(routing.providerRecipients).toEqual(["ordre@provider-a.no"]);
    expect(routing.platformRecipients).toEqual([ORDER_EMAIL]);
    expect(routing.recipients).toEqual(["ordre@provider-a.no", ORDER_EMAIL]);
    expect(routing.recipientSource).toBe("provider_settings");
  });

  it("provider B bruker provider B operationsEmail — aldri provider A", () => {
    const a = buildOrderNotificationRouting(
      PROVIDER_A,
      recipientsFor(PROVIDER_A, "ordre@provider-a.no", "post@provider-a.no"),
    );
    const b = buildOrderNotificationRouting(
      PROVIDER_B,
      recipientsFor(PROVIDER_B, "ordre@provider-b.no", "post@provider-b.no"),
    );

    expect(b.providerRecipients).toEqual(["ordre@provider-b.no"]);
    expect(b.providerRecipients).not.toContain("ordre@provider-a.no");
    expect(a.providerRecipients).not.toContain("ordre@provider-b.no");
  });

  it("fallback til provider contact_email når operations_email mangler", () => {
    const routing = buildOrderNotificationRouting(
      PROVIDER_A,
      recipientsFor(PROVIDER_A, null, "post@provider-a.no"),
    );

    expect(routing.providerRecipients).toEqual(["post@provider-a.no"]);
    expect(routing.recipientSource).toBe("provider_contact");
  });

  it("fallback til systemadresse når provider mangler all e-post", () => {
    const routing = buildOrderNotificationRouting(PROVIDER_A, recipientsFor(PROVIDER_A, null, null));

    expect(routing.providerRecipients).toEqual([ORDER_EMAIL]);
    expect(routing.recipientSource).toBe("system_fallback");
    // Dedupe: provider-fallback og plattformkopi er samme adresse → én mottaker.
    expect(routing.recipients).toEqual([ORDER_EMAIL]);
  });

  it("provider som ikke kan resolves gir plattformkopi alene (aldri annen provider)", () => {
    const routing = buildOrderNotificationRouting(PROVIDER_A, null);

    expect(routing.providerRecipients).toEqual([]);
    expect(routing.recipients).toEqual([ORDER_EMAIL]);
    expect(routing.recipientSource).toBe("platform_only");
  });

  it("ingen duplikatmottakere når operationsEmail er lik plattformadressen", () => {
    const routing = buildOrderNotificationRouting(
      PROVIDER_A,
      recipientsFor(PROVIDER_A, ORDER_EMAIL, "post@provider-a.no"),
    );

    expect(routing.recipients).toEqual([ORDER_EMAIL]);
  });

  it("plattformkopi beholdes alltid", () => {
    const withProvider = buildOrderNotificationRouting(
      PROVIDER_A,
      recipientsFor(PROVIDER_A, "ordre@provider-a.no", null),
    );
    const withoutProvider = buildOrderNotificationRouting(null, null);

    expect(withProvider.recipients).toContain(ORDER_EMAIL);
    expect(withoutProvider.recipients).toContain(ORDER_EMAIL);
  });
});

describe("buildDayChoiceCancelOutboxPayload", () => {
  const params: DayChoiceCancelOutboxParams = {
    dbEventKey: "order.cancel.day_choice:user-1:2026-06-12",
    rid: "rid-123",
    orderId: "order-1",
    companyId: "company-1",
    locationId: "location-1",
    userId: "user-1",
    userEmail: null,
    date: "2026-06-12",
    orderStatus: "CANCELLED",
    providerId: PROVIDER_A,
  };

  it("avbestilling bruker provider-routet mottaker + plattformkopi", () => {
    const routing = buildOrderNotificationRouting(
      PROVIDER_A,
      recipientsFor(PROVIDER_A, "ordre@provider-a.no", "post@provider-a.no"),
    );
    const payload = buildDayChoiceCancelOutboxPayload(params, routing, {
      from: "Lunchportalen <ordre@lunchportalen.no>",
      timestampISO: "2026-06-12T08:30:00.000Z",
    });

    expect(payload.to).toBe(`ordre@provider-a.no, ${ORDER_EMAIL}`);
    expect(payload.from).toBe("Lunchportalen <ordre@lunchportalen.no>");
    expect(payload.subject).toBe("Ordre avbestilt – 12.06.2026 – Lunchportalen");
    expect(payload.eventType).toBe("ORDER_CANCELLED");
    expect(payload.eventKey).toBe(params.dbEventKey);
    expect(payload.extra).toMatchObject({
      source: "day_choice_http",
      providerId: PROVIDER_A,
      recipientSource: "provider_settings",
    });
  });

  it("payload-kontrakten beholdes (id/scope-felter uendret)", () => {
    const routing = buildOrderNotificationRouting(PROVIDER_A, null);
    const payload = buildDayChoiceCancelOutboxPayload(params, routing, { timestampISO: "2026-06-12T08:30:00.000Z" });

    expect(payload.userId).toBe("user-1");
    expect(payload.companyId).toBe("company-1");
    expect(payload.locationId).toBe("location-1");
    expect(payload.orderId).toBe("order-1");
    expect(payload.date).toBe("2026-06-12");
    expect(payload.status).toBe("CANCELLED");
    expect(payload.bodyText).toContain("OrderId: order-1");
    expect(payload.bodyText).toContain("RID: rid-123");
  });

  it("uresolvbar provider gir plattformkopi alene", () => {
    const routing = buildOrderNotificationRouting(PROVIDER_A, null);
    const payload = buildDayChoiceCancelOutboxPayload(params, routing, { timestampISO: "2026-06-12T08:30:00.000Z" });

    expect(payload.to).toBe(ORDER_EMAIL);
    expect(payload.extra).toMatchObject({ recipientSource: "platform_only" });
  });
});
