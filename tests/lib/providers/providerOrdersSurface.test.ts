import { describe, expect, it } from "vitest";

import {
  PROVIDER_ORDERS_COPY,
  PROVIDER_ORDERS_DATE_MODES,
  PROVIDER_ORDERS_STATUS_FILTERS,
  buildKitchenStatusCounts,
  formatProviderOrdersDate,
  formatProviderOrdersDateRange,
  providerOrdersEmptyState,
} from "@/lib/providers/providerOrdersSurface";

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

describe("providerOrdersEmptyState", () => {
  it("i dag", () => {
    const s = providerOrdersEmptyState("today", false);
    expect(s.title).toBe("Ingen ordre for i dag");
    expect(s.text).toBe("Det finnes ingen aktive bestillinger for valgt periode.");
    expect(s.steps.length).toBeGreaterThanOrEqual(3);
  });

  it("i morgen", () => {
    expect(providerOrdersEmptyState("tomorrow", false).title).toBe("Ingen ordre for i morgen");
  });

  it("hele uken", () => {
    expect(providerOrdersEmptyState("week", false).title).toBe("Ingen ordre denne uken");
  });

  it("aktivt statusfilter prioriteres", () => {
    expect(providerOrdersEmptyState("today", true).title).toBe("Ingen ordre med valgt status");
  });

  it("lover ikke cutoff-klokkeslett", () => {
    for (const mode of ["today", "tomorrow", "week"] as const) {
      const s = providerOrdersEmptyState(mode, false);
      expect(`${s.title} ${s.text} ${s.steps.join(" ")}`).not.toMatch(/08:00|kl\./);
    }
  });
});

describe("PROVIDER_ORDERS_COPY — enterprise copy-disiplin", () => {
  it("bruker «Bedrift» / «Alle bedrifter», ikke «firma»", () => {
    expect(PROVIDER_ORDERS_COPY.companyFilterLabel).toBe("Bedrift");
    expect(PROVIDER_ORDERS_COPY.companyFilterAll).toBe("Alle bedrifter");
    expect(PROVIDER_ORDERS_COPY.groupByCompany).toBe("Per bedrift");
    const all = JSON.stringify(PROVIDER_ORDERS_COPY).toLowerCase();
    expect(all).not.toContain("firma");
  });

  it("ingen «Kjøkken» som page-label på provider-admin orders surface", () => {
    expect(PROVIDER_ORDERS_COPY.eyebrow).toBe("Ordre og produksjon");
    expect(JSON.stringify(PROVIDER_ORDERS_COPY).toLowerCase()).not.toContain("kjøkken");
  });

  it("statuschips bruker norske labels, ikke rå enum", () => {
    const labels = PROVIDER_ORDERS_STATUS_FILTERS.map((s) => s.label);
    expect(labels).toEqual(["Alle", "Mottatt", "Produksjon", "Klar", "Levert"]);
  });

  it("periodechips beholdes uendret", () => {
    expect(PROVIDER_ORDERS_DATE_MODES.map((d) => d.label)).toEqual(["I dag", "I morgen", "Hele uken"]);
  });
});
