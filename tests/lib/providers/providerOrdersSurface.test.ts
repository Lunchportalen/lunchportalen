import { describe, expect, it } from "vitest";

import {
  PROVIDER_ORDERS_DATE_MODES,
  PROVIDER_ORDERS_STATUS_FILTERS,
  buildKitchenStatusCounts,
  formatProviderOrdersDate,
  formatProviderOrdersDateRange,
  ordersStatusFilterKey,
  providerOrdersEmptyStateKeys,
} from "@/lib/providers/providerOrdersSurface";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

type ProviderOrdersMessages = {
  provider: {
    orders: {
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

describe("formatProviderOrdersDate", () => {
  it("bruker locale-format, ikke ISO (nb-NO)", () => {
    const out = formatProviderOrdersDate("2026-06-11");
    expect(out).toBe("torsdag 11. juni 2026");
    expect(out).not.toContain("2026-06-11");
  });

  it("respekterer provider-locale når satt", () => {
    const out = formatProviderOrdersDate("2026-06-11", "en-GB");
    expect(out).toContain("Thursday");
    expect(out).toContain("June");
  });

  it("ugyldig input gir tom streng (aldri rå ISO-lekkasje)", () => {
    expect(formatProviderOrdersDate("")).toBe("");
    expect(formatProviderOrdersDate("11.06.2026")).toBe("");
    expect(formatProviderOrdersDate("2026-6-1")).toBe("");
  });

  it("range: lik fra/til gir én dato, ulik gir intervall", () => {
    expect(formatProviderOrdersDateRange("2026-06-11", "2026-06-11")).toBe("torsdag 11. juni 2026");
    expect(formatProviderOrdersDateRange("2026-06-08", "2026-06-14")).toBe(
      "mandag 8. juni 2026 – søndag 14. juni 2026",
    );
  });
});

describe("buildKitchenStatusCounts", () => {
  it("teller korrekt per statuschip for valgt periode", () => {
    const counts = buildKitchenStatusCounts([
      "ACTIVE",
      "active",
      "PREPARED",
      "DISPATCHED",
      "DELIVERED",
      "DELIVERED",
      "CANCELLED",
      "LOCKED",
      null,
    ]);
    expect(counts).toEqual({
      "": 9,
      ACTIVE: 2,
      PREPARED: 1,
      DISPATCHED: 1,
      DELIVERED: 2,
    });
  });

  it("tom periode gir nulltellinger", () => {
    expect(buildKitchenStatusCounts([])).toEqual({ "": 0, ACTIVE: 0, PREPARED: 0, DISPATCHED: 0, DELIVERED: 0 });
  });
});

describe("providerOrdersEmptyStateKeys", () => {
  it("i dag", async () => {
    const keys = providerOrdersEmptyStateKeys("today", false);
    const messages = ordersMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.orders.empty.title[keys.titleKey]).toBe("Ingen ordre for i dag");
    expect(messages.provider.orders.empty.text[keys.textKey]).toBe(
      "Det finnes ingen aktive bestillinger for valgt periode.",
    );
    expect(keys.stepKeys.length).toBeGreaterThanOrEqual(3);
  });

  it("i morgen", async () => {
    const keys = providerOrdersEmptyStateKeys("tomorrow", false);
    const messages = ordersMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.orders.empty.title[keys.titleKey]).toBe("Ingen ordre for i morgen");
  });

  it("hele uken", async () => {
    const keys = providerOrdersEmptyStateKeys("week", false);
    const messages = ordersMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.orders.empty.title[keys.titleKey]).toBe("Ingen ordre denne uken");
  });

  it("aktivt statusfilter prioriteres", async () => {
    const keys = providerOrdersEmptyStateKeys("today", true);
    const messages = ordersMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.orders.empty.title[keys.titleKey]).toBe("Ingen ordre med valgt status");
  });

  it("lover ikke cutoff-klokkeslett", async () => {
    const messages = ordersMessages(await loadMessagesForLocale("nb"));
    for (const mode of ["today", "tomorrow", "week"] as const) {
      const keys = providerOrdersEmptyStateKeys(mode, false);
      const copy = [
        messages.provider.orders.empty.title[keys.titleKey],
        messages.provider.orders.empty.text[keys.textKey],
        ...keys.stepKeys.map((k) => messages.provider.orders.empty.steps[k]),
      ].join(" ");
      expect(copy).not.toMatch(/08:00|kl\./);
    }
  });
});

describe("provider.orders messages — enterprise copy-disiplin", () => {
  it("bruker «Bedrift» / «Alle bedrifter», ikke «firma»", async () => {
    const messages = ordersMessages(await loadMessagesForLocale("nb"));
    const filters = messages.provider.orders.filters;
    expect(filters.companyLabel).toBe("Bedrift");
    expect(filters.companyAll).toBe("Alle bedrifter");
    expect(filters.groupByCompany).toBe("Per bedrift");
    const all = JSON.stringify(messages.provider.orders).toLowerCase();
    expect(all).not.toContain("firma");
  });

  it("ingen «Kjøkken» som page-label på provider-admin orders surface", async () => {
    const messages = ordersMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.orders.page.eyebrow).toBe("Ordre og produksjon");
    expect(JSON.stringify(messages.provider.orders.page).toLowerCase()).not.toContain("kjøkken");
  });

  it("statuschips bruker norske labels via filter keys, ikke rå enum", async () => {
    const messages = ordersMessages(await loadMessagesForLocale("nb"));
    const labels = PROVIDER_ORDERS_STATUS_FILTERS.map((s) =>
      messages.provider.orders.filters.status[ordersStatusFilterKey(s.id)],
    );
    expect(labels).toEqual(["Alle", "Mottatt", "Produksjon", "Klar", "Levert"]);
  });

  it("periodechips beholdes uendret", async () => {
    const messages = ordersMessages(await loadMessagesForLocale("nb"));
    expect(PROVIDER_ORDERS_DATE_MODES.map((d) => messages.provider.orders.filters.date[d.id])).toEqual([
      "I dag",
      "I morgen",
      "Hele uken",
    ]);
  });
});
