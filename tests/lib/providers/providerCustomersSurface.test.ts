import { describe, expect, it } from "vitest";

import {
  PROVIDER_CUSTOMERS_COPY,
  PROVIDER_CUSTOMER_FILTERS,
  buildCustomerStatusCounts,
  buildCustomersPaginationModel,
  formatProviderCustomerUpdated,
  providerCustomersEmptyState,
  providerCustomersSubheading,
} from "@/lib/providers/providerCustomersSurface";

describe("PROVIDER_CUSTOMERS_COPY — enterprise begrepsbruk", () => {
  it("bruker «Bedrifter» og bedriftskunde-begrep", () => {
    expect(PROVIDER_CUSTOMERS_COPY.heading).toBe("Bedrifter");
    expect(providerCustomersSubheading("Melhus Catering AS")).toBe(
      "Administrer bedriftskunder, avtaler og leveringsoppsett for Melhus Catering AS.",
    );
    expect(PROVIDER_CUSTOMERS_COPY.searchPlaceholder).toBe("Søk etter bedriftsnavn");
  });

  it("bruker ikke «firma»/«Firmanavn» i provider-facing copy", () => {
    const all = JSON.stringify(PROVIDER_CUSTOMERS_COPY).toLowerCase();
    expect(all).not.toContain("firma");
  });

  it("CTA er «Ny bedriftskunde», ikke «Legg til kunde»", () => {
    expect(PROVIDER_CUSTOMERS_COPY.cta).toBe("Ny bedriftskunde");
    expect(JSON.stringify(PROVIDER_CUSTOMERS_COPY)).not.toContain("Legg til kunde");
  });

  it("tabell bruker operasjonelle labels, ikke teknisk «Sist endret»", () => {
    expect(PROVIDER_CUSTOMERS_COPY.tableHeaders.name).toBe("Bedrift");
    expect(PROVIDER_CUSTOMERS_COPY.tableHeaders.ordersThisWeek).toBe("Ordre denne uken");
    expect(PROVIDER_CUSTOMERS_COPY.tableHeaders.lastUpdated).toBe("Sist oppdatert");
    expect(JSON.stringify(PROVIDER_CUSTOMERS_COPY)).not.toContain("Sist endret");
  });

  it("statuschips bruker norske labels, ikke rå enums", () => {
    expect(PROVIDER_CUSTOMER_FILTERS.map((f) => f.label)).toEqual([
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

describe("providerCustomersEmptyState", () => {
  it("ingen bedrifter ennå (uten søk/filter) — med trygg CTA", () => {
    const s = providerCustomersEmptyState({ hasSearch: false, filter: "all" });
    expect(s.title).toBe("Ingen bedrifter ennå");
    expect(s.text).toContain("registrert og godkjent");
    expect(s.showCta).toBe(true);
  });

  it("søk uten treff", () => {
    const s = providerCustomersEmptyState({ hasSearch: true, filter: "all" });
    expect(s.title).toBe("Ingen treff");
    expect(s.text).toBe("Prøv et annet bedriftsnavn eller fjern filteret.");
    expect(s.showCta).toBe(false);
  });

  it("statusfilter uten treff", () => {
    const s = providerCustomersEmptyState({ hasSearch: false, filter: "paused" });
    expect(s.title).toBe("Ingen bedrifter med valgt status");
    expect(s.text).toBe("Endre statusfilteret for å se flere bedriftskunder.");
    expect(s.showCta).toBe(false);
  });
});

describe("buildCustomersPaginationModel", () => {
  it("én side → kontroller skjules, rolig oppsummering", () => {
    const m = buildCustomersPaginationModel({ currentPage: 1, totalPages: 1, totalCount: 1 });
    expect(m.showControls).toBe(false);
    expect(m.prevDisabled).toBe(true);
    expect(m.nextDisabled).toBe(true);
    expect(m.summary).toBe("1 bedrift");
  });

  it("flere sider → kontroller med korrekt disabled-state", () => {
    const first = buildCustomersPaginationModel({ currentPage: 1, totalPages: 3, totalCount: 55 });
    expect(first).toMatchObject({ showControls: true, prevDisabled: true, nextDisabled: false });
    expect(first.summary).toBe("Side 1 av 3 (55 totalt)");

    const last = buildCustomersPaginationModel({ currentPage: 3, totalPages: 3, totalCount: 55 });
    expect(last).toMatchObject({ showControls: true, prevDisabled: false, nextDisabled: true });
  });

  it("defensiv normalisering av ugyldige verdier", () => {
    const m = buildCustomersPaginationModel({ currentPage: 99, totalPages: 0, totalCount: -5 });
    expect(m.showControls).toBe(false);
    expect(m.summary).toBe("0 bedrifter");
  });
});
