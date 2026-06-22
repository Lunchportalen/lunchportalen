import { describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { NextIntlClientProvider } from "next-intl";

import ProviderMenuWeekPlanner from "@/components/providers/ProviderMenuWeekPlanner";
import { mergeProviderMenuRowsIntoSlots } from "@/lib/provider-menu/mergeProviderMenuSlots";
import { PROD_LUNCH_CATEGORY_FIXTURE } from "../lib/provider-menu/lunchCategoryCatalogFixtures";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

describe("ProviderMenuWeekPlanner badge precedence", () => {
  test("orderLocked > providerOverride > autoFilled — locked+overridden day renders lock badge only", async () => {
    const messages = await loadMessagesForLocale("nb");
    const slots = mergeProviderMenuRowsIntoSlots([
      {
        id: "menuDay-2026-06-16-BASIS-varmrett",
        date: "2026-06-16",
        tier: "BASIS",
        category: "varmrett",
        mealTitle: "Kyllinggryte",
        description: "Med rotgrønnsaker.",
        allergens: ["melk"],
        estimatedCostPerPortion: 35,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: null,
        status: "published",
        approvedForPublish: true,
        customerVisible: true,
        providerOverride: true,
        autoFilled: true,
        orderLocked: true,
      },
    ]);

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuWeekPlanner
          tier="BASIS"
          catalog={PROD_LUNCH_CATEGORY_FIXTURE}
          weekDates={["2026-06-16"]}
          slots={slots}
          selected={null}
          orderCountsByDate={{ "2026-06-16": 14 }}
          onSelect={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(html).toContain("Har bestilling");
    expect(html).toContain("Kyllinggryte");
    expect(html).not.toContain("Overstyrt");
    expect(html).not.toContain("Generert");
  });

  test("en locale translates order-lock badge while meal title stays unchanged", async () => {
    const messages = await loadMessagesForLocale("en");
    const slots = mergeProviderMenuRowsIntoSlots([
      {
        id: "menuDay-2026-06-16-BASIS-varmrett",
        date: "2026-06-16",
        tier: "BASIS",
        category: "varmrett",
        mealTitle: "Kyllinggryte",
        description: "Med rotgrønnsaker.",
        allergens: ["melk"],
        estimatedCostPerPortion: 35,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: null,
        status: "published",
        approvedForPublish: true,
        customerVisible: true,
        providerOverride: true,
        autoFilled: true,
        orderLocked: true,
      },
    ]);

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProviderMenuWeekPlanner
          tier="BASIS"
          catalog={PROD_LUNCH_CATEGORY_FIXTURE}
          weekDates={["2026-06-16"]}
          slots={slots}
          selected={null}
          orderCountsByDate={{ "2026-06-16": 14 }}
          onSelect={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(html).toContain("Has orders");
    expect(html).toContain("Kyllinggryte");
    expect(html).not.toContain("Har bestilling");
  });
});
