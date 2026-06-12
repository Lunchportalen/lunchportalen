// tests/orders/dailySummaryProviderRouting.test.ts
import { describe, expect, it } from "vitest";

import {
  buildDailySummaryDispatchPlan,
  groupOrdersByProvider,
  type DailySummaryOrderRow,
} from "@/lib/orders/dailySummaryProviderRouting";
import {
  resolveProviderNotificationRecipients,
  type ProviderNotificationRecipients,
} from "@/lib/providers/providerNotificationRecipients";
import { ORDER_EMAIL } from "@/lib/system/emailAddresses";

const PROVIDER_A = "11111111-1111-1111-1111-111111111111";
const PROVIDER_B = "22222222-2222-2222-2222-222222222222";
const DATE = "2026-06-12";
const PLATFORM_ORDER_TO = "ordre@lunchportalen.no";
const PLATFORM_KITCHEN_TO = "kitchen@lunchportalen.no";

function order(id: string, providerId: string | null, companyId = "company-1"): DailySummaryOrderRow {
  return {
    id,
    company_id: companyId,
    location_id: "location-1",
    user_id: `user-${id}`,
    slot: "lunch",
    provider_id: providerId,
  };
}

function recipientsFor(
  providerId: string,
  opts: { operations?: string | null; kitchen?: string | null; contact?: string | null },
): ProviderNotificationRecipients {
  return resolveProviderNotificationRecipients({
    providerId,
    settings: {
      operations_email: opts.operations ?? null,
      kitchen_email: opts.kitchen ?? null,
    },
    providerContactEmail: opts.contact ?? null,
  });
}

function planFor(
  orders: DailySummaryOrderRow[],
  resolvedByProvider: Map<string, ProviderNotificationRecipients | null>,
) {
  return buildDailySummaryDispatchPlan({
    date: DATE,
    orders,
    resolvedByProvider,
    platformOrderTo: PLATFORM_ORDER_TO,
    platformKitchenTo: PLATFORM_KITCHEN_TO,
  });
}

describe("groupOrdersByProvider", () => {
  it("grupperer ordre per provider og isolerer null-provider", () => {
    const grouped = groupOrdersByProvider([
      order("a1", PROVIDER_A),
      order("b1", PROVIDER_B),
      order("a2", PROVIDER_A),
      order("x1", null),
    ]);

    expect(grouped.get(PROVIDER_A)?.map((o) => o.id)).toEqual(["a1", "a2"]);
    expect(grouped.get(PROVIDER_B)?.map((o) => o.id)).toEqual(["b1"]);
    expect(grouped.get("")?.map((o) => o.id)).toEqual(["x1"]);
  });
});

describe("buildDailySummaryDispatchPlan", () => {
  const resolved = new Map<string, ProviderNotificationRecipients | null>([
    [PROVIDER_A, recipientsFor(PROVIDER_A, { operations: "ordre@provider-a.no", kitchen: "kjokken@provider-a.no" })],
    [PROVIDER_B, recipientsFor(PROVIDER_B, { operations: "ordre@provider-b.no", kitchen: "kjokken@provider-b.no" })],
  ]);

  const orders = [order("a1", PROVIDER_A), order("a2", PROVIDER_A), order("b1", PROVIDER_B)];

  it("provider A får bare provider A sine ordre — og B bare sine", () => {
    const plan = planFor(orders, resolved);

    const aEntries = plan.entries.filter((e) => e.providerId === PROVIDER_A);
    const bEntries = plan.entries.filter((e) => e.providerId === PROVIDER_B);

    expect(aEntries).toHaveLength(2);
    expect(bEntries).toHaveLength(2);
    for (const e of aEntries) expect(e.orders.map((o) => o.id)).toEqual(["a1", "a2"]);
    for (const e of bEntries) expect(e.orders.map((o) => o.id)).toEqual(["b1"]);
  });

  it("operationsEmail brukes for ordreoppsummering, kitchenEmail for produksjonsgrunnlag", () => {
    const plan = planFor(orders, resolved);

    const aOrder = plan.entries.find((e) => e.providerId === PROVIDER_A && e.kind === "order_summary");
    const aKitchen = plan.entries.find((e) => e.providerId === PROVIDER_A && e.kind === "kitchen_production");

    expect(aOrder?.to).toBe("ordre@provider-a.no");
    expect(aKitchen?.to).toBe("kjokken@provider-a.no");
    expect(aOrder?.eventKey).toBe(`daily_order_summary:${DATE}:${PROVIDER_A}`);
    expect(aKitchen?.eventKey).toBe(`daily_kitchen_production:${DATE}:${PROVIDER_A}`);
  });

  it("provider B-mottakere krysser aldri provider A", () => {
    const plan = planFor(orders, resolved);

    const bRecipients = plan.entries
      .filter((e) => e.providerId === PROVIDER_B)
      .map((e) => e.to)
      .join(", ");

    expect(bRecipients).toContain("provider-b.no");
    expect(bRecipients).not.toContain("provider-a.no");
  });

  it("plattformkopi beholdes alltid med alle ordre", () => {
    const plan = planFor(orders, resolved);

    const platformOrder = plan.entries.find((e) => e.scope === "platform" && e.kind === "order_summary");
    const platformKitchen = plan.entries.find((e) => e.scope === "platform" && e.kind === "kitchen_production");

    expect(platformOrder?.to).toBe(PLATFORM_ORDER_TO);
    expect(platformKitchen?.to).toBe(PLATFORM_KITCHEN_TO);
    expect(platformOrder?.eventKey).toBe(`daily_order_summary:${DATE}`);
    expect(platformOrder?.orders).toHaveLength(3);
    expect(platformKitchen?.orders).toHaveLength(3);
  });

  it("ingen global-only routing når provider_id finnes", () => {
    const plan = planFor(orders, resolved);

    const providerEntries = plan.entries.filter((e) => e.scope === "provider");
    expect(providerEntries.length).toBe(4); // 2 providere × (ops + kitchen)
    expect(plan.unresolvedProviderIds).toEqual([]);
  });

  it("fallback: manglende kitchenEmail faller tilbake via resolver-kjeden", () => {
    const fallbackResolved = new Map<string, ProviderNotificationRecipients | null>([
      [PROVIDER_A, recipientsFor(PROVIDER_A, { operations: "ordre@provider-a.no", contact: "post@provider-a.no" })],
    ]);
    const plan = planFor([order("a1", PROVIDER_A)], fallbackResolved);

    const kitchen = plan.entries.find((e) => e.providerId === PROVIDER_A && e.kind === "kitchen_production");
    expect(kitchen?.to).toBe("ordre@provider-a.no");
  });

  it("provider helt uten e-post: fail-closed konfigurasjonsavvik — ALDRI Lunchportalen som mottaker", () => {
    const fallbackResolved = new Map<string, ProviderNotificationRecipients | null>([
      [PROVIDER_A, recipientsFor(PROVIDER_A, {})],
    ]);
    const plan = planFor([order("a1", PROVIDER_A)], fallbackResolved);

    // Ingen provider-rader, avviket rapporteres, og plattformkopien dekker ordrene.
    expect(plan.entries.filter((e) => e.scope === "provider")).toHaveLength(0);
    expect(plan.missingRecipientProviderIds).toEqual([PROVIDER_A]);

    const providerTos = plan.entries.filter((e) => e.scope === "provider").map((e) => e.to);
    expect(providerTos).not.toContain(ORDER_EMAIL);

    const platformOrder = plan.entries.find((e) => e.scope === "platform" && e.kind === "order_summary");
    expect(platformOrder?.orders.map((o) => o.id)).toEqual(["a1"]);
  });

  it("uresolvbar provider dekkes kun av plattformkopi — aldri en annen provider", () => {
    const partiallyResolved = new Map<string, ProviderNotificationRecipients | null>([
      [PROVIDER_A, recipientsFor(PROVIDER_A, { operations: "ordre@provider-a.no" })],
      [PROVIDER_B, null],
    ]);
    const plan = planFor(orders, partiallyResolved);

    expect(plan.unresolvedProviderIds).toEqual([PROVIDER_B]);
    expect(plan.entries.filter((e) => e.providerId === PROVIDER_B)).toHaveLength(0);
    // Plattformkopien inneholder fortsatt B sine ordre.
    const platformOrder = plan.entries.find((e) => e.scope === "platform" && e.kind === "order_summary");
    expect(platformOrder?.orders.some((o) => o.provider_id === PROVIDER_B)).toBe(true);
  });

  it("ingen duplikatmottakere i to-feltet", () => {
    const dupResolved = new Map<string, ProviderNotificationRecipients | null>([
      [
        PROVIDER_A,
        resolveProviderNotificationRecipients({
          providerId: PROVIDER_A,
          settings: { operations_email: " Ordre@Provider-A.no ", kitchen_email: "ordre@provider-a.no" },
          providerContactEmail: null,
        }),
      ],
    ]);
    const plan = planFor([order("a1", PROVIDER_A)], dupResolved);

    for (const entry of plan.entries) {
      const parts = entry.to.split(", ");
      expect(new Set(parts).size).toBe(parts.length);
    }
  });

  it("ordre uten provider_id gir ingen provider-entries", () => {
    const plan = planFor([order("x1", null)], new Map());

    expect(plan.entries.filter((e) => e.scope === "provider")).toHaveLength(0);
    expect(plan.entries.filter((e) => e.scope === "platform")).toHaveLength(2);
  });
});
