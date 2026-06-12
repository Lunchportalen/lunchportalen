// tests/kitchen/batchPackedDeliveryRouting.test.ts
// Provider-eid delivery routing for «Leveranse klar» (batch packed).
// Låst regel: Lunchportalen-adresser (driver@/ordre@/kitchen@) er aldri
// providerens mottaker — manglende provider-e-post er fail-closed.
import { describe, expect, it } from "vitest";

import {
  batchPackedEventKey,
  deriveBatchProviderId,
  resolveBatchPackedDeliveryRoute,
} from "@/lib/kitchen/batchPackedOutbox";
import { resolveProviderNotificationRecipients } from "@/lib/providers/providerNotificationRecipients";
import { ORDER_EMAIL } from "@/lib/system/emailAddresses";

const PROVIDER_A = "11111111-1111-1111-1111-111111111111";
const PROVIDER_B = "22222222-2222-2222-2222-222222222222";

const FORBIDDEN_PLATFORM_RECIPIENTS = [
  "driver@lunchportalen.no",
  "ordre@lunchportalen.no",
  "kitchen@lunchportalen.no",
];

function recipientsFor(
  providerId: string,
  opts: { delivery?: string | null; operations?: string | null; contact?: string | null },
) {
  return resolveProviderNotificationRecipients({
    providerId,
    settings: {
      delivery_email: opts.delivery ?? null,
      operations_email: opts.operations ?? null,
    },
    providerContactEmail: opts.contact ?? null,
  });
}

describe("batchPackedEventKey — idempotency LOCKED", () => {
  it("event key-formatet er uendret fra før hardening", () => {
    expect(batchPackedEventKey("2026-06-12", "lunch", "loc-1")).toBe("batch_packed:2026-06-12:lunch:loc-1");
  });
});

describe("deriveBatchProviderId", () => {
  it("utleder provider_id når alle batch-ordre har samme provider", () => {
    const res = deriveBatchProviderId([
      { id: "o1", provider_id: PROVIDER_A },
      { id: "o2", provider_id: PROVIDER_A },
    ]);
    expect(res).toEqual({ providerId: PROVIDER_A, reason: null });
  });

  it("fail-closed: ingen ordre", () => {
    expect(deriveBatchProviderId([])).toEqual({ providerId: null, reason: "no_orders" });
  });

  it("fail-closed: ordre uten provider_id", () => {
    expect(deriveBatchProviderId([{ id: "o1", provider_id: null }])).toEqual({
      providerId: null,
      reason: "provider_id_missing_on_orders",
    });
  });

  it("fail-closed: blandede provider_id gir aldri gjetting", () => {
    const res = deriveBatchProviderId([
      { id: "o1", provider_id: PROVIDER_A },
      { id: "o2", provider_id: PROVIDER_B },
    ]);
    expect(res).toEqual({ providerId: null, reason: "mixed_provider_ids" });
  });

  it("fail-closed: delvis manglende provider_id behandles som blandet", () => {
    const res = deriveBatchProviderId([
      { id: "o1", provider_id: PROVIDER_A },
      { id: "o2", provider_id: null },
    ]);
    expect(res).toEqual({ providerId: null, reason: "mixed_provider_ids" });
  });
});

describe("resolveBatchPackedDeliveryRoute", () => {
  it("bruker provider delivery_email når satt", () => {
    const route = resolveBatchPackedDeliveryRoute(
      recipientsFor(PROVIDER_A, { delivery: "levering@provider-a.no", operations: "ordre@provider-a.no" }),
    );
    expect(route.to).toBe("levering@provider-a.no");
    expect(route.recipientSource).toBe("provider_settings");
    expect(route.missingReason).toBeNull();
  });

  it("provider-eid fallback: delivery_email mangler → operations_email", () => {
    const route = resolveBatchPackedDeliveryRoute(
      recipientsFor(PROVIDER_A, { operations: "ordre@provider-a.no" }),
    );
    expect(route.to).toBe("ordre@provider-a.no");
    expect(route.recipientSource).toBe("provider_settings");
  });

  it("provider-eid fallback: kun contact_email → contact brukes med sporbar kilde", () => {
    const route = resolveBatchPackedDeliveryRoute(recipientsFor(PROVIDER_A, { contact: "post@provider-a.no" }));
    expect(route.to).toBe("post@provider-a.no");
    expect(route.recipientSource).toBe("provider_contact");
  });

  it("fail-closed: provider helt uten e-post gir missing — ALDRI Lunchportalen", () => {
    const route = resolveBatchPackedDeliveryRoute(recipientsFor(PROVIDER_A, {}));
    expect(route.to).toBeNull();
    expect(route.recipientSource).toBe("missing");
    expect(route.missingReason).toBe("provider_email_not_configured");
  });

  it("fail-closed: uresolvbar provider gir missing", () => {
    const route = resolveBatchPackedDeliveryRoute(null);
    expect(route.to).toBeNull();
    expect(route.missingReason).toBe("provider_unresolved");
  });

  it("ingen Lunchportalen-adresse kan bli provider-mottaker fra resolver-kjeden", () => {
    const variants = [
      recipientsFor(PROVIDER_A, {}),
      recipientsFor(PROVIDER_A, { delivery: null, operations: null, contact: null }),
      null,
    ];
    for (const recipients of variants) {
      const route = resolveBatchPackedDeliveryRoute(recipients);
      expect(route.to).toBeNull();
      for (const forbidden of FORBIDDEN_PLATFORM_RECIPIENTS) {
        expect(route.to).not.toBe(forbidden);
      }
    }
    expect(ORDER_EMAIL).toBe("ordre@lunchportalen.no");
  });

  it("provider A/B isolation: A sin delivery-mail krysser aldri til B", () => {
    const a = resolveBatchPackedDeliveryRoute(recipientsFor(PROVIDER_A, { delivery: "levering@provider-a.no" }));
    const b = resolveBatchPackedDeliveryRoute(recipientsFor(PROVIDER_B, { delivery: "levering@provider-b.no" }));
    expect(a.to).toBe("levering@provider-a.no");
    expect(b.to).toBe("levering@provider-b.no");
    expect(a.to).not.toBe(b.to);
  });
});
