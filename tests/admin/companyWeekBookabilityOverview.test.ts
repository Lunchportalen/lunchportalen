import { describe, it, expect } from "vitest";

import { buildCompanyWeekBookabilityDayRow } from "@/lib/server/admin/loadCompanyWeekBookabilityOverview";

describe("buildCompanyWeekBookabilityDayRow", () => {
  const base = {
    company_status_upper: "ACTIVE",
    operative_day_keys: ["mon", "tue", "wed", "thu", "fri"] as const,
    dayTiers: { mon: "BASIS" as const, tue: "LUXUS" as const, wed: "BASIS" as const, thu: "BASIS" as const, fri: "BASIS" as const },
    closed_ok: true,
    closed_reason_for_date: null as string | null,
    ledger_active_id: "ledger-1",
    snapshot_agreement_status_upper: "ACTIVE" as string | null,
  };

  it("markerer fremtidig dag med daymap som åpen når cut-off er fremtidig (test-styrt)", () => {
    const row = buildCompanyWeekBookabilityDayRow(
      {
        ...base,
        date_iso: "2035-06-05",
      },
      { cutoff_status: "FUTURE_OPEN" },
    );
    expect(row.booking).toBe("open");
    expect(row.daymap_active).toBe(true);
    expect(row.tier).toBe("LUXUS");
    expect(row.detail_lines_nb.some((l) => l.includes("Operativt åpent"))).toBe(true);
  });

  it("blokkerer når firmastatus er PAUSED", () => {
    const row = buildCompanyWeekBookabilityDayRow(
      {
        ...base,
        date_iso: "2035-06-05",
        company_status_upper: "PAUSED",
      },
      { cutoff_status: "FUTURE_OPEN" },
    );
    expect(row.booking).toBe("blocked");
    expect(row.detail_lines_nb.some((l) => l.includes("pause"))).toBe(true);
  });

  it("blokkerer når dato er stengt i operativ closed_dates-modell", () => {
    const row = buildCompanyWeekBookabilityDayRow(
      {
        ...base,
        date_iso: "2035-06-05",
        closed_reason_for_date: "Helligdag",
      },
      { cutoff_status: "FUTURE_OPEN" },
    );
    expect(row.booking).toBe("blocked");
    expect(row.detail_lines_nb.some((l) => l.includes("Stengt dato"))).toBe(true);
  });

  it("blokkerer ukedag uten tier når daymap finnes for andre dager", () => {
    const row = buildCompanyWeekBookabilityDayRow(
      {
        ...base,
        date_iso: "2035-06-08",
        operative_day_keys: ["mon", "tue"],
        dayTiers: { mon: "BASIS" as const, tue: "BASIS" as const },
      },
      { cutoff_status: "FUTURE_OPEN" },
    );
    expect(row.booking).toBe("blocked");
    expect(row.daymap_active).toBe(false);
    expect(row.detail_lines_nb.some((l) => l.includes("Ikke operativ leveringsdag"))).toBe(true);
  });

  it("viser myk årsak når aktiv ledger mangler men daymap finnes (som firmadagens drift)", () => {
    const row = buildCompanyWeekBookabilityDayRow(
      {
        ...base,
        date_iso: "2035-06-05",
        ledger_active_id: null,
      },
      { cutoff_status: "FUTURE_OPEN" },
    );
    expect(row.booking).toBe("open");
    expect(row.detail_lines_nb.some((l) => l.startsWith("Ingen aktiv ledger-avtale"))).toBe(true);
  });
});
