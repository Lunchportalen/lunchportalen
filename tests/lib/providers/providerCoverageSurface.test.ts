import { describe, expect, it } from "vitest";

import {
  PROVIDER_COVERAGE_COPY,
  PROVIDER_COVERAGE_EMPTY_STATE,
  coverageStatusLabel,
  formatCoverageDays,
  formatCoverageEmployees,
  providerCoverageSubheading,
  providerCoverageSummary,
} from "@/lib/providers/providerCoverageSurface";

describe("PROVIDER_COVERAGE_COPY — enterprise copy", () => {
  it("CTA er «Nytt dekningsområde», ikke «Legg til område»", () => {
    expect(PROVIDER_COVERAGE_COPY.cta).toBe("Nytt dekningsområde");
    expect(JSON.stringify(PROVIDER_COVERAGE_COPY)).not.toContain("Legg til område");
  });

  it("kolonner bruker tydelige labels", () => {
    expect(PROVIDER_COVERAGE_COPY.tableHeaders.area).toBe("Område");
    expect(PROVIDER_COVERAGE_COPY.tableHeaders.postalCodes).toBe("Postnummer");
    expect(PROVIDER_COVERAGE_COPY.tableHeaders.minEmployees).toBe("Min. ansatte");
    expect(PROVIDER_COVERAGE_COPY.tableHeaders.deliveryDays).toBe("Leveringsdager");
    expect(PROVIDER_COVERAGE_COPY.tableHeaders.status).toBe("Status");
  });

  it("deaktiver-copy forklarer konsekvens uten å overlove", () => {
    expect(PROVIDER_COVERAGE_COPY.actions.deactivate).toBe("Deaktiver");
    expect(PROVIDER_COVERAGE_COPY.actions.deactivateTitle).toContain("Nye bedrifter");
    expect(PROVIDER_COVERAGE_COPY.actions.deactivateTitle).toContain("Eksisterende avtaler endres ikke automatisk.");
  });

  it("subheading forklarer operasjonell konsekvens", () => {
    const s = providerCoverageSubheading("Melhus Catering AS");
    expect(s).toContain("hvilke bedrifter som kan sende forespørsel til Melhus Catering AS");
    expect(s).toContain("postnummer, minimum antall ansatte og leveringsdager");
  });
});

describe("providerCoverageSummary", () => {
  it("0 / 1 / flere aktive områder", () => {
    expect(providerCoverageSummary([])).toBe("Ingen aktive dekningsområder");
    expect(providerCoverageSummary([{ active: true }])).toBe("1 aktivt dekningsområde");
    expect(providerCoverageSummary([{ active: true }, { active: true }, { active: true }])).toBe(
      "3 aktive dekningsområder",
    );
  });

  it("inaktive telles som suffiks", () => {
    expect(providerCoverageSummary([{ active: true }, { active: false }])).toBe(
      "1 aktivt dekningsområde · 1 inaktive",
    );
    expect(providerCoverageSummary([{ active: false }])).toBe("Ingen aktive dekningsområder · 1 inaktive");
  });
});

describe("coverageStatusLabel", () => {
  it("mapper boolean og kjente statuser til provider-safe copy", () => {
    expect(coverageStatusLabel(true)).toBe("Aktiv");
    expect(coverageStatusLabel(false)).toBe("Inaktiv");
    expect(coverageStatusLabel("ACTIVE")).toBe("Aktiv");
    expect(coverageStatusLabel("inactive")).toBe("Inaktiv");
    expect(coverageStatusLabel("PAUSED")).toBe("Pauset");
  });

  it("fallback lekker aldri rå enum", () => {
    expect(coverageStatusLabel("SOME_RAW_ENUM")).toBe("Ukjent");
    expect(coverageStatusLabel(null)).toBe("Ukjent");
    expect(coverageStatusLabel("")).toBe("Ukjent");
  });
});

describe("formatCoverageDays", () => {
  it("alle hverdager vises som «Mandag–fredag»", () => {
    expect(formatCoverageDays(["mon", "tue", "wed", "thu", "fri"])).toBe("Mandag–fredag");
  });

  it("delvise dager bruker UI-labels, ikke rå verdier", () => {
    expect(formatCoverageDays(["mon", "wed", "fri"])).toBe("Man, Ons, Fre");
    expect(formatCoverageDays(["MON", "wed"])).toBe("Man, Ons");
  });

  it("ukjente/tomme verdier gir «—», aldri rå databaseverdi", () => {
    expect(formatCoverageDays([])).toBe("—");
    expect(formatCoverageDays(["funday"])).toBe("—");
  });
});

describe("formatCoverageEmployees", () => {
  it("min/max-varianter", () => {
    expect(formatCoverageEmployees(20, 50)).toBe("20–50");
    expect(formatCoverageEmployees(20, null)).toBe("20+");
    expect(formatCoverageEmployees(null, 50)).toBe("≤50");
    expect(formatCoverageEmployees(null, null)).toBe("—");
  });
});

describe("PROVIDER_COVERAGE_EMPTY_STATE", () => {
  it("operasjonell empty state med micro-guidance", () => {
    expect(PROVIDER_COVERAGE_EMPTY_STATE.title).toBe("Ingen dekningsområder ennå");
    expect(PROVIDER_COVERAGE_EMPTY_STATE.text).toContain("styre hvilke bedrifter");
    expect(PROVIDER_COVERAGE_EMPTY_STATE.steps).toEqual([
      "Definer postnummer eller område.",
      "Sett minimum antall ansatte.",
      "Velg leveringsdager for området.",
    ]);
  });

  it("ingen teknisk copy", () => {
    const all = JSON.stringify(PROVIDER_COVERAGE_EMPTY_STATE).toLowerCase();
    expect(all).not.toMatch(/null|enum|provider_service_areas|active=/);
  });
});
