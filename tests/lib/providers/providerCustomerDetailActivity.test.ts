import { describe, expect, it } from "vitest";

import {
  PROVIDER_CUSTOMER_ACTIVITY_EMPTY_KEYS,
  mapProviderCustomerDetailActivity,
} from "@/lib/providers/providerCustomerDetailActivity";
import { loadProviderCustomerMessages } from "./providerCustomerI18nTestHelpers";

describe("mapProviderCustomerDetailActivity", () => {
  it("filtrerer bort rå delete/test-events", () => {
    const out = mapProviderCustomerDetailActivity([
      { id: "a", createdAt: "2026-06-10T08:00:00Z", action: "delete", summary: "test test test" },
      { id: "b", createdAt: "2026-06-10T08:00:00Z", action: "debug_event", summary: null },
    ]);
    expect(out).toEqual([]);
  });

  it("mapper provider restore og registrering til eventKey (i18n i UI)", () => {
    const out = mapProviderCustomerDetailActivity([
      {
        id: "a",
        createdAt: "2026-06-17T20:00:00Z",
        action: "provider.customer.restore.success",
        summary: "provider.customer.restore.success",
      },
      {
        id: "b",
        createdAt: "2026-05-11T19:40:26Z",
        action: "company_registration_submitted",
        summary: "Firma registrerte avtaleforespørsel.",
      },
    ]);
    expect(out.map((r) => r.eventKey)).toEqual([
      "provider.customer.restore.success",
      "company_registration_submitted",
    ]);
    expect(JSON.stringify(out)).not.toContain("delete");
  });

  it("empty state keys er definert i messages", async () => {
    const messages = await loadProviderCustomerMessages("nb");
    const empty = messages.provider.customers.activity.empty as { title: string; text: string };
    expect(PROVIDER_CUSTOMER_ACTIVITY_EMPTY_KEYS).toEqual(["title", "text"]);
    expect(empty.title).toContain("Ingen relevante kundeaktiviteter");
  });
});
