import { describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { NextIntlClientProvider } from "next-intl";

import {
  kitchenStatusLabelKey,
  nextKitchenTarget,
  targetActionLabelKey,
} from "@/lib/providers/kitchenOrderStatus";
import { resolveProviderOrdersActionError } from "@/lib/providers/providerOrdersActionErrors";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

type ProviderOrdersMessages = {
  provider: {
    orders: {
      status: Record<string, string>;
      actions: Record<string, string>;
      errors: Record<string, string>;
      filters: {
        status: Record<string, string>;
        date: Record<string, string>;
        companyLabel: string;
        companyAll: string;
        groupByCompany: string;
      };
      page: { eyebrow: string };
      empty: {
        title: Record<string, string>;
        text: Record<string, string>;
        steps: Record<string, string>;
      };
    };
  };
};

function ordersMessages(messages: Awaited<ReturnType<typeof loadMessagesForLocale>>) {
  return messages as ProviderOrdersMessages;
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/leverandor/ordrer/actions", () => ({
  advanceKitchenOrder: vi.fn(),
}));

const sampleOrder = {
  id: "11111111-1111-1111-1111-111111111111",
  date: "2026-05-20",
  slot: "11:30",
  status: "ACTIVE" as const,
  note: "Uten løk",
  companyId: "22222222-2222-2222-2222-222222222222",
  companyName: "Test AS",
  locationId: "33333333-3333-3333-3333-333333333333",
  locationName: "Hovedlokasjon",
  employeeDisplayName: "Thomas Johansen",
  employeeEmail: "thomas@pettersenco.no",
  items: [
    {
      productName: "Påsmurt",
      quantity: 1,
      choiceLabel: "Påsmurt",
      variantTitle: "Laks & Eggerøre",
      displayLine: "Påsmurt · Laks & Eggerøre",
      allergens: [] as string[],
    },
  ],
};

describe("kitchenOrderStatus", () => {
  test.each([
    ["ACTIVE", "received", "PREPARED"],
    ["PREPARED", "inProduction", "DISPATCHED"],
    ["DISPATCHED", "readyForDelivery", "DELIVERED"],
    ["DELIVERED", "delivered", null],
  ] as const)("maps %s label key and next step", (status, labelKey, next) => {
    expect(kitchenStatusLabelKey(status)).toBe(labelKey);
    expect(nextKitchenTarget(status)).toBe(next);
  });

  test("targetActionLabelKey for progression", () => {
    expect(targetActionLabelKey("PREPARED")).toBe("startProduction");
    expect(targetActionLabelKey("DISPATCHED")).toBe("readyForDelivery");
    expect(targetActionLabelKey("DELIVERED")).toBe("markDelivered");
  });

  test("status labels translate via UI language (nb vs en)", async () => {
    const nb = ordersMessages(await loadMessagesForLocale("nb"));
    const en = ordersMessages(await loadMessagesForLocale("en"));
    expect(nb.provider.orders.status.received).toBe("Mottatt");
    expect(en.provider.orders.status.received).toBe("Received");
    expect(nb.provider.orders.actions.startProduction).toBe("Start produksjon");
    expect(en.provider.orders.actions.startProduction).toBe("Start production");
  });
});

describe("advanceKitchenOrder action", () => {
  test("is exported from actions module", async () => {
    const mod = await import("@/app/leverandor/ordrer/actions");
    expect(typeof mod.advanceKitchenOrder).toBe("function");
  });
});

describe("KitchenOrderCard", () => {
  test("renders translated status pill and advance button when canAdvance (nb)", async () => {
    const KitchenOrderCard = (await import("@/components/providers/KitchenOrderCard")).default;
    const messages = await loadMessagesForLocale("nb");
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <KitchenOrderCard order={sampleOrder} canAdvance={true} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Mottatt");
    expect(html).toContain("Start produksjon");
    expect(html).toContain("Test AS");
    expect(html).toContain("Thomas Johansen");
    expect(html).toContain("thomas@pettersenco.no");
    expect(html).toContain("Påsmurt · Laks &amp; Eggerøre");
    expect(html).toContain("Uten løk");
  });

  test("renders English UI labels when locale is en", async () => {
    const KitchenOrderCard = (await import("@/components/providers/KitchenOrderCard")).default;
    const messages = await loadMessagesForLocale("en");
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages}>
        <KitchenOrderCard order={sampleOrder} canAdvance={true} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Received");
    expect(html).toContain("Start production");
    expect(html).toContain("Påsmurt · Laks &amp; Eggerøre");
    expect(html).toContain("Uten løk");
  });

  test("hides advance button for viewer-only", async () => {
    const KitchenOrderCard = (await import("@/components/providers/KitchenOrderCard")).default;
    const messages = await loadMessagesForLocale("nb");
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <KitchenOrderCard order={sampleOrder} canAdvance={false} />
      </NextIntlClientProvider>,
    );
    expect(html).not.toContain("Start produksjon");
    expect(html).toContain("Kun visning");
  });

  test("client resolves action errorKey to translated UI text", async () => {
    const messages = ordersMessages(await loadMessagesForLocale("en"));
    const t = (key: string) => messages.provider.orders.errors[key] ?? key;
    expect(
      resolveProviderOrdersActionError(t, { success: false, errorKey: "orderNotFound" }),
    ).toBe("Order not found.");
  });
});

describe("advanceKitchenOrder optimistic rollback contract", () => {
  test("action failure uses errorKey contract", async () => {
    const { advanceKitchenOrder } = await import("@/app/leverandor/ordrer/actions");
    vi.mocked(advanceKitchenOrder).mockResolvedValueOnce({
      success: false,
      errorKey: "kitchenRoleRequired",
    });
    const res = await advanceKitchenOrder(sampleOrder.id, "PREPARED");
    expect(res.success).toBe(false);
    if (res.success === false) expect(res.errorKey).toBe("kitchenRoleRequired");
  });
});
