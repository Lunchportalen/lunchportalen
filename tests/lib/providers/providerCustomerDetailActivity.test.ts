import { describe, expect, it } from "vitest";

import {
  PROVIDER_CUSTOMER_ACTIVITY_EMPTY,
  mapProviderCustomerDetailActivity,
} from "@/lib/providers/providerCustomerDetailActivity";

describe("mapProviderCustomerDetailActivity", () => {
  it("filtrerer bort rå delete/test-events", () => {
    const out = mapProviderCustomerDetailActivity([
      { id: "a", createdAt: "2026-06-10T08:00:00Z", action: "delete", summary: "test test test" },
      { id: "b", createdAt: "2026-06-10T08:00:00Z", action: "debug_event", summary: null },
    ]);
    expect(out).toEqual([]);
  });

  it("mapper provider restore og registrering til trygg copy", () => {
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
    expect(out.map((r) => r.title)).toEqual(["Kunde gjenopprettet", "Kunderegistrering mottatt"]);
    expect(JSON.stringify(out)).not.toContain("delete");
  });

  it("empty state er definert", () => {
    expect(PROVIDER_CUSTOMER_ACTIVITY_EMPTY.title).toContain("Ingen relevante kundeaktiviteter");
  });
});
