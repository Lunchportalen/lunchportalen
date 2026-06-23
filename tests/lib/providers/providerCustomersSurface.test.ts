import { describe, expect, it } from "vitest";

import {
  PROVIDER_CUSTOMER_FILTERS,
  buildCustomerStatusCounts,
  buildCustomersPaginationModel,
  formatProviderCustomerUpdated,
  providerCustomersEmptyStateKeys,
} from "@/lib/providers/providerCustomersSurface";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

type ProviderCustomersMessages = {
  provider: {
    customers: {
      page: { heading: string; leadWithProvider: string };
      filters: Record<string, string>;
      status: Record<string, string>;
      actions: { newCustomer: string };
      empty: Record<string, { title: string; text: string }>;
      pagination: Record<string, string>;
    };
  };
};

function customersMessages(messages: Awaited<ReturnType<typeof loadMessagesForLocale>>) {
  return messages as ProviderCustomersMessages;
}

describe("provider.customers messages — enterprise begrepsbruk", () => {
  it("bruker «Bedrifter» og bedriftskunde-begrep", async () => {
    const messages = customersMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.customers.page.heading).toBe("Bedrifter");
    expect(
      messages.provider.customers.page.leadWithProvider.replace("{providerName}", "Melhus Catering AS"),
    ).toBe("Administrer bedriftskunder, avtaler og leveringsoppsett for Melhus Catering AS.");
    expect(messages.provider.customers.filters.searchPlaceholder).toBe("Søk etter bedriftsnavn");
  });

  it("bruker ikke «firma»/«Firmanavn» i provider-facing copy", async () => {
    const messages = customersMessages(await loadMessagesForLocale("nb"));
    const all = JSON.stringify(messages.provider.customers).toLowerCase();
    expect(all).not.toContain("firma");
  });

  it("CTA er «Ny bedriftskunde», ikke «Legg til kunde»", async () => {
    const messages = customersMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.customers.actions.newCustomer).toBe("Ny bedriftskunde");
    expect(JSON.stringify(messages.provider.customers)).not.toContain("Legg til kunde");
  });

  it("statuschips bruker norske labels via filter ids", async () => {
    const messages = customersMessages(await loadMessagesForLocale("nb"));
    expect(PROVIDER_CUSTOMER_FILTERS.map((f) => messages.provider.customers.filters[f.id])).toEqual([
      "Alle",
      "Aktive",
      "Pauset",
      "Suspendert",
      "Slettet",
    ]);
  });
});

describe("buildCustomerStatusCounts", () => {
  it("teller korrekt; «Alle» teller kun ikke-slettede (matcher visningen)", () => {
    const counts = buildCustomerStatusCounts(["ACTIVE", "ACTIVE", "PAUSED", "SUSPENDED", "DELETED", "DELETED"]);
    expect(counts).toEqual({ all: 4, active: 2, paused: 1, suspended: 1, deleted: 2 });
  });

  it("tomt datasett gir nulltellinger", () => {
    expect(buildCustomerStatusCounts([])).toEqual({ all: 0, active: 0, paused: 0, suspended: 0, deleted: 0 });
  });
});

describe("formatProviderCustomerUpdated", () => {
  it("bruker locale-format, ikke rå ISO", () => {
    const out = formatProviderCustomerUpdated("2026-06-11T16:30:00Z");
    expect(out).toContain("11.06.2026");
    expect(out).not.toContain("T16:30");
    expect(out).not.toContain("2026-06-11T");
  });

  it("respekterer provider-locale", () => {
    const out = formatProviderCustomerUpdated("2026-06-11T16:30:00Z", "en-GB");
    expect(out).toContain("11/06/2026");
  });

  it("manglende/ugyldig verdi gir «—»", () => {
    expect(formatProviderCustomerUpdated(null)).toBe("—");
    expect(formatProviderCustomerUpdated("")).toBe("—");
    expect(formatProviderCustomerUpdated("ikke-en-dato")).toBe("—");
  });
});

describe("providerCustomersEmptyStateKeys", () => {
  it("ingen bedrifter ennå (uten søk/filter)", async () => {
    const keys = providerCustomersEmptyStateKeys({ hasSearch: false, filter: "all" });
    const messages = customersMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.customers.empty[keys.stateKey].title).toBe("Ingen bedrifter ennå");
    expect(messages.provider.customers.empty[keys.stateKey].text).toContain("registrert og godkjent");
    expect(keys.showCta).toBe(true);
  });

  it("søk uten treff", async () => {
    const keys = providerCustomersEmptyStateKeys({ hasSearch: true, filter: "all" });
    const messages = customersMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.customers.empty[keys.stateKey].title).toBe("Ingen treff");
    expect(keys.showCta).toBe(false);
  });

  it("statusfilter uten treff", async () => {
    const keys = providerCustomersEmptyStateKeys({ hasSearch: false, filter: "paused" });
    const messages = customersMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.customers.empty[keys.stateKey].title).toBe("Ingen bedrifter med valgt status");
    expect(keys.showCta).toBe(false);
  });
});

describe("buildCustomersPaginationModel", () => {
  it("én side → kontroller skjules, rolig oppsummering", async () => {
    const m = buildCustomersPaginationModel({ currentPage: 1, totalPages: 1, totalCount: 1 });
    const messages = customersMessages(await loadMessagesForLocale("nb"));
    expect(m.showControls).toBe(false);
    expect(m.summary).toEqual({ kind: "single" });
    expect(messages.provider.customers.pagination.oneCompany).toBe("1 bedrift");
  });

  it("flere sider → kontroller med korrekt disabled-state", () => {
    const first = buildCustomersPaginationModel({ currentPage: 1, totalPages: 3, totalCount: 55 });
    expect(first).toMatchObject({ showControls: true, prevDisabled: true, nextDisabled: false });
    expect(first.summary).toEqual({ kind: "page", currentPage: 1, totalPages: 3, totalCount: 55 });

    const last = buildCustomersPaginationModel({ currentPage: 3, totalPages: 3, totalCount: 55 });
    expect(last).toMatchObject({ showControls: true, prevDisabled: false, nextDisabled: true });
  });

  it("defensiv normalisering av ugyldige verdier", async () => {
    const m = buildCustomersPaginationModel({ currentPage: 99, totalPages: 0, totalCount: -5 });
    const messages = customersMessages(await loadMessagesForLocale("nb"));
    expect(m.showControls).toBe(false);
    expect(m.summary).toEqual({ kind: "plural", count: 0 });
    expect(messages.provider.customers.pagination.companies.replace("{count}", "0")).toBe("0 bedrifter");
  });
});

describe("provider.customers i18n completeness", () => {
  it("nb/en define all filter and status keys", async () => {
    for (const locale of ["nb", "en"] as const) {
      const messages = customersMessages(await loadMessagesForLocale(locale));
      for (const id of ["all", "active", "paused", "suspended", "deleted"] as const) {
        expect(messages.provider.customers.filters[id]).toBeTruthy();
        if (id !== "all") {
          expect(messages.provider.customers.status[id === "deleted" ? "deleted" : id]).toBeTruthy();
        }
      }
    }
  });
});
